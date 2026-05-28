/**
 * Catálogo de FRAMEWORKS NARRATIVOS pra posts de LinkedIn pt-BR.
 *
 * Destilado dos clássicos: McKee (Story), Heath (Made to Stick),
 * Donald Miller (StoryBrand SB7), Bob Bly (Copywriter's Handbook),
 * Russell Brunson (Hook-Story-Offer), Truby (Anatomy of Story).
 *
 * O planner (Opus) escolhe UM framework por post baseado no objetivo
 * e tipo de input. NÃO MISTURA — misturar 2 frameworks gera lama.
 * O draft (Sonnet) recebe o framework escolhido + estrutura específica
 * e segue ao pé da letra.
 *
 * Cada framework tem:
 * - key: identificador
 * - label: nome curto pra UI/admin
 * - when_to_use: contexto que dispara
 * - structure: passos em ordem
 * - example_hook: exemplo de abertura
 * - example_close: exemplo de fechamento
 * - anti_pattern: o que NÃO fazer com esse framework
 */

export interface NarrativeFramework {
  key: string;
  label: string;
  when_to_use: string;
  structure: string[];
  example_hook: string;
  example_close: string;
  anti_pattern: string;
}

export const NARRATIVE_FRAMEWORKS: readonly NarrativeFramework[] = [
  {
    key: "story_arc",
    label: "Story Arc (5 partes)",
    when_to_use:
      "Bastidor / aprendizado / case com virada narrativa. Quando há uma jornada com inflexão.",
    structure: [
      "1. HOOK: 2-3 linhas pré 'ver mais' com lacuna de curiosidade",
      "2. ANCHOR: ano, citação real, caso nomeado, cena com hora-lugar",
      "3. CORPO: contexto → inflexão → detalhe concreto → reflexão",
      "4. ÂNCORA VISUAL: frase isolada no meio carregando a tese central",
      "5. CLOSE SECO: assertion / payoff / zinger (não pergunta)",
    ],
    example_hook:
      "Sexta-feira, 23h. Slack do CEO acende: 'precisamos conversar segunda'.",
    example_close: "A reunião durou 12 minutos. Saí com a decisão pronta.",
    anti_pattern:
      "Conta a história inteira em sequência cronológica sem virada. Vira relato, não narrativa.",
  },
  {
    key: "pas",
    label: "PAS (Problem-Agitate-Solve)",
    when_to_use:
      "Mudar opinião do leitor sobre uma prática ou crença comum. Argumentativo com solução prática.",
    structure: [
      "1. PROBLEM: o problema em 1 linha com DADO específico",
      "2. AGITATE: consequência específica em 1-2 linhas, SECA (sem drama 'está te custando milhões!')",
      "3. SOLVE: o que dá pra fazer agora, ação concreta",
    ],
    example_hook:
      "87% dos CMOs B2B medem custo de mídia. 4% medem retorno por canal.",
    example_close:
      "Mede CAC por cohort de canal por mês. Resto é teatro de dashboard.",
    anti_pattern:
      "Agitate exagerado ('está afundando seu negócio!') tira credibilidade. Mantém seco.",
  },
  {
    key: "bab",
    label: "BAB (Before-After-Bridge)",
    when_to_use:
      "Mostrar transformação real do próprio líder ou case concreto. Demonstra mudança operacional, não slogan.",
    structure: [
      "1. BEFORE: como você fazia antes (concreto, mensurável)",
      "2. AFTER: como faz hoje (contraste claro com o before)",
      "3. BRIDGE: a mudança ESPECÍFICA que destravou (o pivot real, não 'mindset')",
    ],
    example_hook: "Antes eu olhava CAC mensal. Hoje olho por cohort de canal por mês.",
    example_close:
      "A mudança não foi de ferramenta. Foi parar de usar média ponderada quando o mix muda.",
    anti_pattern:
      "Bridge vago ('mudei meu mindset'). Bridge precisa ser tático, replicável.",
  },
  {
    key: "contrarian_structured",
    label: "Contrarian Structured",
    when_to_use:
      "Hot take com lastro próprio (dado, ciência, experiência). Quando você defende algo que o setor concordaria 'não'.",
    structure: [
      "1. AFIRMAÇÃO contrarian em 1-2 linhas, direta",
      "2. VALIDAÇÃO do que parece estranho ('muita gente vai discordar, e tem motivo')",
      "3. LASTRO: dado/ciência/experiência que sustenta",
      "4. IMPLICAÇÃO prática: o que muda na decisão",
      "5. FECHO que provoca reflexão sem pergunta retórica",
    ],
    example_hook: "Performance pura virou nome bonito pra dependência de canal pago.",
    example_close:
      "Quem só compete em leilão, vai pagar caro no dia que o leilão dobrar.",
    anti_pattern:
      "Contrarian sem lastro vira polêmica gratuita. Sempre cite a evidência ou experiência que sustenta.",
  },
  {
    key: "story_brand_sb7",
    label: "StoryBrand SB7 (adaptado)",
    when_to_use:
      "Quando você quer guiar o leitor por uma jornada de problema → resolução. Bom pra educação técnica.",
    structure: [
      "1. PERSONAGEM: o leitor com uma dor específica nomeada",
      "2. PROBLEMA: 3 camadas (externo = sintoma, interno = frustração, filosófico = por que isso importa)",
      "3. GUIA: você (líder) com autoridade demonstrada por número/experiência",
      "4. PLANO: passos concretos pra resolver (2-4 passos)",
      "5. AÇÃO: o que o leitor faz a partir de agora",
      "6. FALHA EVITADA: o que acontece se não fizer (sem drama)",
      "7. SUCESSO: como fica quando faz",
    ],
    example_hook:
      "Você é CFO de SaaS que cresceu 40% em 12 meses. O caixa está cheio. E o board cancelou seu bônus.",
    example_close:
      "Mede CAC por cohort, não médio. Em 60 dias o board volta a olhar você como aliado.",
    anti_pattern:
      "Falar do leitor em 3ª pessoa ('o CFO que enfrenta isso...'). Quebra o efeito. Fala 'você' direto.",
  },
  {
    key: "hook_story_offer",
    label: "Hook-Story-Offer (adaptado)",
    when_to_use:
      "Combina hook forte + história curta + tese (não pitch). Bom pra autoridade rápida com prova.",
    structure: [
      "1. HOOK: linha forte que para o scroll",
      "2. STORY: caso CURTO (3-5 linhas) com sujeito, ação, consequência",
      "3. OFFER: a TESE (não pitch comercial) — o que esse caso prova",
    ],
    example_hook: "Demitir esse cargo deu mais receita que contratar mais 3 vendedores.",
    example_close: "Cargo errado consome caixa silenciosamente. Cortar antes de contratar.",
    anti_pattern:
      "Offer virar pitch comercial ('quer ajuda? me chama no DM'). Offer é TESE, não venda.",
  },
  {
    key: "newsjacking_take",
    label: "Newsjacking de Autoridade",
    when_to_use:
      "Notícia recente (24-48h) com leitura técnica diferenciada do consenso. Sua tese muda o que todos estão olhando.",
    structure: [
      "1. HOOK: a notícia em 1 linha com sua LEITURA embutida (não 'X aconteceu', é 'X aconteceu e isso significa Y')",
      "2. CONSENSO: o que todos estão dizendo (rapidamente)",
      "3. CONTRA-LEITURA: por que o consenso está raso ou errado, ângulo que ninguém vê",
      "4. ANÁLISE TÉCNICA: lastro com brand science / marketing science / lógica de negócio",
      "5. IMPLICAÇÃO PRÁTICA: o que isso muda pra quem faz B2B",
      "6. FECHO: tese clara que sustenta autoridade",
    ],
    example_hook:
      "A Magalu demitiu 1.500 pessoas ontem. E os relatórios continuam dizendo que o problema é macroeconomia. Não é.",
    example_close: "Empresa que delega execução pra agência perde leitura própria do mercado.",
    anti_pattern:
      "Repetir o que o Meio & Mensagem já disse. Sem leitura diferenciada, não posta.",
  },
  {
    key: "expensive_lesson",
    label: "Expensive Lesson (lição cara)",
    when_to_use:
      "Erro pessoal com número específico de custo. Vulnerabilidade calibrada com aprendizado replicável.",
    structure: [
      "1. HOOK: 'Perdi R$ X em [contexto]. Aprendi Y.' (número específico, NÃO ['muito dinheiro'])",
      "2. CONTEXTO: o que estava em jogo antes do erro",
      "3. O ERRO: o que você fez achando que estava certo",
      "4. CONSEQUÊNCIA: o número/impacto real",
      "5. APRENDIZADO REPLICÁVEL: o que outros podem usar (não 'aprendi a ser mais cuidadoso')",
    ],
    example_hook:
      "Perdi R$ 2,3 milhões em pipeline porque insisti que SDR era papel humano.",
    example_close: "Hoje meu time tem 1 pessoa e 4 agentes. Caixa virou mais previsível.",
    anti_pattern:
      "Vulnerabilidade performática sem número/data. 'Errei e aprendi muito' = IA. 'Perdi R$ 2,3 mi em 4 meses' = humano.",
  },
  {
    key: "paisa",
    label: "PAISA (Roy Furr — versão completa do PAS)",
    when_to_use:
      "Mudança de opinião com argumento sólido. Mais completo que PAS porque adiciona a etapa INVALIDATE: mostra POR QUE outras soluções não servem antes de propor a sua. Bom pra contraposições de mercado.",
    structure: [
      "1. PROBLEM: problema concreto que mantém o leitor acordado de noite, em 1 linha com dado.",
      "2. AGITATE: a consequência interna+externa de não resolver. Toca os 3 níveis de problema (externo, interno, filosófico).",
      "3. INVALIDATE: por que as soluções óbvias (que o leitor já tentou ou tá pensando) NÃO resolvem. Lista 2-3 alternativas e elimina cada uma com critério próprio.",
      "4. SOLVE: aí entra sua tese/framework/caminho como ÚNICA solução remanescente. Apresenta como 'category of one'.",
      "5. ASK: convite específico pra ação (ou só uma assertion forte que aterrissa).",
    ],
    example_hook:
      "87% dos CMOs B2B medem custo de mídia. 4% medem retorno por canal.",
    example_close: "Mede CAC por cohort. Mídia média mente em mercado em mudança.",
    anti_pattern:
      "Pular a etapa INVALIDATE = post que parece pitch raso. Sem invalidar alternativas, sua solução não tem por quê ser melhor.",
  },
  {
    key: "sb7_short",
    label: "StoryBrand SB7 ultra-curto (Donald Miller)",
    when_to_use:
      "Post de educação técnica curto onde o leitor é o herói. Você é o guia. Bom quando há um framework simples pra entregar.",
    structure: [
      "1. PERSONAGEM (1 linha): nomeia o leitor com dor específica. 'Você é CMO B2B que cresceu 40% e o board ainda cortou seu bônus.'",
      "2. PROBLEMA 3 NÍVEIS (3 linhas): externo (sintoma) + interno (frustração) + filosófico (injustiça).",
      "3. GUIA (1 linha): você como guia com autoridade demonstrada (número/experiência), sem ser herói.",
      "4. PLANO (2-3 linhas): 2-4 passos concretos. Bullets ou frases curtas.",
      "5. AÇÃO + EVITAR FALHA + SUCESSO (1-2 linhas): o que acontece se aplicar / se não aplicar.",
    ],
    example_hook:
      "Você é CFO de SaaS que cresceu 40%. O board cortou seu bônus mesmo assim.",
    example_close:
      "Mede CAC por cohort em 60 dias. Board volta a olhar você como aliado.",
    anti_pattern:
      "Posicionar você (líder) como herói da história. Quem é herói no SB7 é o LEITOR. Você é o guia.",
  },
  {
    key: "three_sentence",
    label: "3-Sentence Story (John Carlton via Furr)",
    when_to_use:
      "Post-punch curto (200-450 chars). Quando você quer uma única ideia forte sem deixar margem pra divagação. Bom pra newsjacking rápido ou ancoragem em 1 cena.",
    structure: [
      "1. SETUP (1 frase): onde/quando/quem. Cena ou contexto em uma frase só.",
      "2. INCREASING CONFLICT (1 frase): o que deu errado / a inflexão / a virada.",
      "3. RESOLUTION (1 frase): como terminou + tese implícita.",
    ],
    example_hook: "Sexta, 23h. Slack do CEO acende: 'precisamos conversar segunda'.",
    example_close: "Reunião durou 12 minutos. Decisão já tava pronta.",
    anti_pattern:
      "Adicionar uma 4ª frase explicando a moral. A tese fica IMPLÍCITA na resolução. Explicar mata o efeito.",
  },
];

