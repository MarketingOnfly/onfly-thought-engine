import { NextResponse } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildDiscoveryPrompt,
  buildLeaderSystemPrompt,
} from "@/lib/anthropic/prompts";
import { fetchSources } from "@/lib/fetch-source";

export const maxDuration = 180;

interface RawIdea {
  title?: unknown;
  angle?: unknown;
  why_now?: unknown;
  source_url?: unknown;
  source_title?: unknown;
  relevance_score?: unknown;
}

function tryParseJson(text: string): { ideas: RawIdea[] } | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // tenta achar JSON dentro do texto (caso Claude tenha incluído comentário)
    const match = trimmed.match(/\{[\s\S]*"ideas"[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const context = await loadLeaderContext(user.id);
  if (!context) return NextResponse.json({ error: "no profile" }, { status: 412 });

  if (!context.referenceLinks.length) {
    return NextResponse.json(
      {
        error:
          "Adicione ao menos uma fonte (substack, newsletter, blog, portal) na sua biblioteca antes de rodar a descoberta.",
      },
      { status: 400 }
    );
  }

  // Fetch das primeiras 8 fontes pra dar contexto cru (não bloqueia se falhar).
  const urls = context.referenceLinks.slice(0, 8).map((l) => l.url);
  const fetched = await fetchSources(urls);

  // Carrega ideias recentes (≤30) pra usar como anti-pattern.
  const supabase = await createSupabaseServerClient();
  const { data: recent } = await supabase
    .from("topic_suggestions")
    .select("title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const recentTitles = (recent ?? []).map((r) => r.title as string);

  const system = buildLeaderSystemPrompt(context);
  const userPrompt = buildDiscoveryPrompt({
    fetchedSources: fetched,
    trustedSourceUrls: context.referenceLinks.map((l) => l.url),
    recentIdeaTitles: recentTitles,
    todayISO: new Date().toISOString().slice(0, 10),
  });

  const anthropic = getAnthropic();

  // web_search é server-side tool — Claude executa as buscas internamente
  // e devolve o texto final na mesma resposta. Sem loop necessário.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 6,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
    messages: [{ role: "user", content: userPrompt }],
  });

  const finalText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const parsed = tryParseJson(finalText);
  if (!parsed?.ideas?.length) {
    return NextResponse.json(
      {
        error:
          "Não consegui extrair ideias estruturadas. Tente de novo — o agente pode ter ficado preso em busca.",
      },
      { status: 502 }
    );
  }

  /**
   * Detecta URL "só homepage" — domínio sem path ou com path muito raso.
   * Errado: https://valor.com.br, https://exame.com/, https://stratechery.com/
   * Certo:  https://valor.com.br/empresas/agronegocio/noticia/123
   */
  function isHomepageUrl(url: string): boolean {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/+$/, ""); // tira trailing slashes
      if (!path || path === "" || path === "/") return true;
      const segments = path.split("/").filter(Boolean);
      // 1 segmento curto (ex: /pt, /br) também é homepage de seção
      if (segments.length === 1 && segments[0].length <= 3) return true;
      return false;
    } catch {
      return true; // URL inválida — descarta
    }
  }

  const rows = parsed.ideas
    .map((idea) => ({
      user_id: user.id,
      title: String(idea.title ?? "").slice(0, 240),
      angle: String(idea.angle ?? "").slice(0, 1200),
      why_now: idea.why_now ? String(idea.why_now).slice(0, 600) : null,
      source_url: idea.source_url ? String(idea.source_url).slice(0, 600) : null,
      source_title: idea.source_title ? String(idea.source_title).slice(0, 240) : null,
      relevance_score:
        typeof idea.relevance_score === "number"
          ? Math.max(0, Math.min(100, Math.round(idea.relevance_score)))
          : 50,
    }))
    .filter((row) => row.title && row.angle)
    // Limpa source_url se for só homepage — UI mostra sem link em vez de mandar pra valor.com.br
    .map((row) => ({
      ...row,
      source_url:
        row.source_url && !isHomepageUrl(row.source_url) ? row.source_url : null,
    }));

  if (!rows.length) {
    return NextResponse.json({ error: "Ideias incompletas." }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("topic_suggestions")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ideas: data,
    sources_used: fetched.map((s) => ({ url: s.url, title: s.title })),
  });
}

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("topic_suggestions")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .order("relevance_score", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ideas: data ?? [] });
}
