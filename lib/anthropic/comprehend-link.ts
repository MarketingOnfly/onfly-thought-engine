/**
 * Compreensão estruturada de link/material.
 *
 * Recebe texto extraído cru de uma notícia/artigo/vídeo/PDF e usa o
 * Claude pra LER de verdade. Devolve JSON estruturado com:
 *  - main_argument: a tese do material em 1-2 frases
 *  - key_facts: números, datas, decisões nomeadas (cada um citável)
 *  - key_quotes: citações com atribuição (quem disse)
 *  - named_entities: empresas, pessoas, produtos mencionados
 *  - ai_pattern_warnings: tells de IA que a fonte original tem
 *  - source_quality: nossa avaliação de origem
 *
 * Esse JSON SUBSTITUI o texto bruto no prompt de geração. O líder pediu
 * mudança no modelo inteiro porque o texto cru contaminava o estilo do
 * draft. Agora o modelo só vê FATOS, não escreve em cima de prosa AI.
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";

export interface KeyQuote {
  who: string;
  quote: string;
}

export interface LinkComprehension {
  headline: string;
  publication: string | null;
  main_argument: string;
  key_facts: string[];
  key_quotes: KeyQuote[];
  named_entities: string[];
  ai_pattern_warnings: string[];
  source_quality: "primary" | "summary" | "press_release" | "ai_suspect" | "low_signal";
  comprehension_failed?: boolean;
}

const SYSTEM_PROMPT = `Você é um leitor crítico que extrai FATOS de um material. Devolve JSON puro, sem markdown.

Sua tarefa: ler o texto recebido (notícia, transcrição de vídeo, PDF, etc.) e devolver uma estrutura limpa que outro modelo vai usar pra escrever um post de LinkedIn em pt-BR. Quem vai escrever NÃO PODE VER o texto bruto. Só vê o JSON que você devolver. Por isso, sua extração precisa ser:

1. COMPLETA em fatos: cada número, ano, nome próprio, decisão tomada, declaração nomeada precisa estar no JSON.
2. LIMPA de estilo: não copie a prosa da fonte. Reescreva cada fato em frase nominal seca ("CAC subiu 35% em Q3 2025").
3. ANTI-FABRICAÇÃO: se um fato não aparece literalmente no texto, NÃO o invente. Só o que estiver lá.

Schema:
{
  "headline": "string — manchete / título do material em pt-BR (traduz se necessário)",
  "publication": "string|null — veículo/canal (Exame, Bloomberg, podcast X), se identificável",
  "main_argument": "string — qual a TESE do material em 1-2 frases. Sem floreio. Em pt-BR.",
  "key_facts": [
    "5-12 fatos concretos como frases nominais curtas em pt-BR. Inclua TODO número específico, ano, percentual, valor financeiro, decisão pública. Ex: 'Magalu demitiu 1.500 pessoas em outubro/2025', 'Ticket médio subiu 47% em 6 meses'."
  ],
  "key_quotes": [
    { "who": "Nome ou cargo da pessoa", "quote": "Citação curta, máximo 25 palavras, EXATA do material" }
  ],
  "named_entities": [
    "Empresas, pessoas, produtos nomeados (até 10). Ex: 'Magalu', 'Frederico Trajano', 'iFood'"
  ],
  "ai_pattern_warnings": [
    "Liste padrões de IA que VOCÊ percebe no texto da fonte (em dashes, 'não é X, é Y', 'no fim do dia', floreio). Isso ajuda quem for escrever a não imitar."
  ],
  "source_quality": "primary | summary | press_release | ai_suspect | low_signal"
}

Regras:
- Se o material está vazio, em paywall, ou é só meta-tag de SEO, devolva source_quality="low_signal" e key_facts=[].
- "primary": entrevista, declaração direta, reportagem com fonte original.
- "summary": agregação que cita outros veículos.
- "press_release": comunicado de imprensa de uma empresa sobre si própria.
- "ai_suspect": prosa com muito em dash / "não é X, é Y" / abstração genérica = provavelmente IA-gerado, baixa confiabilidade.
- "low_signal": texto pobre, paywall, página vazia, ou veiculação sem fato concreto.
- key_quotes só com atribuição nominal explícita. Se não tem quem disse, não cite.
- Em pt-BR direto. Sem floreio.`;

function tryParse(text: string): Partial<LinkComprehension> | null {
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
 * Lê o material e devolve a compreensão estruturada.
 * Se o texto for muito pobre (< 200 chars úteis) ou falhar parse,
 * devolve comprehension com source_quality="low_signal" e
 * comprehension_failed=true pro caller decidir fallback.
 */
