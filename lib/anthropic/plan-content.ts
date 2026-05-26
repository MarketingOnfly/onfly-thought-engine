/**
 * Pre-write planning — antes de escrever, o Opus pensa.
 * Devolve estrutura, tensão e fato concreto a usar.
 * Esse plano vira contexto da fase de execução (Sonnet).
 */

import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import type { LeaderProfile } from "@/lib/db/types";

export interface ContentPlan {
  audience_specific: string;
  tension: string;
  key_facts: string[];
  structural_arc: string;
  sensory_imagery: string[];
  closing_intent: string;
  mood_signature: string;
}

const SYSTEM_PROMPT = `Você é um editor sênior planejando o esqueleto de um post antes da redação. Não escreva o post. Planeje.

Devolva JSON puro com:
{
  "audience_specific": "string — quem é o leitor IDEAL desse post (cargo + momento + dor). Específico, não 'profissionais B2B'.",
  "tension": "string — qual é a tensão central? O que está em jogo? Por que essa ideia importa AGORA? 1-2 frases.",
  "key_facts": ["3-5 fatos concretos que devem entrar — número específico, nome próprio, data, valor. Se inventar, marca '(verificar)'."],
  "structural_arc": "string — esqueleto em 3-5 beats. Ex: 'cena → contradição → dado → tese → fechamento provocativo'.",
  "sensory_imagery": ["2-4 imagens concretas pra ancorar o leitor — hora, lugar, pessoa, objeto palpável."],
  "closing_intent": "string — qual a frase-tese ou pergunta que fica? O leitor sai com qual frase na cabeça?",
  "mood_signature": "string — qual o estado emocional dominante? (ex: 'crítico curioso', 'otimista cansado', 'irritado mas com humor'). Deve combinar com o tom registrado do líder."
}

Critérios:
- Plano deve ser ESPECÍFICO o suficiente pra a execução não ter ambiguidade.
- Se key_facts for vazio, escreve um placeholder ("verificar via web_search ou substituir por experiência operacional do líder").
- mood_signature é única em cada plano, não um clichê.`;

function tryParse(text: string): Partial<ContentPlan> | null {
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

export async function planContent(opts: {
  format: "linkedin_post" | "article";
  topic: string;
  brief: string | null;
  leader: LeaderProfile;
}): Promise<ContentPlan> {
  const anthropic = getAnthropic();
  const leaderSnapshot = `LÍDER: ${opts.leader.full_name}, ${opts.leader.role} em ${opts.leader.area}.
TOM: ${opts.leader.tone_traits.join(", ")}.
AUDIÊNCIA: ${opts.leader.target_audience}.
PILARES: ${opts.leader.themes.join(", ")}.
APRENDIDO (PRIORIDADE): ${opts.leader.learned_preferences ?? "(nenhum)"}.
NUNCA ESCREVE: ${opts.leader.tone_avoid.join(", ")}.`;

  const response = await anthropic.messages.create({
    model: MODEL, // Opus pra pensar bem o plano
    max_tokens: 1800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Planeje um ${opts.format === "linkedin_post" ? "POST" : "ARTIGO"} sobre:\n\nTEMA: ${opts.topic}\n${opts.brief ? `BRIEFING: ${opts.brief}\n` : ""}\n${leaderSnapshot}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const parsed = tryParse(text);
  return {
    audience_specific:
      parsed?.audience_specific?.toString() ?? opts.leader.target_audience,
    tension: parsed?.tension?.toString() ?? "—",
    key_facts: Array.isArray(parsed?.key_facts)
      ? parsed.key_facts.map(String).slice(0, 6)
      : [],
    structural_arc: parsed?.structural_arc?.toString() ?? "—",
    sensory_imagery: Array.isArray(parsed?.sensory_imagery)
      ? parsed.sensory_imagery.map(String).slice(0, 5)
      : [],
    closing_intent: parsed?.closing_intent?.toString() ?? "—",
    mood_signature: parsed?.mood_signature?.toString() ?? "—",
  };
}

export function planAsPromptContext(plan: ContentPlan): string {
  return `PLANO ESTRATÉGICO (já aprovado — siga ao pé da letra):
- Audiência específica: ${plan.audience_specific}
- Tensão central: ${plan.tension}
- Fatos concretos a usar: ${plan.key_facts.map((f) => `· ${f}`).join("\n  ") || "(nenhum — use experiência operacional)"}
- Arco estrutural: ${plan.structural_arc}
- Imagens sensoriais (USE pelo menos 2 dessas no texto):
  ${plan.sensory_imagery.map((i) => `· ${i}`).join("\n  ") || "(sem imagens — invente algo concreto)"}
- Intenção do fechamento: ${plan.closing_intent}
- Assinatura de humor: ${plan.mood_signature}`;
}
