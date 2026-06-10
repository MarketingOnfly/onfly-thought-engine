/**
 * Retroalimentação do perfil a partir do feedback do líder.
 *
 * Sinais usados (do mais forte pro mais fraco):
 *  1. EDIÇÕES MANUAIS — pares (texto gerado → texto que o líder editou).
 *     É o sinal mais forte que existe: mostra EXATAMENTE o que o motor
 *     errou e como o líder corrigiu. Vira exemplo antes→depois.
 *  2. TAGS estruturadas — chips marcados no feedback (cara_de_ia,
 *     inventou_fato, jargao...). Sinal limpo, sem ambiguidade.
 *  3. Rating + comentário livre.
 *
 * Saída: learned_preferences com bullets ACIONÁVEIS, incluindo exemplos
 * concretos antes→depois quando há edição manual. LLM não muda
 * comportamento com regra abstrata ("evita jargão"); muda com exemplo
 * ("escreveu 'otimizar a alocação de budget', o líder trocou pra
 * 'decidir onde o dinheiro rende mais'").
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";

interface FeedbackSample {
  rating: number;
  comment: string | null;
  tags?: string[];
  draft_topic: string;
  draft_text: string | null;
  created_at: string;
}

export interface ManualEditPair {
  topic: string;
  before: string; // o que o motor gerou
  after: string; // o que o líder publicou/salvou após editar na mão
}

const TAG_LABELS: Record<string, string> = {
  cara_de_ia: "texto com cara de IA",
  inventou_fato: "inventou fato/número que não existia",
  ignorou_material: "ignorou o material anexado",
  jargao: "jargão demais",
  sem_historia: "faltou história/narrativa",
  hook_fraco: "hook fraco",
  tom_errado: "tom não é o do líder",
  muito_longo: "longo demais",
  muito_curto: "curto demais",
  generico: "genérico, qualquer um poderia ter escrito",
};

const SYSTEM_PROMPT = `Você analisa feedbacks que um líder deu sobre conteúdos gerados pra ele, MAIS as edições manuais que ele fez nos textos. Sua tarefa: extrair PREFERÊNCIAS REPLICÁVEIS pra calibrar as próximas gerações.

O sinal mais valioso são as EDIÇÕES MANUAIS (antes→depois): compare o que o motor gerou com o que o líder publicou e extraia o PADRÃO da mudança. Bullets baseados em diff valem mais que bullets baseados em comentário.

Devolva JSON puro com:
{
  "preferences": "string — 5 a 12 bullets começando com '-'. Cada bullet começa com 'Gosta:', 'Evita:' ou 'Troca:'. Quando o padrão veio de uma edição manual, INCLUA o mini-exemplo concreto no formato → 'Troca: [como o motor escreve] → [como o líder escreve]'."
}

Bons exemplos:
- "Troca: 'otimizar a alocação de budget' → 'decidir onde o dinheiro rende mais' (o líder sempre destecnifica)"
- "Evita: fechar com pergunta retórica. Nas 3 edições ele cortou a pergunta final e terminou na afirmação."
- "Gosta: hook com número que ELE forneceu no briefing, logo na primeira linha."
- "Evita: parágrafos com mais de 3 linhas. Ele quebra tudo em blocos menores."

Ruins (NÃO devolva):
- "Texto ficou bom" (vago)
- "Evita: termos técnicos" (abstrato demais — diga QUAIS e o que usar no lugar)

Regras:
- Priorize padrões que aparecem em MAIS DE UM sinal (ex: tag 'jargao' + edição que destecnifica = padrão forte).
- Ratings 4-5 = padrões a manter ('Gosta:'). Ratings 1-3, tags negativas e edições = padrões a corrigir ('Evita:'/'Troca:').
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
  samples: FeedbackSample[],
  editPairs: ManualEditPair[] = []
): Promise<string | null> {
  if (!samples.length && !editPairs.length) return null;

  const feedbackBlock = samples
    .map((s, i) => {
      const tagLine = s.tags?.length
        ? `PROBLEMAS MARCADOS (chips): ${s.tags.map((t) => TAG_LABELS[t] ?? t).join("; ")}`
        : null;
      return [
        `### Feedback ${i + 1} (${s.created_at}) — rating ${s.rating}/5`,
        `TEMA: ${s.draft_topic}`,
        tagLine,
        `COMENTÁRIO DO LÍDER: ${s.comment ?? "(sem comentário)"}`,
        `TEXTO GERADO (snippet):`,
        (s.draft_text ?? "(sem texto)").slice(0, 1200),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  const editsBlock = editPairs.length
    ? editPairs
        .map(
          (p, i) =>
            `### Edição manual ${i + 1} — TEMA: ${p.topic}\nO MOTOR GEROU:\n"""\n${p.before.slice(0, 1200)}\n"""\nO LÍDER EDITOU PARA:\n"""\n${p.after.slice(0, 1200)}\n"""`
        )
        .join("\n\n---\n\n")
    : null;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          editsBlock
            ? `EDIÇÕES MANUAIS DO LÍDER (sinal mais forte — extraia o PADRÃO de cada diff):\n\n${editsBlock}\n\n`
            : "",
          samples.length
            ? `HISTÓRICO DE FEEDBACK (mais recente primeiro):\n\n${feedbackBlock}\n\n`
            : "",
          "Sintetize as preferências replicáveis em bullets ('Gosta:'/'Evita:'/'Troca:'), com exemplos concretos antes→depois quando vierem de edição manual.",
        ].join(""),
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
  const parsed = tryParse(text);
  if (!parsed?.preferences) return null;
  // Cap maior que antes (1500→2500): os exemplos antes→depois ocupam
  // mais espaço e são o que realmente muda o comportamento do modelo.
  return parsed.preferences.slice(0, 2500);
}
