/**
 * Revisão em tempo real do texto manual do líder.
 *
 * Usa Sonnet 4.6 (FAST_MODEL) — precisa ser rápido (1-4s) e bom em JSON estruturado.
 *
 * Saída: lista de issues com tipo, trecho problemático, sugestão e localização,
 * mais um score de aderência de tom (0-100).
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import { buildLeaderSystemPrompt } from "@/lib/anthropic/prompts";

export type ReviewIssueKind =
  | "ai_trope"
  | "em_dash"
  | "passive_voice"
  | "weak_hook"
  | "vague_number"
  | "missing_opinion"
  | "off_voice"
  | "long_sentence"
  | "filler"
  | "off_audience";

export interface ReviewIssue {
  kind: ReviewIssueKind;
  severity: "info" | "warn" | "error";
  excerpt: string; // o trecho do texto onde o problema está
  message: string; // explicação curta
  suggestion?: string; // reescrita sugerida (opcional)
}

export interface ReviewResult {
  voice_match_score: number; // 0-100
  voice_notes: string; // 1-2 frases sobre aderência ao tom
  issues: ReviewIssue[]; // ordem do mais grave pro menos
}

const REVIEWER_PROMPT = `Você é o revisor anti-IA da Onfly. Sua única tarefa: analisar o texto do líder e devolver issues estruturadas.

Sua leitura segue ESTA HIERARQUIA:
1. Voice match — o texto soa como o líder descrito no system prompt? (mais importante)
2. Anti-IA — tem em dashes decorativos, paralelismos "não é X, é Y", três adjetivos em fila, frase tipo "no mundo dinâmico de hoje"?
3. Substância — tem opinião autoral, número específico, recorte concreto? Ou é só comentário genérico?
4. Audiência — fala com a audiência-alvo do líder, ou está abstrato demais?
5. Hook — a primeira linha prende? Frase forte, número específico, contradição.

REGRAS DE SAÍDA — JSON puro, NADA antes ou depois, NADA de markdown.

Schema:
{
  "voice_match_score": number 0-100,
  "voice_notes": "string — 1-2 frases sobre o quanto soa como o líder. Honesto, direto.",
  "issues": [
    {
      "kind": "ai_trope" | "em_dash" | "passive_voice" | "weak_hook" | "vague_number" | "missing_opinion" | "off_voice" | "long_sentence" | "filler" | "off_audience",
      "severity": "info" | "warn" | "error",
      "excerpt": "trecho EXATO do texto original (15-80 chars) onde o problema aparece",
      "message": "explicação curta (10-25 palavras) sem floreio",
      "suggestion": "reescrita curta do trecho (opcional, só inclua se for óbvio o que mudar)"
    }
  ]
}

CRITÉRIOS:
- Máximo 8 issues. Priorize os mais críticos. Não inunde.
- Severity error = trava a publicação (em dash decorativo, paralelismo negativo, AI trope óbvio, hook vazio).
- Severity warn = vale ajustar (frase longa, número vago, voz passiva).
- Severity info = preferência (palavra que cai melhor, ordem de parágrafo).
- Score 90+ = soa autoral e específico. Score 60-80 = decente mas genérico. Score abaixo de 60 = parece IA.
- Não invente problema. Se o texto estiver bom, devolva poucos issues e score alto.`;

export async function reviewText(opts: {
  userId: string;
  text: string;
  format: "linkedin_post" | "article";
}): Promise<ReviewResult | null> {
  if (opts.text.trim().length < 40) return null;

  const ctx = await loadLeaderContext(opts.userId);
  if (!ctx) return null;

  const system = buildLeaderSystemPrompt(ctx);
  const userPrompt = [
    `TAREFA: revisar o ${
      opts.format === "linkedin_post" ? "post de LinkedIn" : "artigo"
    } abaixo. O texto foi escrito (ou editado) MANUALMENTE pelo líder e ele quer feedback rápido antes de publicar.`,
    "",
    "TEXTO:",
    "```",
    opts.text.slice(0, 8000),
    "```",
    "",
    REVIEWER_PROMPT,
  ].join("\n");

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  return tryParseReview(raw);
}

function tryParseReview(raw: string): ReviewResult | null {
  const trimmed = raw.trim();
  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(trimmed);
  if (!parsed) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) parsed = tryParse(match[0]);
  }
  if (!parsed || typeof parsed !== "object") return null;

  const p = parsed as Partial<ReviewResult>;
  if (
    typeof p.voice_match_score !== "number" ||
    typeof p.voice_notes !== "string" ||
    !Array.isArray(p.issues)
  )
    return null;

  return {
    voice_match_score: Math.max(0, Math.min(100, Math.round(p.voice_match_score))),
    voice_notes: p.voice_notes,
    issues: p.issues
      .filter(
        (i): i is ReviewIssue =>
          !!i &&
          typeof i === "object" &&
          typeof (i as ReviewIssue).excerpt === "string" &&
          typeof (i as ReviewIssue).message === "string"
      )
      .slice(0, 8),
  };
}
