/**
 * Polish pass — última passada antes de devolver o draft.
 * Combina 3 verificações que tendem a falhar separadas:
 *  1. Anti-clichê (pt-BR específico)
 *  2. Cut 20% — densidade
 *  3. Test sensorial — garantir 2+ imagens concretas
 *
 * Usa Sonnet (rápido + bom em editing).
 *
 * IMPORTANTE: `applyHardRules()` roda DEPOIS de qualquer resposta LLM,
 * de forma determinística (regex). Não depende do modelo seguir instrução.
 * Toda saída de texto gerado/revisado deve passar por essa função.
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";

/**
 * Filtros determinísticos que o LLM às vezes ignora mesmo com instrução explícita.
 * Aplicados DEPOIS da resposta do modelo — são operações de string, não IA.
 * Exportado pra ser usado em todos os endpoints que devolvem texto gerado.
 */
export function applyHardRules(text: string): string {
  let result = text;

  // ─── EM DASH (—) PROIBIDO ──────────────────────────────────────────────────
  // O caracter U+2014 não deve aparecer em NENHUM contexto no output.
  // Substituição em cascata do mais específico pro mais geral.

  // 1. "palavra — palavra" (espaço-emdash-espaço) → vírgula
  result = result.replace(/ — /g, ", ");

  // 2. "frase —\n" ou "frase —" no final → ponto
  result = result.replace(/ —(\n|$)/gm, ".$1");

  // 3. "^— item" no início de linha (bullet mal-feito) → "→ item"
  result = result.replace(/^—(?=\s)/gm, "→");

  // 4. "palavra—palavra" (sem espaço) → "palavra, palavra"
  result = result.replace(/(\p{L})—(\p{L})/gu, "$1, $2");

  // 5. Qualquer em dash remanescente → vírgula
  result = result.replace(/—/g, ", ");

  // ─── LIMPEZA PÓS-SUBSTITUIÇÃO ─────────────────────────────────────────────
  // Vírgulas duplicadas que podem surgir ex: ", ,"
  result = result.replace(/, ,/g, ",");
  // Espaços duplos
  result = result.replace(/  +/g, " ");
  // Espaço antes de vírgula ou ponto (ex: "palavra ,")
  result = result.replace(/ ([,.])/g, "$1");

  return result.trim();
}

/**
 * Detecta padrões de CONTRAPOSIÇÃO PARALELA estilo IA ("não é X, é Y",
 * "mais do que X, é Y", "não se trata de X, mas Y") no texto. Esses
 * padrões são o segundo maior tell de IA depois do em dash.
 *
 * Não substitui automaticamente (a quebra precisa ser feita pelo modelo
 * com contexto). Devolve as ocorrências encontradas pra serem citadas
 * no polish e re-escritas com inteligência.
 */
export function detectContraposicao(text: string): string[] {
  const PATTERNS = [
    // "não é X, é Y" / "não é só X, é Y" / "não é apenas X, é Y"
    /\bnão\s+(?:é|são|foi|era|eram)\s+(?:só|apenas|somente)?\s*[^,.;]{2,40},\s*(?:é|são|foi|era|eram|mas|e\s+sim)\s/gi,
    // "não se trata de X, (mas|é) Y"
    /\bnão\s+se\s+trata\s+de\s+[^,.;]{2,40},\s*(?:mas|é)\s/gi,
    // "mais do que X, é Y" / "mais do que X, Y é"
    /\bmais\s+do\s+que\s+[^,.;]{2,40},\s+(?:é|são|foi|isso)\s/gi,
    // "não é sobre X, é sobre Y"
    /\bnão\s+é\s+sobre\s+[^,.;]{2,40},\s+é\s+sobre\s/gi,
    // "isso não é X, é Y" / "isto não é"
    /\b(?:isso|isto|esse|este|essa|esta)\s+não\s+é\s+(?:só|apenas|somente)?\s*[^,.;]{2,40},\s+é\s/gi,
    // "não apenas X, mas (também) Y"
    /\bnão\s+apenas\s+[^,.;]{2,40},\s+mas\s+(?:também\s+)?/gi,
  ];

  const hits: string[] = [];
  for (const pattern of PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        hits.push(m.trim());
      }
    }
  }
  return Array.from(new Set(hits)).slice(0, 8); // dedup + limita
}

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

QUATRO operações OBRIGATÓRIAS, nessa ordem:

1. ANTI-CLICHÊ: procura por essa lista de clichês e ELIMINA reescrevendo a frase inteira. Não parafraseia — reescreve a ideia.

[LISTA DE CLICHÊS pt-BR:
${PT_BR_CLICHES.map((c) => `  - "${c}"`).join("\n")}]

REGRA ABSOLUTA DE PONTUAÇÃO — ANTES DE TUDO:
- Em dash (—, U+2014) é PROIBIDO. Substitua SEMPRE: vírgula, ponto ou ponto-e-vírgula.
  ✗ "O sistema, criado em 2023, mudou tudo." (errado, tinha em dash)
  ✓ "O sistema, criado em 2023, mudou tudo."
  Procure TODOS os "—" no texto e elimine-os um a um antes de continuar.

REGRA ABSOLUTA DE CONTRAPOSIÇÃO PARALELA — segundo maior tell de IA:
- PROIBIDO usar qualquer variante de "não é X, é Y" / "não se trata de X, é Y" / "mais do que X, é Y" / "não apenas X, mas Y" / "não é só X, é Y" / "isso não é X, é Y".
  Essas construções são a estrutura favorita da IA pra criar "profundidade" barata. Líder humano NÃO escreve assim.
