/**
 * Polish pass — última passada antes de devolver o draft.
 * Combina 3 verificações que tendem a falhar separadas:
 *  1. Anti-clichê (pt-BR específico)
 *  2. Cut 20% — densidade
 *  3. Test sensorial — garantir 2+ imagens concretas
 *
 * Usa Sonnet (rápido + bom em editing).
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";

const PT_BR_CLICHES = [
  "no fim do dia",
  "no final do dia",
  "no fim das contas",
  "no final das contas",
  "ao final do dia",
  "em um mundo onde",
  "em um cenário cada vez mais",
  "no mundo dinâmico de hoje",
  "vivemos uma era",
  "nunca antes na história",
  "vale destacar",
  "vale a pena destacar",
  "é importante notar",
  "vale ressaltar",
  "como mencionado anteriormente",
  "venha conosco",
  "compartilho com vocês",
  "venho refletir",
  "trago hoje",
  "espero que esse conteúdo",
  "comente aí o que achou",
  "deixa sua opinião nos comentários",
  "você já parou pra pensar",
  "pensando nisso",
  "refletindo sobre",
  "jornada de aprendizado",
  "jornada de crescimento",
  "ecossistema",
  "stakeholder",
  "mindset",
  "disruptivo",
  "ownership",
  "accountability",
  "deliverar",
  "endereçar problema",
  "performar bem",
  "trazer valor",
  "tudo é sobre pessoas",
  "no fim, tudo é sobre",
];

const SYSTEM_PROMPT = `Você é um editor cruel. Recebe um draft em pt-BR e devolve uma versão melhor.

Três operações OBRIGATÓRIAS, nessa ordem:

1. ANTI-CLICHÊ: procura por essa lista de clichês e ELIMINA reescrevendo a frase inteira. Não parafraseia — reescreve a ideia.

[LISTA DE CLICHÊS:
${PT_BR_CLICHES.map((c) => `  - "${c}"`).join("\n")}]

Outros tells de IA pra cortar:
- Adjetivos vagos em série (3+ adjetivos seguidos)
- Frases com "que" supérfluo ("o time que está crescendo" → "time em crescimento")
- "Estamos vendo X" → "X aumenta"
- "Faz com que" → corte
- Advérbios em -mente substituíveis por verbo forte

2. CUT 20%: o draft tem fios soltos, repetição e frases que não pagam aluguel. Tire 20% mantendo a tese intacta. Cada frase que sobra precisa carregar peso. Prefere cortar do MEIO (não do início ou fim).

3. SENSORIAL CHECK: o texto precisa ter no mínimo 2 imagens CONCRETAS (hora, lugar, pessoa, objeto, número específico). Se tem zero ou uma, força inserir pelo menos uma cena concreta sem alongar.

Saída: APENAS o texto editado. Sem preâmbulo, sem markdown de meta-comentário, sem 'aqui está'. Texto pronto pra copiar e colar.`;

export async function polishPass(opts: {
  draft: string;
  format: "linkedin_post" | "article";
  notes?: string; // contexto extra (ex: "esse é o draft B com mood crítico")
}): Promise<string> {
  if (!opts.draft?.trim()) return opts.draft ?? "";

  const anthropic = getAnthropic();
  const userPrompt = `Formato: ${opts.format === "linkedin_post" ? "post de LinkedIn em pt-BR" : "artigo em pt-BR"}.
${opts.notes ? `Contexto: ${opts.notes}\n` : ""}
DRAFT a polir (anti-clichê + cut 20% + sensorial):

"""
${opts.draft}
"""

Devolva o texto polido apenas.`;

  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: opts.format === "linkedin_post" ? 1500 : 4500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  // Remove markdown fences que o modelo às vezes adiciona
  return text
    .replace(/^```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
