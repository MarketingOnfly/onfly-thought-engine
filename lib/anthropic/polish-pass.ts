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
    // CONTRAPOSIÇÃO ANTÔNIMA ESPECÍFICA — só quando o padrão é
    // VERBO + ADJ_A + VÍRGULA + ADJ_OPOSTO (curto, sem outras palavras).
    // Ajustada em 2026-05-28: a regex anterior pegava muito falso positivo
    // tipo "Era certo na hora, errado depois" (que é prosa válida, não AI tell).
    // Agora exige que o adjetivo oposto venha IMEDIATAMENTE após a vírgula,
    // dentro de 1-3 palavras (típico AI tell, não prosa natural).
    /\b(?:estava|era|estou|sou|fui|fica|ficou|pareceu|parece|foi)\s+(certo|errado|bom|ruim|claro|escuro|simples|complexo)\s+[^,.;]{1,15},\s+(?:errado|certo|ruim|bom|escuro|claro|complexo|simples)\s+(?:em|na|no|com|sobre)\b/gi,
    // CONTRAPOSIÇÃO "O QUE MUDA / O QUE NÃO MUDA":
    /\bo\s+que\s+(\w+):\s+[^.]+\.\s+o\s+que\s+não\s+\1\b/gi,
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

/**
 * Detecta TRIPLAS PARALELAS — três items separados por vírgula com
 * estrutura paralela. A regra do skill /linkedin-vini-cmo é "máximo
 * UMA tripla no texto inteiro". Esta função CONTA quantas existem.
 *
 * Heurística: padrão "X, Y, Z[.;!?]" onde cada item tem 1-5 palavras
 * e a palavra de cada item começa com letra minúscula (= continuação,
 * não nova frase). Filtra triplas que são claramente enumerações
 * legítimas (números, datas).
 */
export function detectTriplas(text: string): string[] {
  // Captura sequências "palavra+, palavra+, palavra+[.;!?]"
  // Cada item: 1-5 palavras, começando com minúscula ou substantivo
  const PATTERN =
    /\b([a-záéíóúâêôãõç][\wáéíóúâêôãõç-]+(?:\s+[\wáéíóúâêôãõç-]+){0,4}),\s+([a-záéíóúâêôãõç][\wáéíóúâêôãõç-]+(?:\s+[\wáéíóúâêôãõç-]+){0,4}),\s+([a-záéíóúâêôãõç][\wáéíóúâêôãõç-]+(?:\s+[\wáéíóúâêôãõç-]+){0,4})\s*[.!?;]/gi;

  const hits: string[] = [];
  let match;
  while ((match = PATTERN.exec(text)) !== null) {
    // Filtra triplas que são só números/datas
    const allNumbers = [match[1], match[2], match[3]].every((s) =>
      /^\d/.test(s.trim())
    );
    if (allNumbers) continue;
    hits.push(match[0].trim().slice(0, 100));
  }
  return hits;
}

/**
 * Verifica se o draft cita pelo menos UM dos fatos passados. Pra cada
 * fato, extrai "tokens significativos" (números, nomes próprios com
 * maiúscula, percentuais, anos) e checa se algum aparece no draft.
 * Devolve a lista de fatos NÃO citados — vazio = cita ao menos um.
 */
/**
 * Detecta TOKENS POTENCIALMENTE FABRICADOS no draft.
 *
 * Mesmo com REGRA ZERO no prompt, o modelo inventa números/datas/nomes
 * pra "dar concretude". Caso real: gerou "três vezes nos últimos dois
 * meses", "200 impressões", "fevereiro desse ano" — nada disso veio do
 * input. Modelo ignorou a regra.
 *
 * Validação determinística: compara tokens específicos do draft com
 * TODAS as fontes legítimas (input do líder + key_facts + docs). O que
 * NÃO aparece em nenhuma fonte é flag de invenção.
 */