export async function comprehendLink(opts: {
  rawText: string;
  hintTitle?: string | null;
  hintUrl?: string | null;
  kind: "youtube" | "news" | "pdf" | "discovery";
}): Promise<LinkComprehension> {
  const raw = (opts.rawText ?? "").trim();

  // Curto-circuito: texto vazio ou ridiculamente curto
  if (raw.length < 200) {
    return {
      headline: opts.hintTitle ?? "Material sem conteúdo extraído",
      publication: null,
      main_argument: "Material vazio ou em paywall. Não foi possível ler.",
      key_facts: [],
      key_quotes: [],
      named_entities: [],
      ai_pattern_warnings: [],
      source_quality: "low_signal",
      comprehension_failed: true,
    };
  }

  const kindLabel =
    opts.kind === "youtube"
      ? "transcrição de vídeo do YouTube"
      : opts.kind === "pdf"
        ? "PDF"
        : opts.kind === "discovery"
          ? "fonte de descoberta"
          : "matéria/notícia";

  const userPrompt = `Material extraído (${kindLabel}):
${opts.hintTitle ? `\nTÍTULO/HINT: ${opts.hintTitle}` : ""}
${opts.hintUrl ? `URL: ${opts.hintUrl}\n` : ""}

CONTEÚDO BRUTO (limpe o estilo, extraia só fatos):
"""
${raw.slice(0, 12000)}
"""

Devolva o JSON estruturado.`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    const parsed = tryParse(text);
    if (!parsed) {
      return {
        headline: opts.hintTitle ?? "Material",
        publication: null,
        main_argument: "Não consegui estruturar o material.",
        key_facts: [],
        key_quotes: [],
        named_entities: [],
        ai_pattern_warnings: [],
        source_quality: "low_signal",
        comprehension_failed: true,
      };
    }

    return {
      headline:
        (parsed.headline as string)?.trim() ||
        opts.hintTitle ||
        "Material",
      publication: (parsed.publication as string) ?? null,
      main_argument:
        (parsed.main_argument as string)?.trim() || "—",
      key_facts: Array.isArray(parsed.key_facts)
        ? parsed.key_facts.map(String).slice(0, 12)
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
            .slice(0, 6)
        : [],
      named_entities: Array.isArray(parsed.named_entities)
        ? parsed.named_entities.map(String).slice(0, 10)
        : [],
      ai_pattern_warnings: Array.isArray(parsed.ai_pattern_warnings)
        ? parsed.ai_pattern_warnings.map(String).slice(0, 5)
        : [],
      source_quality:
        ((parsed.source_quality as LinkComprehension["source_quality"]) ??
          "summary") as LinkComprehension["source_quality"],
    };
  } catch (err) {
    console.error("[comprehend-link] failed", err);
    return {
      headline: opts.hintTitle ?? "Material",
      publication: null,
      main_argument: "Falha na compreensão do material.",
      key_facts: [],
      key_quotes: [],
      named_entities: [],
      ai_pattern_warnings: [],
      source_quality: "low_signal",
      comprehension_failed: true,
    };
  }
}

/**
 * Formata a compreensão como bloco de prompt pra injetar no contexto da
 * geração. SUBSTITUI o texto bruto que ia antes.
 */
export function comprehensionAsPromptBlock(
  items: Array<{ comprehension: LinkComprehension; index: number }>
): string {
  if (!items.length) return "";

  const blocks = items.map(({ comprehension: c, index }) => {
    const lines: string[] = [];
    lines.push(`[${index + 1}] ${c.headline}${c.publication ? ` (${c.publication})` : ""}`);
    lines.push(`Qualidade da fonte: ${c.source_quality}`);
    lines.push(`Tese do material: ${c.main_argument}`);
    if (c.key_facts.length > 0) {
      lines.push(`Fatos CITÁVEIS (use ao menos 1 no draft):`);
      c.key_facts.forEach((f, i) => lines.push(`  ${i + 1}. ${f}`));
    }
    if (c.key_quotes.length > 0) {
      lines.push(`Citações nominais (use entre aspas com atribuição):`);
      c.key_quotes.forEach((q) => lines.push(`  — ${q.who}: "${q.quote}"`));
    }
    if (c.named_entities.length > 0) {
      lines.push(`Entidades nomeadas: ${c.named_entities.join(", ")}`);
    }
    if (c.ai_pattern_warnings.length > 0) {
      lines.push(
        `ATENÇÃO — a fonte original tinha esses tells de IA (NÃO IMITE):`
      );
      c.ai_pattern_warnings.forEach((w) => lines.push(`  ! ${w}`));
    }
    return lines.join("\n");
  });

  return [
    "MATERIAIS EXTRAÍDOS E ESTRUTURADOS (fato, não estilo):",
    "",
    "REGRA DURA — leitura ativa:",
    "1. Esses materiais foram lidos e destilados em fatos. NÃO existe mais texto bruto pra você imitar estilo.",
    "2. Se o líder anexou um material, o draft DEVE citar pelo menos UM fact específico (número, nome próprio, citação com atribuição). Sem isso, o post não comprova que você leu.",
    "3. Citação direta entre aspas SÓ se tiver atribuição nominal (de key_quotes). Nunca cite prosa genérica.",
    "4. Se source_quality=ai_suspect ou low_signal, use o material com cautela: cite só fact verificável, ignore análise da fonte.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
