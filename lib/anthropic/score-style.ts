/**
 * Auto-avaliação do draft contra o estilo do líder.
 * Devolve overall (0-100), matches (o que casou) e gaps (o que escapou).
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import type { LeaderProfile } from "@/lib/db/types";
import { TONE_TRAITS, TONE_AVOID } from "@/lib/style-presets";

interface RawScore {
  overall?: unknown;
  matches?: unknown;
  gaps?: unknown;
}

function tryParse(text: string): RawScore | null {
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

function labelize<T extends { key: string; label: string }>(
  items: readonly T[],
  keys: string[] | undefined | null
): string {
  if (!keys?.length) return "—";
  return keys.map((k) => items.find((i) => i.key === k)?.label ?? k).join(", ");
}

export async function scoreStyle(opts: {
  draftText: string;
  profile: LeaderProfile;
}): Promise<{
  overall: number;
  matches: string[];
  gaps: string[];
}> {
  const traits = labelize(TONE_TRAITS, opts.profile.tone_traits);
  const avoid = labelize(TONE_AVOID, opts.profile.tone_avoid);
  const learned = opts.profile.learned_preferences ?? "(nenhuma ainda)";

  const SYSTEM = `Você é um avaliador severo de aderência ao estilo. Devolve JSON puro, sem markdown.

Schema:
{
  "overall": número 0-100 (quanto o texto soa como esse líder específico),
  "matches": ["até 5 bullets do que CASOU com o estilo dele — ex: 'hook com número específico', 'frase curta isolada no 2º parágrafo'"],
  "gaps": ["até 5 bullets do que ESCAPOU — ex: 'usou 'no fim do dia' (no avoid list)', 'fechamento com pergunta retórica genérica', 'parágrafo de 32 palavras (acima do padrão dele)' "]
}

Critérios:
- Avalie SÓ contra o estilo do líder, não a qualidade absoluta.
- Se o texto repetir padrões da seção 'Preferências aprendidas', vai pra matches.
- Se violar coisas do 'NUNCA escreveria' ou contradisser as preferências, vai pra gaps.
- overall < 60 = significativamente fora. overall > 85 = colado no estilo.
- Em pt-BR, voz direta, sem floreio.`;

  const userText = `ESTILO DO LÍDER:
- Traços de tom: ${traits}
- NUNCA escreveria: ${avoid}
- Exemplos próprios de tom: ${opts.profile.tone_examples ?? "(nenhum)"}
- Preferências aprendidas (PRIORIDADE):
${learned}

TEXTO A AVALIAR:
"""
${opts.draftText.slice(0, 6000)}
"""`;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const parsed = tryParse(text);
  if (!parsed) {
    return { overall: 50, matches: [], gaps: ["Não consegui avaliar o estilo automaticamente."] };
  }

  const overall = Math.max(
    0,
    Math.min(100, Math.round(Number(parsed.overall) || 50))
  );
  const matches = Array.isArray(parsed.matches)
    ? parsed.matches.map(String).slice(0, 5)
    : [];
  const gaps = Array.isArray(parsed.gaps)
    ? parsed.gaps.map(String).slice(0, 5)
    : [];
  return { overall, matches, gaps };
}
