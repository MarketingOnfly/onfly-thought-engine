/**
 * Retroalimentação do perfil a partir do feedback do líder.
 *
 * A cada feedback novo (rating 1-5 + comentário opcional), a gente:
 * 1. Coleta os últimos N feedbacks + drafts associados
 * 2. Pede ao Claude pra sintetizar 5-10 bullets curtos do tipo
 *    "gosta de X / evita Y" baseado em rating + comentário + amostra
 * 3. Grava em leader_profiles.learned_preferences
 * 4. Esse texto entra no system prompt das próximas gerações
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";

interface FeedbackSample {
  rating: number;
  comment: string | null;
  draft_topic: string;
  draft_text: string | null;
  created_at: string;
}

const SYSTEM_PROMPT = `Você analisa feedbacks que um líder deu sobre conteúdos gerados pra ele. Sua tarefa: extrair PREFERÊNCIAS REPLICÁVEIS pra calibrar as próximas gerações.

Devolva JSON puro com:
{
  "preferences": "string — 5 a 10 bullets curtos começando com '-'. Cada bullet começa com 'Gosta:' ou 'Evita:' e descreve um padrão concreto. SEM elogio genérico ('escrita boa'), SEM repetir o feedback bruto."
}

Bons exemplos:
- "Gosta: hook com número específico no primeiro parágrafo"
- "Gosta: parágrafos de 2 linhas com quebra visual"
- "Evita: fechamento com pergunta retórica genérica"
- "Evita: usar 'no fim do dia', 'no mundo dinâmico'"
- "Evita: posts acima de 1200 caracteres"

Ruins (NÃO devolva):
- "Texto ficou bom" (vago)
- "Pediu pra revisar" (não é padrão)

Regras:
- Se o histórico for curto/incompleto, devolva o que conseguir (mesmo 2-3 bullets).
- Priorize padrões que aparecem em MAIS DE UM feedback.
- Ratings 4-5 = padrões a manter ('Gosta:'). Ratings 1-3 + comentário negativo = padrões a evitar ('Evita:').
- Português brasileiro, voz direta.`;

function tryParse(text: string): { preferences?: string } | null {
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

export async function learnFromFeedback(
  samples: FeedbackSample[]
): Promise<string | null> {
  if (!samples.length) return null;

  const payload = samples
    .map(
      (s, i) =>
        `### Feedback ${i + 1} (${s.created_at}) — rating ${s.rating}/5
TEMA: ${s.draft_topic}
COMENTÁRIO DO LÍDER: ${s.comment ?? "(sem comentário)"}
TEXTO GERADO (snippet):
${(s.draft_text ?? "(sem texto)").slice(0, 1500)}`
    )
    .join("\n\n---\n\n");

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Histórico de feedback do líder (mais recente primeiro):\n\n${payload}\n\nSintetize as preferências replicáveis em bullets.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
  const parsed = tryParse(text);
  if (!parsed?.preferences) return null;
  // limita pra não estourar prompt
  return parsed.preferences.slice(0, 1500);
}
