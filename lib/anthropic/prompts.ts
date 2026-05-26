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
- Liste 3 itens só quando os 3 têm peso próprio e tamanho diferente. Liste pareando substantivo curto + número, não adjetivos.`;

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

PRINCÍPIOS:
- HOOK na primeira linha. Tem que prender. Estilo segue o "ESTILO DE HOOK PEDIDO" se houver — senão use o que melhor servir o objetivo.
- Quebras de linha generosas. LinkedIn corta no terceiro parágrafo, então respiração visual conta.
- TAMANHO PADRÃO QUANDO NÃO HÁ PEDIDO EXPLÍCITO: post curto, 500-900 caracteres em 3-5 blocos. NÃO ultrapasse esse limite a menos que o usuário peça explicitamente.
- Substância sempre: ao menos um número específico, recorte de bastidor concreto, OU declaração inequívoca de aposta.
- Fechamento adequa-se ao OBJETIVO:
  · brand_awareness → frase ownable (slogan da ideia).
  · lead_gen → convite sutil pra continuar a conversa (não pitch).
  · recruitment → diz o que NÃO somos / quem se identifica.
  · thought_leadership → aposta sobre o futuro.
  · product_release → bastidor do que veio antes do produto.
- Hashtags: máximo 3, no fim, e só se fizerem sentido. Pode não ter nenhuma.

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

  return [
    `TAREFA: produzir um ${opts.format === "linkedin_post" ? "POST DE LINKEDIN" : "ARTIGO DE AUTORIDADE"} sobre o tema abaixo, assinado pelo líder descrito no system prompt.`,
    "",
    `TEMA: ${opts.topic}`,
    lengthHint,
    objectiveHint,
    contentTypeHint,
    hookHint,
    toneHint,
    "",
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
    '{ "ideas": [ { "title": "string ≤ 12 palavras", "angle": "tese autoral 2-3 frases", "why_now": "1 frase sobre timing", "source_url": "URL real (web_search ou biblioteca)", "source_title": "título da fonte", "relevance_score": número 0-100 } ] }',
    "",
    "Comece pelas buscas web e só depois sintetize as ideias.",
  ].join("\n");
}
