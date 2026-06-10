/**
 * VOICE CARD — cartão compacto de voz do líder (~300-500 tokens).
 *
 * Por que existe: o pipeline tem várias fases que REESCREVEM o texto
 * (polish, self-repair, fabrication-fix, realign). Até hoje essas fases
 * recebiam só o draft + regras genéricas anti-IA — NÃO conheciam o
 * líder. Cada reescrita por um editor "cego de voz" regredia o texto
 * pra prosa neutra de editor. Três reescritas em série = voz lavada.
 * Era a maior causa de "cara de IA" no texto final.
 *
 * O voice card é a versão destilada do perfil que CABE no system de
 * cada editor sem inflar custo. Toda fase que reescreve texto DEVE
 * receber este cartão.
 *
 * Isolamento entre líderes: o cartão é construído a partir do profile
 * carregado por loadLeaderContext(userId) — mesmo escopo per-user de
 * describeLeader(). Nada aqui vira constante global.
 */

import type { LeaderProfile } from "@/lib/db/types";
import { TONE_TRAITS, TONE_AVOID } from "@/lib/style-presets";

function labelize<T extends { key: string; label: string }>(
  items: readonly T[],
  keys: string[] | undefined | null
): string {
  if (!keys?.length) return "—";
  return keys.map((k) => items.find((i) => i.key === k)?.label ?? k).join(", ");
}

export function buildVoiceCard(profile: LeaderProfile): string {
  const traits = labelize(TONE_TRAITS, profile.tone_traits);
  const avoid = labelize(TONE_AVOID, profile.tone_avoid);

  // Trecho curto dos tone_examples — o som real da pessoa.
  // 600 chars bastam pra calibrar registro sem inflar o prompt.
  const toneSample = profile.tone_examples?.trim()
    ? profile.tone_examples.trim().slice(0, 600)
    : null;

  const learned = profile.learned_preferences?.trim() || null;

  return [
    `VOZ DO LÍDER (preserve em QUALQUER edição — editar nunca pode neutralizar a voz):`,
    `- Quem assina: ${profile.full_name}, ${profile.role}.`,
    `- Tom: ${traits}.`,
    `- NUNCA escreveria: ${avoid}.`,
    toneSample
      ? `- Como essa pessoa escreve de verdade (amostra real):\n"""\n${toneSample}\n"""`
      : null,
    learned
      ? `- Preferências aprendidas de feedbacks (respeite TODAS):\n${learned}`
      : null,
    ``,
    `REGRA DE EDIÇÃO: sua função é corrigir defeitos pontuais SEM apagar a personalidade. Se uma frase soa como esse líder, NÃO a "melhore" pra um neutro de editor. Irregularidade que é da voz dele fica. Em dúvida entre "mais limpo" e "mais parecido com a amostra", escolha a amostra.`,
  ]
    .filter(Boolean)
    .join("\n");
}
