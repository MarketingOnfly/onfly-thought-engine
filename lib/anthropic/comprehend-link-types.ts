/**
 * Types e helpers PUROS de LinkComprehension — extraídos do
 * comprehend-link.ts pra serem importáveis em CLIENT components
 * sem arrastar o Anthropic SDK no bundle do navegador.
 *
 * Histórico do bug que motivou esse split:
 * context-attachments.tsx (client) importava `LinkComprehension` e
 * `comprehensionAsPromptBlock` direto de comprehend-link.ts (server).
 * O bundler do Next puxava `getAnthropic` (que precisa de env vars
 * do servidor) pro bundle client e a página quebrava ao carregar com
 * "Application error: a client-side exception has occurred".
 *
 * Regra: tipos + funções puras (sem Anthropic / sem env var) ficam
 * aqui. comprehend-link.ts continua tendo o flow que chama Anthropic.
 */

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
  source_quality:
    | "primary"
    | "summary"
    | "press_release"
    | "ai_suspect"
    | "low_signal";
  comprehension_failed?: boolean;
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
    lines.push(
      `[${index + 1}] ${c.headline}${c.publication ? ` (${c.publication})` : ""}`
    );
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
