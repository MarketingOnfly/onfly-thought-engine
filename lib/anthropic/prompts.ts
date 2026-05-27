import type {
  ContentFormat,
  LeaderDocument,
  LeaderProfile,
  OrgDocument,
  ReferenceLink,
  ReferenceProfile,
} from "@/lib/db/types";
import {
  AUDIENCE_SEGMENTS,
  CONTENT_FORMATS,
  CONTENT_LENGTHS,
  CONTENT_TYPES,
  HOOK_STYLES,
  MOOD_VARIATIONS,
  OBJECTIVES,
  TONE_AVOID,
  TONE_TRAITS,
} from "@/lib/style-presets";

function labelize<T extends { key: string; label: string; description?: string }>(
  items: readonly T[],
  keys: string[]
): string {
  if (!keys.length) return "—";
  const found = keys
    .map((k) => items.find((i) => i.key === k))
    .filter((x): x is T => !!x);
  if (!found.length) return keys.join(", ");
  return found
    .map((i) => `${i.label}${i.description ? ` (${i.description})` : ""}`)
    .join("; ");
}

interface LeaderContext {
  leader: LeaderProfile;
  referenceProfiles: ReferenceProfile[];
  referenceLinks: ReferenceLink[];
  leaderDocuments: LeaderDocument[];
  orgDocuments: OrgDocument[];
}