export function detectFabricatedTokens(
  draft: string,
  sources: {
    topic?: string | null;
    brief?: string | null;
    extra_instructions?: string | null;
    must_cite_facts?: string[];
    learned_preferences?: string | null;
    tone_examples?: string | null;
    org_docs?: string;
    leader_docs?: string;
  }
): { suspicious: string[]; verifiable_count: number } {
  const allSourcesText = [
    sources.topic ?? "",
    sources.brief ?? "",
    sources.extra_instructions ?? "",
    (sources.must_cite_facts ?? []).join(" "),
    sources.learned_preferences ?? "",
    sources.tone_examples ?? "",
    sources.org_docs ?? "",
    sources.leader_docs ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const suspicious: string[] = [];
  let verifiableCount = 0;

  // NÚMEROS específicos com unidade
  const numberPatterns = [
    /\b\d+(?:[.,]\d+)?\s*%/g,
    /\bR\$\s*\d+(?:\.\d{3})*(?:,\d+)?(?:\s*(?:mi|milhões|mil|bi|bilhões))?/gi,
    /\bUS\$\s*\d+(?:[.,]\d+)?(?:\s*(?:mi|milhões|mil|bi|bilhões))?/gi,
    /\b\d+\s*(?:vezes|x)\b/gi,
    /\b\d+\s*(?:impressões|impressoes|cliques|conversões|conversoes|seguidores|inscritos|views|leads)/gi,
    /\b\d+\s*(?:meses|anos|dias|semanas|horas|minutos)/gi,
    /\b(?:19|20)\d{2}\b/g,
    /\bQ[1-4]\s*(?:de\s+)?(?:19|20)\d{2}\b/gi,
  ];

  for (const pattern of numberPatterns) {
    const matches = draft.match(pattern);
    if (!matches) continue;
    for (const m of matches) {
      const token = m.toLowerCase();
      const normalized = token.replace(/\s+/g, "").replace(/[.,]/g, "");
      const sourceNormalized = allSourcesText.replace(/\s+/g, "").replace(/[.,]/g, "");
      if (sourceNormalized.includes(normalized) || allSourcesText.includes(token)) {
        verifiableCount++;
      } else {
        suspicious.push(m);
      }
    }
  }

  // DATAS específicas (mês + ano)
  const datePatterns = [
    /\b(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+(?:de\s+)?(?:19|20)\d{2})?\b/gi,
    /\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/gi,
  ];
  for (const pattern of datePatterns) {
    const matches = draft.match(pattern);
    if (!matches) continue;
    for (const m of matches) {
      if (allSourcesText.includes(m.toLowerCase())) verifiableCount++;
      else suspicious.push(m);
    }
  }

  // NOMES PRÓPRIOS de 2+ palavras
  const namePattern =
    /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçü]{2,}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçü]{2,}\b/g;
  const nameMatches = draft.match(namePattern) ?? [];
  for (const name of nameMatches) {
    if (allSourcesText.includes(name.toLowerCase())) {
      verifiableCount++;
    } else {
      const COMMON_FALSE_POSITIVES = [
        "linkedin", "instagram", "facebook", "twitter", "google", "youtube",
        "thought leadership", "growth marketing",
      ];
      const lower = name.toLowerCase();
      if (!COMMON_FALSE_POSITIVES.some((fp) => lower.includes(fp))) {
        suspicious.push(name);
      }
    }
  }

  return {
    suspicious: Array.from(new Set(suspicious)).slice(0, 12),
    verifiable_count: verifiableCount,
  };
}

export function verifyFactsCited(
  draft: string,
  mustCiteFacts: string[]
): { citedAny: boolean; uncitedFacts: string[] } {
  if (!mustCiteFacts.length) return { citedAny: true, uncitedFacts: [] };

  const draftLower = draft.toLowerCase();

  function extractTokens(fact: string): string[] {
    const tokens: string[] = [];
    // Números (com vírgula/ponto, %, valores R$/USD/etc.)
    const nums = fact.match(/\b\d+(?:[.,]\d+)?\s*(?:%|mil|milhão|milhões|bi|bilhão|bilhões|anos?|meses?|h\b|m\b|R\$|US\$|EUR)?/gi);
    if (nums) tokens.push(...nums.map((n) => n.toLowerCase()));
    // Anos 4 dígitos
    const years = fact.match(/\b(?:19|20)\d{2}\b/g);
    if (years) tokens.push(...years);
    // Nomes próprios (palavra com maiúscula seguida de outra)
    const names = fact.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?\b/g);
    if (names) tokens.push(...names.map((n) => n.toLowerCase()));
    return Array.from(new Set(tokens));
  }

  const uncitedFacts: string[] = [];
  let citedAny = false;
  for (const fact of mustCiteFacts) {
    const tokens = extractTokens(fact);
    const cited = tokens.some((t) => t.length >= 3 && draftLower.includes(t));
    if (cited) {
      citedAny = true;
    } else if (tokens.length > 0) {
      // Só conta como "não citado" se o fato tinha tokens significativos
      // (fatos puramente qualitativos não são verificáveis)
      uncitedFacts.push(fact);
    }
  }
  return { citedAny, uncitedFacts };
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

