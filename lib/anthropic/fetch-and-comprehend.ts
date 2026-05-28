/**
 * Lê e compreende uma URL usando o CLAUDE DIRETAMENTE com web_search.
 *
 * Histórico: antes a gente tentava extractArticle (fetch + regex em HTML)
 * + comprehendLink (Sonnet processando o HTML stripped). Funcionava só
 * em ~60% dos sites — substack, cloudflare, paywall, SPA pesado quebravam
 * sistematicamente. Aí o motor INVENTAVA conteúdo pra preencher.
 *
 * Solução nova: deixa o Claude usar a tool web_search dele. Ela acessa
 * a URL como navegador real, lê o conteúdo, e devolve fatos. Funciona em
 * substack, paywall parcial, sites com cloudflare. Mais lento (~5-10s)
 * e mais caro (~$0.01 por chamada) mas EFETIVO.
 *
 * Fallback continua existindo no extract route — se essa função falhar,
 * tenta o caminho antigo. Mas essa É o caminho preferencial agora.
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import type { LinkComprehension, KeyQuote } from "@/lib/anthropic/comprehend-link";

const SYSTEM_PROMPT = `Você é um leitor crítico que extrai fatos de URLs. Use a ferramenta web_search pra ACESSAR a URL específica que o usuário fornecer e ler o conteúdo dela. Depois, devolva JSON puro com os fatos.

🔒 REGRA ZERO: NUNCA INVENTE NADA.
- Se a URL não puder ser acessada (privada, removida, bloqueada, paywall completo): devolva key_facts: [] e source_quality: "low_signal" com comprehension_failed: true.
- Se acessou MAS o conteúdo é pobre (só meta-tag SEO, página de erro, paywall mostrando só intro): também devolva comprehension_failed: true.
- SÓ preencha key_facts/key_quotes/named_entities com o que está LITERALMENTE no conteúdo que você LEU.
- PREFIRA arrays vazios a fatos inventados.

USO DA TOOL:
- Use web_search pra acessar a URL EXATA fornecida. Faça query tipo: "site:URL_DOMAIN URL_SLUG" ou pesquise pelo título do post se você conseguir inferir.
- Se a primeira busca não trouxer o conteúdo, faça uma 2ª busca mais específica (citação direta do título do post, palavras-chave do slug).
- Máximo 3 buscas. Se não achar, devolva comprehension_failed: true.

Schema do JSON de saída:
{
  "headline": "string — título exato do material em pt-BR (traduza se necessário)",
  "publication": "string|null — veículo (Substack do autor X, blog Y, etc)",
  "main_argument": "string — tese central em 1-2 frases pt-BR",
  "key_facts": [
    "5-12 fatos LITERAIS do conteúdo lido como frases nominais curtas em pt-BR. Inclua todo número, ano, nome próprio, decisão, lista numerada (ex: 'Primeiro erro listado: Não usar marcas pessoais pra publicar no LinkedIn', 'Autor sugere escolher 1-5 pessoas da empresa')."
  ],
  "key_quotes": [
    { "who": "Nome ou cargo", "quote": "Citação EXATA do conteúdo, máx 30 palavras" }
  ],
  "named_entities": ["Empresas/pessoas/produtos mencionados no conteúdo"],
  "ai_pattern_warnings": ["Tells de IA que VOCÊ percebe no texto da fonte"],
  "source_quality": "primary | summary | press_release | ai_suspect | low_signal",
  "comprehension_failed": "boolean - true se não conseguiu acessar de verdade"
}

Devolva APENAS o JSON. Sem markdown, sem explicação antes/depois.`;

function tryParse(text: string): Partial<LinkComprehension> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Remove cercas markdown se vier
    const cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
}

export async function fetchAndComprehendUrl(opts: {
  url: string;
  hintTitle?: string | null;
}): Promise<{ comprehension: LinkComprehension; rawText: string }> {
  const anthropic = getAnthropic();

  const userPrompt = `URL pra ler: ${opts.url}
${opts.hintTitle ? `Hint do título (pode ajudar na busca): "${opts.hintTitle}"` : ""}

Use a ferramenta web_search pra acessar essa URL e extrair os fatos do conteúdo.

Se conseguir acessar: devolve JSON com headline, main_argument, key_facts (todos os fatos literais), key_quotes (com atribuição), named_entities, source_quality, comprehension_failed=false.

Se NÃO conseguir acessar (paywall total, página vazia, 404): devolve JSON com comprehension_failed=true, key_facts=[], source_quality="low_signal".

NUNCA INVENTE. Só preenche o que VOCÊ LEU de verdade.`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 3500,
      system: SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ] as any,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    console.error("[fetch-and-comprehend] anthropic call failed", err);
    return {
      comprehension: {
        headline: opts.hintTitle ?? "Material",
        publication: null,
        main_argument: "Falha técnica ao chamar o modelo de leitura.",
        key_facts: [],
        key_quotes: [],
        named_entities: [],
        ai_pattern_warnings: [],
        source_quality: "low_signal",
        comprehension_failed: true,
      },
      rawText: "",
    };
  }

  // Junta todo o texto retornado (pode vir misturado com tool_use blocks)
  const textParts = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text);
  const fullText = textParts.join("\n").trim();

  const parsed = tryParse(fullText);

  if (!parsed) {
    return {
      comprehension: {
        headline: opts.hintTitle ?? "Material",
        publication: null,
        main_argument: "Não consegui estruturar a leitura da URL.",
        key_facts: [],
        key_quotes: [],
        named_entities: [],
        ai_pattern_warnings: [],
        source_quality: "low_signal",
        comprehension_failed: true,
      },
      rawText: fullText,
    };
  }

  const comprehension: LinkComprehension = {
    headline:
      (parsed.headline as string)?.trim() ||
      opts.hintTitle ||
      "Material",
    publication: (parsed.publication as string) ?? null,
    main_argument: (parsed.main_argument as string)?.trim() || "—",
    key_facts: Array.isArray(parsed.key_facts)
      ? parsed.key_facts.map(String).slice(0, 15)
      : [],
    key_quotes: Array.isArray(parsed.key_quotes)
      ? (parsed.key_quotes as unknown[])
          .filter(
            (q): q is KeyQuote =>
              typeof q === "object" &&
              q !== null &&
              typeof (q as KeyQuote).who === "string" &&
              typeof (q as KeyQuote).quote === "string"
          )
          .slice(0, 8)
      : [],
    named_entities: Array.isArray(parsed.named_entities)
      ? parsed.named_entities.map(String).slice(0, 10)
      : [],
    ai_pattern_warnings: Array.isArray(parsed.ai_pattern_warnings)
      ? parsed.ai_pattern_warnings.map(String).slice(0, 5)
      : [],
    source_quality:
      (parsed.source_quality as LinkComprehension["source_quality"]) ??
      "summary",
    comprehension_failed: !!parsed.comprehension_failed,
  };

  // Monta texto cru de exibição a partir dos fatos extraídos
  const rawText = [
    comprehension.headline,
    comprehension.publication ? `Publicação: ${comprehension.publication}` : "",
    `\nTese central: ${comprehension.main_argument}`,
    "\nFatos extraídos:",
    ...comprehension.key_facts.map((f, i) => `${i + 1}. ${f}`),
    comprehension.key_quotes.length > 0 ? "\nCitações:" : "",
    ...comprehension.key_quotes.map((q) => `— ${q.who}: "${q.quote}"`),
  ]
    .filter(Boolean)
    .join("\n");

  return { comprehension, rawText };
}