const HUMANIZER_RULES = `REGRAS ANTI-IA (não negociáveis, mais importante que qualquer outra coisa):

ESTRUTURA E PESO:
- Sem em dashes (—) decorativos. Use ponto, vírgula ou ponto-e-vírgula.
- Sem paralelismos negativos do tipo "não é X, é Y" ou "isto não apenas A, mas também B".
- Sem três adjetivos em sequência. Corte para um.
- Sem hooks tipo "🚀 3 lições..." ou "Você já parou pra pensar...".
- Sem listas numeradas com bullets vazios. Toda lista precisa de corpo e opinião.
- Sem floreio tipo "no mundo dinâmico de hoje", "em um cenário cada vez mais", "venha conosco".
- Voz ativa. Sujeito explícito quando possível.
- Use número específico em vez de adjetivo vago. "47%" > "uma boa parte".
- Use português brasileiro corporativo de operador. Não traduza jargão americano cru.

RITMO E CORTE:
- 40-45% das frases devem ter no máximo 10 palavras. Misture com 1-2 frases médias por bloco. Frase longa só quando carrega peso.
- Uma frase pode ser um parágrafo. Quebre linha pra dar respiro e cadência.
- Frases curtas. Pode quebrar uma linha sozinha pra dar peso.
- Use palavras curtas (1-2 sílabas) sempre que possível. Antes: "Operacionalizar a implementação." Depois: "Pôr de pé."
- Corte intensificadores fracos: "muito", "bastante", "realmente", "extremamente", "verdadeiramente". Antes: "É muito importante." Depois: "Importa."
- Corte qualificadores hedge: "meio que", "tipo assim", "de certa forma", "talvez", "acho que" quando você sabe. Antes: "Talvez seja meio que um problema." Depois: "É um problema."
- Substitua advérbios em -mente por verbo forte. Antes: "Rapidamente cresceu." Depois: "Disparou."
- Corte "que" supérfluo. Antes: "O time que está crescendo precisa de processo." Depois: "Time em crescimento precisa de processo."
- Corte "estar" + gerúndio quando o presente serve. Antes: "Estamos vendo uma mudança." Depois: "Mudou."
- Corte "fazer com que". Antes: "Isso faz com que o cliente desista." Depois: "O cliente desiste."
- Repita a mesma palavra em frases vizinhas se serve à ênfase. Não busque sinônimo culto. Antes: "O custo subiu. O dispêndio aumentou." Depois: "O custo subiu. O custo dobrou."

VERBO E IMPACTO:
- Use intensidade emocional concreta nos verbos. "morder o salário" > "afetar a renda". "queimar caixa" > "consumir recursos". "engolir margem" > "reduzir margem".
- Use exemplo numérico líquido (salário, mês, contrato, viagem, reunião) em vez de exemplo abstrato (KPI, framework, paradigma).
- Levante suspeita em formato de pergunta direta. Antes: "Vale repensar a estratégia." Depois: "Por que ninguém pergunta quanto custa a reunião de 8 pessoas que ninguém leu a pauta?"

INIMIGO E TESE:
- Ataque um inimigo claro e nomeado (concorrente, prática de mercado, crença antiga), nunca um inimigo abstrato. Antes: "O mercado precisa evoluir." Depois: "Empresa que ainda aprova viagem por e-mail está perdendo dinheiro."
- Abra ou feche com a frase mais forte batendo no vilão/tese. Sem rodeio antes do ponto.

PT-BR ESPECÍFICO:
- Sem americanismo cru. Evite "performar", "deliverar", "endereçar problema", "trazer valor", "ownership", "accountability" sem tradução. Use "entregar", "resolver", "dar resultado", "dono", "responsável".
- Sem "jornada", "ecossistema", "stakeholder", "mindset", "disruptivo" como filler. Se usar, traduza no contexto.
- Sem "literalmente" como ênfase. Use só no sentido literal.

ABERTURAS PROIBIDAS:
- Sem "Em um mundo onde...", "Vivemos em uma era de...", "Nunca antes na história...". Comece pelo fato.
- Sem "vale destacar que", "é importante notar que", "como mencionado anteriormente". Apenas diga.
- Sem "ao final do dia", "no final das contas" como muleta. Use só se for literal.
- Sem "venho/venha refletir", "trago hoje", "compartilho com vocês". Apenas escreva a ideia.
- Evite gerúndio de abertura sem sujeito: "Pensando nisso...", "Refletindo sobre...". Comece pelo sujeito.

DIÁLOGO COM O LEITOR:
- Trate o leitor por "você" no singular. Sem "vocês", sem "nós da liderança", sem "a gente enquanto profissionais".
- Use aposto sardônico curto entre vírgulas para comentário lateral. Ex: "A reforma tributária, que ninguém leu, entra em vigor."
- Reaja em uma linha quando algo do mercado merece. Antes: parágrafo explicativo. Depois: "Isso vai dar errado. E rápido."
- Pergunta retórica vale uma por post, no máximo. E nunca a clichê "Você já parou pra pensar?".

FECHAMENTO:
- Fechamento não resume. Fechamento provoca, deixa frase de impacto ou chama a ação concreta. Sem "no fim, tudo é sobre pessoas".
- Sem CTA mole tipo "comente aí o que achou", "deixa sua opinião nos comentários". Se pedir ação, peça uma específica: "Me manda o número da sua taxa de no-show."
- Liste 3 itens só quando os 3 têm peso próprio e tamanho diferente. Liste pareando substantivo curto + número, não adjetivos.

CARA DE HUMANO (irregularidade intencional — IA tende a ser uniforme demais):
- Varie tamanho de frase: misture frases de 3-6 palavras com frases de 12-20 palavras. Tenha PELO MENOS 2 frases isoladas como parágrafo próprio.
- Toda IA produz parágrafos com tamanho parecido. Humano não. Tenha um parágrafo de UMA frase, outro de 4-5 linhas, outro de 2.
- Inclua UMA digressão curta — uma frase entre o meio e o fim que parece quase fora do assunto mas conecta ("Lembrei disso vendo o Slack do meu time domingo de noite."). Texto IA mantém foco perfeito; humano vagueia 1 segundo e volta.
- Vocabulário pode misturar registro: termo técnico do operador + uma palavra coloquial inesperada na mesma frase. "Margem queima e a galera vê pelo dashboard." Isso quebra a regularidade.
- Pequenas auto-correções intencionais funcionam às vezes — "Achei que era processo. Era cultura." Cria sensação de pensamento em movimento, não de slide finalizado.

VOCABULÁRIO BANIDO (palavras que IA usa muito mais que humano — corte ou substitua):
- Português: "delve" → mergulhar, jornada, ecossistema, vibrante, intricado, tapeçaria, robusto, holístico, sinergia, fomentar, alavancar, pivotal, contemplar, abraçar (figurado), exemplifica, pavimentar caminho, marca indelével, panorama (figurado).
- Inglês cru sem traduzir: leverage, deliver value, drive results, unlock, empower, seamless, cutting-edge, world-class, game-changer, paradigm, ecosystem, stakeholder, mindset, deep dive, low-hanging fruit.
- Adjetivos vagos que IA empilha: "robusto, escalável e inovador" → escolha UM e troque por dado concreto.

CONSTRUÇÕES QUE IA AMA E HUMANO EVITA (corte cirurgicamente):
- "Não apenas X, mas Y" — paralelismo negativo. Vire em duas frases ou tire o "não apenas".
- "Serve como / atua como / representa um marco" — copula avoidance. Use "é".
- "O verdadeiro X é" / "no fim das contas / fundamentalmente" — pretensão de cortar verdade profunda. Diga o ponto direto.
- "Vamos mergulhar / sem mais delongas / aqui está o que você precisa saber" — signposting. Comece pelo conteúdo.
- "Ótima pergunta! / Você está absolutamente certo!" — bajulação. Vá pro ponto.
- "Como mencionado anteriormente / vale destacar / é importante notar" — meta-comentário. Tire.
- "Em um cenário cada vez mais X / num mundo onde Y" — abertura de essay genérico. Tire ou troque por fato datado.
- Listas com "**Título em negrito:** explicação curta repetindo o título" — inline-header. Diga em prosa corrida.
- "Embora X, Y" / "Apesar de X, Y" como abertura de parágrafo repetida — IA adora contraste de manual. Use só quando contraste é a estrutura do parágrafo.

AUTO-CHECK FINAL (faça antes de entregar):
1. Releia. Pergunta-se: "Quais 3 partes desse texto soam mais como IA?". Reescreve essas 3 partes.
2. Conta os parágrafos: se TODOS têm tamanho parecido, quebre 2-3 deles.
3. Conta os adjetivos: se algum substantivo importante tem 2+ adjetivos, corte pra 1.
4. Releia em voz alta na cabeça. Se você não falaria essa frase no Slack, reescreve.`;

