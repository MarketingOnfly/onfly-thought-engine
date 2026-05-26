import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import type { NewsItem } from "@/lib/db/types";

export const maxDuration = 120;
export const runtime = "nodejs";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

interface RawItem {
  title?: unknown;
  url?: unknown;
  source?: unknown;
  summary?: unknown;
  published_at?: unknown;
}

function tryParse(text: string): { items?: RawItem[] } | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

/**
 * GET /api/discover/news — devolve notícias do dia cacheadas (até 30 min).
 * ?refresh=1 ignora cache e força nova busca.
 */
export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const supabase = await createSupabaseServerClient();

  if (!refresh) {
    const { data: cache } = await supabase
      .from("daily_news_cache")
      .select("items, fetched_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cache?.fetched_at) {
      const age = Date.now() - new Date(cache.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          items: (cache.items ?? []) as NewsItem[],
          fetched_at: cache.fetched_at,
          cached: true,
        });
      }
    }
  }

  // Cache vencido OU refresh — busca nova
  const context = await loadLeaderContext(user.id);
  if (!context) {
    return NextResponse.json(
      { error: "Complete o onboarding antes de usar a descoberta." },
      { status: 412 }
    );
  }

  const leader = context.leader;
  const themesList =
    leader.themes && leader.themes.length ? leader.themes.join(", ") : "B2B brasileiro";
  const audience = leader.target_audience || "líderes B2B brasileiros";

  const prompt = `Hoje é ${new Date().toISOString().slice(0, 10)}.

Use a ferramenta web_search pra buscar 8 a 12 notícias / artigos / posts FRESCOS (últimos 7 dias) que sejam relevantes pra um líder com este perfil:

- Cargo/área: ${leader.role}, ${leader.area}
- Audiência-alvo: ${audience}
- Temas: ${themesList}

Faça 3 a 5 buscas diferentes, cobrindo:
- Notícias B2B brasileiras (Valor, Exame, Bloomberg Línea, Meio & Mensagem)
- Movimentos de mercado / lançamentos relacionados aos temas dele
- Posts/análises de fontes confiáveis no setor
- Dados/relatórios novos (pesquisas, surveys, índices)

Devolva JSON puro, NADA de markdown ou prefixo. Schema:
{
  "items": [
    {
      "title": "título do artigo/notícia, ≤ 100 chars",
      "url": "URL real (de uma das buscas)",
      "source": "nome curto da fonte (ex: 'Valor', 'Exame', 'Stratechery')",
      "summary": "1-2 frases curtas em pt-BR explicando o que tem e por que importa pro líder",
      "published_at": "YYYY-MM-DD ou null se não souber"
    }
  ]
}

Regras:
- Itens diversos — não empilhar 5 notícias sobre o mesmo assunto.
- Pular tudo que não tem fato concreto (não inclua 'blog post genérico de tendências').
- Se uma busca não trouxer nada bom, faz outra com query diferente.`;

  const anthropic = getAnthropic();
  let response;
  try {
    response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: 5 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Falha ao buscar notícias: ${
          err instanceof Error ? err.message : "erro desconhecido"
        }`,
      },
      { status: 502 }
    );
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const parsed = tryParse(text);
  if (!parsed?.items?.length) {
    return NextResponse.json(
      {
        error:
          "Não consegui extrair notícias estruturadas. Tenta atualizar de novo em alguns segundos.",
      },
      { status: 502 }
    );
  }

  const items: NewsItem[] = parsed.items
    .map((it) => ({
      title: String(it.title ?? "").slice(0, 200),
      url: String(it.url ?? "").slice(0, 800),
      source: String(it.source ?? "").slice(0, 80),
      summary: String(it.summary ?? "").slice(0, 500),
      published_at: it.published_at ? String(it.published_at).slice(0, 30) : null,
    }))
    .filter((it) => it.title && it.url);

  if (!items.length) {
    return NextResponse.json(
      { error: "Notícias retornadas estavam incompletas. Tenta de novo." },
      { status: 502 }
    );
  }

  const fetched_at = new Date().toISOString();
  await supabase
    .from("daily_news_cache")
    .upsert(
      { user_id: user.id, items, fetched_at },
      { onConflict: "user_id" }
    );

  return NextResponse.json({ items, fetched_at, cached: false });
}