const SYSTEM_PROMPT = `Você é um editor CIRÚRGICO, não um reescritor. Recebe um draft em pt-BR e devolve o MESMO texto com os defeitos corrigidos.

PRINCÍPIO MESTRE: cada frase que NÃO viola nenhuma regra abaixo fica INTOCADA, palavra por palavra. Você só mexe onde há defeito. Editor que "melhora" frase boa lava a voz do autor e produz prosa neutra de IA — exatamente o que combatemos.

🔒 REGRA ZERO (acima de tudo): NUNCA INVENTE ABSOLUTAMENTE NADA.
Você EDITA o que veio no draft. Você NÃO ADICIONA fato novo que não estava lá.
- Não acrescente números, nomes, citações, casos, datas, lugares, diálogos que não estavam no draft original.
- Você pode CORTAR número/nome que parece inventado e substituir por placeholder "[a confirmar]" ou linguagem qualitativa.
- Se o draft já está limpo mas curto, devolva curto. NÃO encha pra dar volume.
- Especificidade inventada é PIOR que generalidade verdadeira. Cortar > inventar.


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

2. CORTE SÓ O QUE NÃO PAGA ALUGUEL: frases repetidas, fios soltos, explicação do óbvio. Se o draft JÁ está enxuto, NÃO corte nada — corte compulsório lava a voz. NUNCA corte a digressão pessoal, o aposto sardônico ou a irregularidade que dá cara de humano ao texto.

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
  // Lista de fatos extraídos dos materiais anexados. Se passada, o
  // polish verifica que o draft cita pelo menos 1. Se nenhum, alerta
  // o modelo explicitamente pra incluir um durante o polish.
  mustCiteFacts?: string[];
  // Cartão de voz do líder (buildVoiceCard). SEM ele, o polish edita
  // "no escuro" e neutraliza a voz — maior causa de cara de IA no
  // texto final. Toda chamada vinda do pipeline de geração DEVE passar.
  voiceCard?: string;
}): Promise<string> {
  if (!opts.draft?.trim()) return opts.draft ?? "";

  // Detecta contraposições paralelas no draft antes de mandar pro polish.
  const contraposicoes = detectContraposicao(opts.draft);
  const contraposicoesHint = contraposicoes.length
    ? `\n\nALERTA — JÁ DETECTEI ${contraposicoes.length} CONTRAPOSIÇÃO(ÕES) PARALELA(S) NO DRAFT (padrões "não X, é Y" / "Estava certo na X, errado na Y" / "O que muda / O que não muda"). REESCREVA CADA UMA EM DUAS FRASES SEPARADAS, OU ELIMINE UM DOS LADOS:\n${contraposicoes.map((c, i) => `  ${i + 1}. "${c}..."`).join("\n")}\n`
    : "";

  // Detecta triplas paralelas — máximo UMA por texto.
  const triplas = detectTriplas(opts.draft);
  const triplasHint =
    triplas.length > 1
      ? `\n\nALERTA — DETECTEI ${triplas.length} TRIPLAS PARALELAS NO DRAFT. A regra é MÁXIMO UMA por texto. QUEBRE as outras em prosa corrida ou corte um dos itens:\n${triplas.map((t, i) => `  ${i + 1}. "${t}"`).join("\n")}\n`
      : "";

  // Verifica se o draft cita algum fato dos materiais anexados.
  // Se anexou material e nenhum fato foi citado, força o polish a incluir um.
  const factCheck = opts.mustCiteFacts?.length
    ? verifyFactsCited(opts.draft, opts.mustCiteFacts)
    : { citedAny: true, uncitedFacts: [] };
  const factsHint =
    opts.mustCiteFacts?.length && !factCheck.citedAny
      ? `\n\nALERTA — O LÍDER ANEXOU MATERIAL MAS O DRAFT NÃO CITA NENHUM FATO ESPECÍFICO. INCLUA NATURALMENTE PELO MENOS UM DESTES FATOS NO TEXTO POLIDO (escolha o mais forte, integra na narrativa, NÃO como bullet decorativo):\n${opts.mustCiteFacts.slice(0, 5).map((f, i) => `  ${i + 1}. ${f}`).join("\n")}\n`
      : "";

  const anthropic = getAnthropic();
  const userPrompt = `Formato: ${opts.format === "linkedin_post" ? "post de LinkedIn em pt-BR" : "artigo em pt-BR"}.
${opts.notes ? `Contexto: ${opts.notes}\n` : ""}${contraposicoesHint}${triplasHint}${factsHint}
DRAFT a polir (anti-clichê + cut 20% + sensorial):

"""
${opts.draft}
"""

Devolva o texto polido apenas.`;

  // System em 2 blocos cacheáveis: regras genéricas (estáveis entre
  // líderes) + voice card (estável por líder durante a geração).
  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (opts.voiceCard) {
    systemBlocks.push({
      type: "text",
      text: opts.voiceCard,
      cache_control: { type: "ephemeral" },
    });
  }

  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: opts.format === "linkedin_post" ? 1500 : 4500,
    system: systemBlocks,
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