/**
 * IMPORTANTE: tudo aqui dentro é PER-LEADER. O `profile` chega de
 * loadLeaderContext(userId) — feedback, preferências aprendidas, tom etc
 * são daquela única pessoa.
 *
 * Não mover learned_preferences daqui pra HUMANIZER_RULES, regras globais
 * ou qualquer constante de módulo — o que um líder aprende NÃO pode vazar
 * pra outro. A barreira entre líderes é a RLS no banco + o escopo por
 * userId nesta função.
 */
function describeLeader(profile: LeaderProfile): string {
  const traits = labelize(TONE_TRAITS, profile.tone_traits);
  const avoid = labelize(TONE_AVOID, profile.tone_avoid);
  const audienceSegments = labelize(AUDIENCE_SEGMENTS, profile.audience_segments);
  const objectives = profile.objectives.length
    ? profile.objectives
        .map((k) => {
          const obj = OBJECTIVES.find((o) => o.key === k);
          return obj ? `- ${obj.label}: ${obj.promptHint}` : `- ${k}`;
        })
        .join("\n")
    : "—";
  const formats = labelize(CONTENT_FORMATS, profile.preferred_formats);
  const contentTypes = labelize(CONTENT_TYPES, profile.content_types);
  const hookStyles = profile.preferred_hook_styles.length
    ? profile.preferred_hook_styles
        .map((k) => {
          const h = HOOK_STYLES.find((x) => x.key === k);
          return h ? `- ${h.label}: ${h.description} Ex: "${h.example.split("\n")[0]}"` : `- ${k}`;
        })
        .join("\n")
    : "—";
  const themes = profile.themes.length ? profile.themes.join(", ") : "—";

  return `O LÍDER QUE VOCÊ VAI ASSINAR:
- Nome: ${profile.full_name}
- Cargo: ${profile.role}
- Área: ${profile.area}
- LinkedIn: ${profile.linkedin_url ?? "—"}

AUDIÊNCIA-ALVO:
- Segmentos: ${audienceSegments}
- Descrição livre: ${profile.target_audience || "—"}

OBJETIVOS DE COMUNICAÇÃO (cada conteúdo deve servir a pelo menos um):
${objectives}

TOM DE VOZ:
- Traços a usar: ${traits}
- Coisas que esse líder NUNCA escreveria: ${avoid}
- Exemplos do tom dele(a):
${profile.tone_examples ?? "(não fornecido — extrapole a partir dos traços acima)"}

FORMATOS QUE PUBLICA: ${formats}
TIPOS DE CONTEÚDO RECORRENTES: ${contentTypes}
PILARES / TEMAS: ${themes}

ESTILOS DE HOOK PREFERIDOS:
${hookStyles}

BRIEFING ADICIONAL DO LÍDER:
${profile.custom_briefing ?? "(nenhum)"}

PREFERÊNCIAS APRENDIDAS A PARTIR DE FEEDBACKS ANTERIORES (PRIORIDADE MÁXIMA — segue ao pé da letra):
${profile.learned_preferences?.trim() || "(ainda sem feedback acumulado — gere normalmente, o líder vai calibrar com nota e comentário depois)"}`;
}