export type NarrativeFrameworkKey = (typeof NARRATIVE_FRAMEWORKS)[number]["key"];

/**
 * Devolve o framework por key, ou null se não encontrar.
 */
export function getFramework(
  key: string | null | undefined
): NarrativeFramework | null {
  if (!key) return null;
  return NARRATIVE_FRAMEWORKS.find((f) => f.key === key) ?? null;
}

/**
 * Formata o framework como bloco de instrução pra injetar no user prompt
 * do draft. Quando o planner escolhe um framework, ESSE é o playbook.
 */
export function frameworkAsPromptInstruction(
  framework: NarrativeFramework
): string {
  return [
    `FRAMEWORK NARRATIVO ESCOLHIDO PARA ESSE POST: ${framework.label}`,
    `Quando faz sentido: ${framework.when_to_use}`,
    "",
    "ESTRUTURA OBRIGATÓRIA (seguir nessa ordem, não misturar com outros frameworks):",
    ...framework.structure.map((s) => `  ${s}`),
    "",
    `Exemplo de hook nesse framework: "${framework.example_hook}"`,
    `Exemplo de close nesse framework: "${framework.example_close}"`,
    "",
    `ANTI-PADRÃO desse framework: ${framework.anti_pattern}`,
  ].join("\n");
}

/**
 * Lista os frameworks pra o planner escolher. Pra cada um, dá nome +
 * quando usar (sem a estrutura completa — o planner só decide o key).
 */
export function frameworksForPlanner(): string {
  return NARRATIVE_FRAMEWORKS.map(
    (f) => `  - "${f.key}": ${f.label}. Quando: ${f.when_to_use}`
  ).join("\n");
}
