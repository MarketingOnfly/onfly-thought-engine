/**
 * Self-repair — fase 4 do pipeline de geração.
 *
 * Depois do polish, rodamos o `reviewText` (a mesma revisão em tempo real
 * que o líder usa no editor). Se o voice_match_score for baixo ou tiver
 * issue crítica, esta função recebe a lista de problemas e corrige
 * cirurgicamente — sem reescrever o texto inteiro.
 *
 * Usa Sonnet (FAST_MODEL) porque é editing pontual, não criação.
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import type { ReviewIssue } from "@/lib/anthropic/review";
import { applyHardRules } from "@/lib/anthropic/polish-pass";

const SYSTEM_PROMPT = `Você é um editor cirúrgico. Recebe um draft em pt-BR + uma lista de issues que um revisor anti-IA já identificou no próprio texto. Sua tarefa: corrigir EXATAMENTE essas issues, nada mais.

REGRAS DURAS:
- Não reescreva o texto inteiro. Faça micro-cirurgia: troque APENAS os trechos problemáticos.
- Mantenha o comprimento aproximado, a voz e a estrutura geral.
- Não introduza clichês novos pra "consertar". Se o problema é em dash, troque por ponto ou vírgula — não invente paralelismo "não é X, é Y".
- Preserve número específico, nome próprio, citação que já estejam no texto.
- Mantenha quebras de linha e parágrafos do original.
- Se uma issue não tem suggestion clara, use bom senso pt-BR de operador, sem floreio.
- Se duas issues conflitam, priorize a de severity mais alta.

Saída: APENAS o texto corrigido. Nada de preâmbulo, markdown de meta-comentário, JSON, "aqui está". Texto pronto pra publicar.`;

export async function selfRepair(opts: {
  draft: string;
  format: "linkedin_post" | "article";
  issues: ReviewIssue[];
  voiceNotes?: string;
  voiceMatchScore: number;
}): Promise<string> {
  if (!opts.draft?.trim() || !opts.issues.length) return opts.draft;

  const issuesText = opts.issues
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.severity.toUpperCase()} · ${i.kind}] "${i.excerpt}"
   Problema: ${i.message}${i.suggestion ? `\n   Sugestão: ${i.suggestion}` : ""}`
    )
    .join("\n\n");

  const userPrompt = [
    `Formato: ${
      opts.format === "linkedin_post" ? "post de LinkedIn pt-BR" : "artigo pt-BR"
    }`,
    `Voice match atual: ${opts.voiceMatchScore}/100`,
    opts.voiceNotes ? `Notas do revisor: ${opts.voiceNotes}` : null,
    "",
    "ISSUES IDENTIFICADAS (corrija EXATAMENTE essas, nada mais):",
    issuesText,
    "",
    "DRAFT ORIGINAL:",
    `"""`,
    opts.draft,
    `"""`,
    "",
    "Devolva o texto corrigido apenas.",
  ]
    .filter(Boolean)
    .join("\n");

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: opts.format === "linkedin_post" ? 1500 : 4500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const cleaned = text
    .replace(/^```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  return applyHardRules(cleaned);
}