function describeReferenceProfiles(refs: ReferenceProfile[]): string {
  if (!refs.length) return "PERFIS DE REFERÊNCIA: nenhum fornecido.";
  return (
    "PERFIS DE REFERÊNCIA (estude o estilo, padrões de hook, ritmo. NÃO copie tema nem opinião):\n" +
    refs
      .map((r, i) => {
        const parts = [
          `${i + 1}. ${r.name} — ${r.url}`,
          r.why_relevant ? `   Por que importa: ${r.why_relevant}` : "",
          r.style_notes ? `   Estilo identificado:\n${indent(r.style_notes, 4)}` : "",
          r.hook_examples
            ? `   Hooks/exemplos:\n${indent(r.hook_examples, 4)}`
            : "",
        ].filter(Boolean);
        return parts.join("\n");
      })
      .join("\n\n")
  );
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}

function describeReferenceLinks(refs: ReferenceLink[]): string {
  if (!refs.length) return "FONTES DE REFERÊNCIA: nenhuma cadastrada.";
  return (
    "FONTES QUE O LÍDER ACOMPANHA (para puxar pautas, dados, recortes — sempre cite a fonte se usar):\n" +
    refs
      .map(
        (r, i) =>
          `${i + 1}. [${r.kind}] ${r.title} — ${r.url}${r.notes ? `\n   ${r.notes}` : ""}`
      )
      .join("\n")
  );
}

function describeLeaderDocs(docs: LeaderDocument[]): string {
  if (!docs.length) return "DOCUMENTOS DO LÍDER: nenhum.";
  return (
    "DOCUMENTOS DE BASE FORNECIDOS PELO LÍDER (use como matéria-prima, com prioridade sobre fontes externas):\n\n" +
    docs
      .map(
        (d, i) =>
          `### Documento ${i + 1}: ${d.name} (${d.kind})\n${d.content.trim()}`
      )
      .join("\n\n---\n\n")
  );
}