- COMO QUEBRAR: vire em duas frases independentes, OU corte um dos lados, OU reformule sem paralelismo.
  ✗ "Não é sobre cortar custo, é sobre eficiência." → ✓ "Eficiência rende mais que cortar custo."
  ✗ "Mais do que ferramenta, é processo." → ✓ "É processo. Ferramenta resolve depois."
  ✗ "Isso não é só performance, é estratégia." → ✓ "Isso é estratégia. Performance vem como consequência."
  ✗ "Não se trata de medir tudo, é sobre medir o certo." → ✓ "Mede o certo. Não tudo."
- Procure TODA ocorrência desse padrão no texto e reescreva. Zero ocorrências é o único resultado aceitável.

Outros tells de IA pra cortar (lista do skill /humanizer):
- Adjetivos vagos em série (3+ adjetivos seguidos) — escolha UM ou troque por dado concreto
- Frases com "que" supérfluo ("o time que está crescendo" → "time em crescimento")
- "Estamos vendo X" → "X aumenta"
- "Faz com que" → corte
- Advérbios em -mente substituíveis por verbo forte
- Copula avoidance: "serve como", "atua como", "representa um marco" → vire "é"
- Paralelismo negativo: "não apenas X, mas Y" → quebre em duas frases
- Signposting: "vamos mergulhar", "aqui está o que você precisa saber" → corte
- Bajulação: "ótima pergunta", "absolutamente" → corte
- Meta-comentário: "vale destacar", "é importante notar" → corte
- Inline-header listas: "**Título:** explicação repetindo título" → vire prosa
- Tropos de autoridade: "o verdadeiro X é", "no fim das contas X" → diga o ponto direto

VOCABULÁRIO BANIDO (palavras IA-coded em pt-BR — corte ou substitua):
- jornada, ecossistema, vibrante, intricado, robusto, holístico, sinergia, fomentar, alavancar, pivotal, contemplar, exemplifica, panorama, marca indelével, abraçar (figurado)
- Anglicismos crus: leverage, deliver value, drive results, unlock, empower, seamless, cutting-edge, game-changer, stakeholder, mindset, deep dive

2. CUT 20%: o draft tem fios soltos, repetição e frases que não pagam aluguel. Tire 20% mantendo a tese intacta. Cada frase que sobra precisa carregar peso. Prefere cortar do MEIO (não do início ou fim).

3. SENSORIAL CHECK: o texto precisa ter no mínimo 2 imagens CONCRETAS (hora, lugar, pessoa, objeto, número específico). Se tem zero ou uma, força inserir pelo menos uma cena concreta sem alongar.

4. SELF-CHECK ANTI-IA FINAL (do skill /humanizer):
   Faça mentalmente: "Quais 3 partes desse texto ainda soam mais como IA?" — reescreve essas 3 partes.
   Verifique uniformidade de parágrafos: se 4+ parágrafos têm tamanho parecido, quebre 2-3 em frases isoladas ou junte numa só.
   Verifique vocabulário: alguma frase usa termo abstrato quando podia usar termo concreto? Troca.
   Verifique se você FALARIA cada frase no Slack: as que não, reescreve em pt-BR de operador.

5. CAÇA À RULE-OF-THREE (regra dura — IA adora tripla, humano não):
   Procure padrões de três elementos com estrutura paralela:
   - "Não preço. Não destino. Não desvio." → tripla negativa, mantenha 1, quebre as outras
   - "Budget anual... Política... Negociação..." → tripla nominal, mantenha 1 ou 2
   - "Faz X. Faz Y. Faz Z." → tripla verbal, vire em 2 frases
   - 3 bullets com estrutura idêntica → vire em prosa OU varie o tamanho dos bullets
   REGRA: máximo UMA tripla paralela no texto inteiro. Conte explicitamente e quebre as extras.

6. CAÇA A NÚMEROS INVENTADOS:
   Cada número específico que aparece no texto precisa ter origem clara do contexto.
   Se você NÃO consegue justificar de onde veio um número, troque por:
   - "[a confirmar]" (placeholder pro líder preencher)
   - Qualitativo concreto ("dobrou em 3 anos" em vez de "mais que dobrou de R$ 1.380 pra R$ 2.847")
   "1h32m de aprovação" / "R$ 2.847" / "60% Nordeste" — se não veio do input, vira veneno de credibilidade.

Saída: APENAS o texto editado. Sem preâmbulo, sem markdown de meta-comentário, sem 'aqui está'. Texto pronto pra copiar e colar.`;

export async function polishPass(opts: {
  draft: string;
  format: "linkedin_post" | "article";
  notes?: string; // contexto extra (ex: "esse é o draft B com mood crítico")
}): Promise<string> {
  if (!opts.draft?.trim()) return opts.draft ?? "";

  // Detecta contraposições paralelas no draft antes de mandar pro polish.
  // Se tiver, força o modelo a reescrever ESPECIFICAMENTE essas ocorrências.
  const contraposicoes = detectContraposicao(opts.draft);
  const contraposicoesHint = contraposicoes.length
    ? `\n\nALERTA — JÁ DETECTEI ${contraposicoes.length} CONTRAPOSIÇÃO(ÕES) PARALELA(S) NO DRAFT (padrão "não X, é Y"). REESCREVA CADA UMA EM DUAS FRASES SEPARADAS ANTES DE QUALQUER OUTRA EDIÇÃO:\n${contraposicoes.map((c, i) => `  ${i + 1}. "${c}..."`).join("\n")}\n`
    : "";

  const anthropic = getAnthropic();
  const userPrompt = `Formato: ${opts.format === "linkedin_post" ? "post de LinkedIn em pt-BR" : "artigo em pt-BR"}.
${opts.notes ? `Contexto: ${opts.notes}\n` : ""}${contraposicoesHint}
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
  const cleaned = text
    .replace(/^```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // Aplica filtros determinísticos (ex: em dash) independente do LLM
  return applyHardRules(cleaned);
}