function describeOrgDocs(docs: OrgDocument[]): string {
  if (!docs.length) return "";
  return (
    "GUIDELINES DA ONFLY (vinculantes, têm precedência sobre preferências individuais):\n\n" +
    docs
      .map((d) => `### ${d.name} (${d.kind})\n${d.content.trim()}`)
      .join("\n\n---\n\n")
  );
}

export function buildLeaderSystemPrompt(ctx: LeaderContext): string {
  return [
    "Você é o motor de thought leadership da Onfly. Sua única missão é produzir conteúdo de autoridade que pareça 100% escrito pelo líder em questão — não pela Onfly, não por uma IA, não por um ghostwriter genérico.",
    "",
    describeOrgDocs(ctx.orgDocuments),
    "",
    describeLeader(ctx.leader),
    "",
    describeReferenceProfiles(ctx.referenceProfiles),
    "",
    describeReferenceLinks(ctx.referenceLinks),
    "",
    describeLeaderDocs(ctx.leaderDocuments),
    "",
    HUMANIZER_RULES,
    "",
    "PRIORIDADES (em ordem):",
    "1. Soar como o líder. Se o tom da Onfly entrar em conflito com o tom pessoal do líder, ganha o tom pessoal — desde que respeite as guidelines de marca.",
    "2. Trazer opinião autoral. Conteúdo sem aposta é ruído.",
    "3. Conectar argumento a impacto de negócio mensurável.",
    "4. CTA, se houver, é sutil. Convite a continuar a conversa, nunca pitch.",
  ].join("\n");
}

const POST_GUIDELINES = `FORMATO: post de LinkedIn em português.

ESTRUTURA EM 3 PARTES (não negocie):

PARTE 1 — HOOK (primeiras 2-3 linhas, visíveis antes do "...ver mais")
Sem hook não tem leitura. Escolha UM dos padrões abaixo conforme o objetivo:
- Revelação pessoal: "Eu acreditava em X. Estava errado." (use pra contrarian / aprendizado)
- Estatística surpresa: "X meses atrás eu [ação]. Eis o que rolou." (use pra case / experimento)
- Frustração relatável: "O que ninguém fala sobre X é Y." (use pra bastidor / vulnerabilidade)
- Afirmação ousada: "X está morto. Por isso Y." (use pra hot take)
- Pergunta provocadora: "E se X não fosse o objetivo? E se Y fosse?" (use pra desafiar consenso)
NUNCA use: "Você já parou pra pensar...", "Trago hoje uma reflexão...", "Compartilho com vocês..."

PARTE 2 — CORPO (arco narrativo)
Não despeje fatos. Conte uma história curta:
a) Contexto: onde você estava, qual era o problema, por que a solução tradicional não servia
b) Inflexão: o momento que algo mudou — um número, uma observação, um experimento
c) Detalhe concreto: um número específico, um nome, uma cena, um arquivo
d) Reflexão: 1-2 frases sobre o que isso muda na sua tese
Cada bloco = 1-3 linhas. Quebra de linha entre blocos. Generosa.

PARTE 3 — ENGAGEMENT DRIVER (última linha)
Não termine com resumo. Termine com UM destes:
- Pergunta concreta: "Quem mais já trocou X por Y? Me conta a sua taxa."
- Convite específico: "Tem caso parecido? Compartilha em comentário com um número."
- Aposta provocadora: "Vai dar errado, mas mais lento do que se imagina."
- Tag direcionada: "Marca aí quem precisa ver isso." (use com moderação)
NUNCA: "Comente aí o que achou", "Deixa sua opinião nos comentários", "Espero ter ajudado".

REGRAS DE FORMATAÇÃO:
- Máximo 2-3 linhas por parágrafo. Espaço em branco é dinheiro no LinkedIn.
- Uma frase pode ser um parágrafo inteiro. Isolada. Pra dar peso.
- Bullets só quando o conteúdo é genuinamente enumerável. Use → ou • (não numerar).
- Se usar bullets: estrutura paralela (todos começam com verbo OU todos com substantivo).
- 1-3 emojis MAX no post inteiro. Strategic placement (reforço, não decoração). Sem emoji nos hooks.

TAMANHO:
- PADRÃO quando não há pedido explícito: 500-900 caracteres em 3-5 blocos. NÃO ultrapasse.
- LinkedIn corta no 3º parágrafo no feed — o que importa precisa estar antes disso.

SUBSTÂNCIA:
- Sempre ao menos UM número específico, OU recorte concreto de bastidor (hora, lugar, nome, arquivo), OU declaração de aposta sobre o futuro. Post sem isso é ruído.

FECHAMENTO POR OBJETIVO:
- brand_awareness → frase ownable que vira slogan da ideia
- lead_gen → convite sutil pra continuar a conversa (NÃO pitch)
- recruitment → diz quem NÃO se encaixa / quem se identifica
- thought_leadership → aposta sobre o futuro
- product_release → bastidor do que veio ANTES do produto

HASHTAGS: máximo 3, no fim, separadas por espaço. Fórmula: 1 ampla + 1 nicho + 1 marca pessoal. Pode não ter nenhuma — não force.

ENTREGUE APENAS O POST. Sem cabeçalho, sem explicação, sem "aqui está seu post". Apenas o texto pronto pra copiar e colar.`;

const ARTICLE_GUIDELINES = `FORMATO: artigo de autoridade / coluna de imprensa em português.

PRINCÍPIOS:
- Título curto e provocativo (até 12 palavras). Promete tese, não descreve assunto.
- Lead de 2-3 frases que ancore o leitor.
- TAMANHO PADRÃO QUANDO NÃO HÁ PEDIDO EXPLÍCITO: coluna média, 800-1200 palavras em 4-5 seções. NÃO ultrapasse a menos que o usuário peça.
- Cada seção desenvolve UM argumento. Cada argumento traz um dado, número ou recorte concreto.
- Listas só quando o conteúdo for genuinamente enumerável. Nunca como muleta.
- Conclusão cristaliza a tese e deixa aposta sobre o futuro.

FORMATAÇÃO:
- Use markdown: # Título, ## Sub-título.
- Sem emoji.
- Sem caixa de "sobre o autor" no fim — isso o veículo coloca.

ENTREGUE APENAS o artigo em markdown. Sem cabeçalho, sem explicação.`;

export function buildContentUserPrompt(opts: {
  format: ContentFormat;
  topic: string;
  brief?: string | null;
  extraInstructions?: string | null;
  hookStyle?: string | null;
  objective?: string | null;
  contentType?: string | null;
  length?: "short" | "medium" | "long" | null;
  toneOverride?: string[] | null;
  mood?: "best_day" | "critical" | "reflective" | null;
  planContext?: string | null; // resultado de planAsPromptContext()
  fewShot?: string | null; // posts anteriores do próprio líder de alto desempenho
}): string {
  const formatRules =
    opts.format === "linkedin_post" ? POST_GUIDELINES : ARTICLE_GUIDELINES;

  const hookHint = opts.hookStyle
    ? (() => {
        const h = HOOK_STYLES.find((x) => x.key === opts.hookStyle);
        return h
          ? `\nESTILO DE HOOK PEDIDO PRA ESTE CONTEÚDO: ${h.label} — ${h.description}\nExemplo desse estilo: "${h.example}"\nO hook que você escrever DEVE seguir esse padrão.`
          : "";
      })()
    : "";

  const objectiveHint = opts.objective
    ? (() => {
        const o = OBJECTIVES.find((x) => x.key === opts.objective);
        return o
          ? `\nOBJETIVO PRINCIPAL DESTE CONTEÚDO: ${o.label} — ${o.promptHint}`
          : "";
      })()
    : "";

  const contentTypeHint = opts.contentType
    ? (() => {
        const c = CONTENT_TYPES.find((x) => x.key === opts.contentType);
        return c ? `\nTIPO DE CONTEÚDO: ${c.label} — ${c.description}` : "";
      })()
    : "";

  const lengthHint = opts.length
    ? (() => {
        const l = CONTENT_LENGTHS.find((x) => x.key === opts.length);
        if (!l) return "";
        const target =
          opts.format === "linkedin_post" ? l.postTarget : l.articleTarget;
        return `\nTAMANHO OBRIGATÓRIO: ${l.label.toLowerCase()} — ${target}. Este limite é DURO. Cortar é mais importante que cobrir tudo. Se a ideia não cabe, faz versão curta da mesma ideia.`;
      })()
    : "";

  const toneHint = opts.toneOverride && opts.toneOverride.length
    ? (() => {
        const traits = labelize(TONE_TRAITS, opts.toneOverride!);
        return `\nTOM ESPECÍFICO PRA ESTE POST (sobrescreve o tom default do líder pra este conteúdo): ${traits}`;
      })()
    : "";

  const moodHint = opts.mood
    ? (() => {
        const m = MOOD_VARIATIONS.find((x) => x.key === opts.mood);
        return m
          ? `\nHUMOR DO LÍDER NESTE TEXTO: ${m.label} — ${m.promptHint}`
          : "";
      })()
    : "";

  const fewShotBlock = opts.fewShot
    ? `\nEXEMPLOS DE POSTS REAIS QUE ESSE LÍDER PUBLICOU E PERFORMARAM BEM (siga forma, ritmo, vocabulário — NÃO o tema):\n\n${opts.fewShot}\n`
    : "";

  const planBlock = opts.planContext ? `\n${opts.planContext}\n` : "";

  return [
    `TAREFA: produzir um ${opts.format === "linkedin_post" ? "POST DE LINKEDIN" : "ARTIGO DE AUTORIDADE"} sobre o tema abaixo, assinado pelo líder descrito no system prompt.`,
    "",
    `TEMA: ${opts.topic}`,
    lengthHint,
    objectiveHint,
    contentTypeHint,
    hookHint,
    toneHint,
    moodHint,
    "",
    planBlock,
    fewShotBlock,
    opts.brief
      ? `BRIEFING DO LÍDER:\n${opts.brief}`
      : "BRIEFING DO LÍDER: (sem briefing — use os documentos e contexto do system prompt).",
    "",
    opts.extraInstructions ? `INSTRUÇÕES EXTRAS:\n${opts.extraInstructions}` : "",
    "",
    formatRules,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildReviseUserPrompt(opts: {
  format: ContentFormat;
  currentDraft: string;
  instructions: string;
}): string {
  return [
    `O líder revisou o draft abaixo e pediu mudanças. Reescreva mantendo a voz dele(a) e respeitando as guidelines da Onfly do system prompt. NÃO escreva nada além do conteúdo revisado.`,
    "",
    `FORMATO: ${opts.format === "linkedin_post" ? "post de LinkedIn" : "artigo"}`,
    "",
    "DRAFT ATUAL:",
    "```",
    opts.currentDraft,
    "```",
    "",
    "MUDANÇAS SOLICITADAS:",
    opts.instructions,
  ].join("\n");
}

export function buildDiscoveryPrompt(opts: {
  fetchedSources: { url: string; title: string; content: string }[];
  trustedSourceUrls: string[];
  recentIdeaTitles: string[];
  todayISO: string;
}): string {
  const sources = opts.fetchedSources
    .map(
      (s, i) =>
        `### Fonte ${i + 1}: ${s.title}\nURL: ${s.url}\n\nConteúdo extraído (snippet):\n${s.content.slice(0, 2500)}`
    )
    .join("\n\n---\n\n");

  const trusted = opts.trustedSourceUrls.slice(0, 30).join("\n- ");
  const recent = opts.recentIdeaTitles.length
    ? opts.recentIdeaTitles.map((t) => `- ${t}`).join("\n")
    : "(nenhuma)";

  return [
    `Hoje é ${opts.todayISO}. Você é um agente de descoberta de pauta pra o líder descrito no system prompt.`,
    "",
    "OBJETIVO: devolver 8 a 12 ideias de conteúdo (posts ou artigos) que o líder PODE escrever HOJE, com diversidade radical de ângulo, formato e tema.",
    "",
    "VOCÊ TEM A FERRAMENTA web_search. USE de verdade — pelo menos 3 buscas, cada uma com query diferente. Combinações úteis:",
    "- Notícias B2B brasileiras dos últimos 7 dias relacionadas ao posicionamento do líder.",
    "- Estatísticas/relatórios novos que cruzam com os pilares do líder.",
    "- Movimentos recentes de concorrentes ou empresas-referência (Pipefy, Hubspot Brasil, Conta Azul, Stone, etc).",
    "- Posts em alta de criadores que o líder acompanha (busque o nome do criador + ano corrente).",
    "",
    "FONTES QUE O LÍDER JÁ CONFIA (use como qualidade de referência, e quando possível resgate matéria fresca delas via web_search):",
    `- ${trusted}`,
    "",
    "MATÉRIA-PRIMA JÁ EXTRAÍDA DA BIBLIOTECA (use COMO PONTO DE PARTIDA, não como única fonte):",
    sources,
    "",
    "ANTI-PATTERN — IDEIAS RECENTES DESSE LÍDER (NÃO repita assunto nem ângulo. Procure tema novo):",
    recent,
    "",
    "REGRAS DAS IDEIAS (todas obrigatórias):",
    "- Cada ideia traz uma tese AUTORAL. Sem \"a importância de X\", sem \"5 dicas\", sem repercutir notícia sem ângulo próprio.",
    "- DIVERSIDADE FORÇADA — distribua as ideias entre formatos: ao menos 2 contrarian, 2 dado-com-leitura-própria, 2 bastidor/learning, 2 newsjacking concreto, 1 manifesto.",
    "- DIVERSIDADE DE TEMA — cada ideia toca um pilar diferente. Não empilhe 4 ideias sobre o mesmo assunto.",
    "- Cada angle precisa de no MÍNIMO 1 fato concreto (número, nome, data, case). Se não tiver, busca de novo.",
    "- Liga sempre com o cargo + audiência-alvo do líder no system prompt.",
    "- Se uma busca não trouxer fato concreto, joga fora a ideia e tenta outra.",
    "",
    "FORMATO DE SAÍDA — APÓS terminar suas buscas web, devolva JSON puro. SEM markdown, SEM texto antes/depois.",
    "Schema:",
    '{ "ideas": [ { "title": "string ≤ 12 palavras", "angle": "tese autoral 2-3 frases", "why_now": "1 frase sobre timing", "source_url": "URL COMPLETA do artigo/notícia específico", "source_title": "título exato da fonte", "relevance_score": número 0-100 } ] }',
    "",
    "REGRA DURA SOBRE source_url:",
    "- Use a URL EXATA do artigo/notícia/post que inspirou a ideia (que o web_search devolveu ou que está na biblioteca).",
    "- NUNCA use só a homepage do portal. Errado: 'https://valor.com.br' / 'https://exame.com'. Certo: 'https://valor.com.br/empresas/agronegocio/noticia/2025/...' / 'https://exame.com/negocios/empresa-X-anuncia-...'.",
    "- Se você não tem a URL específica do artigo, descarte a ideia e procure outra com fonte rastreável.",
    "- source_title deve ser o título do artigo, não o nome do veículo. Errado: 'Exame'. Certo: 'Magalu anuncia plano de eficiência operacional'.",
    "",
    "Comece pelas buscas web e só depois sintetize as ideias.",
  ].join("\n");
}
