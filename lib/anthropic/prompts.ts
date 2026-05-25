import type {
  ContentFormat,
  LeaderDocument,
  LeaderProfile,
  OrgDocument,
  ReferenceLink,
  ReferenceProfile,
} from "@/lib/db/types";

interface LeaderContext {
  leader: LeaderProfile;
  referenceProfiles: ReferenceProfile[];
  referenceLinks: ReferenceLink[];
  leaderDocuments: LeaderDocument[];
  orgDocuments: OrgDocument[];
}

const HUMANIZER_RULES = `REGRAS ANTI-IA (não negociáveis, mais importante que qualquer outra coisa):
- Sem em dashes (—) decorativos. Use ponto, vírgula ou ponto-e-vírgula.
- Sem paralelismos negativos do tipo "não é X, é Y" ou "isto não apenas A, mas também B".
- Sem três adjetivos em sequência. Corte para um.
- Sem hooks tipo "🚀 3 lições..." ou "Você já parou pra pensar...".
- Sem listas numeradas com bullets vazios. Toda lista precisa de corpo e opinião.
- Sem floreio tipo "no mundo dinâmico de hoje", "em um cenário cada vez mais", "venha conosco".
- Voz ativa. Sujeito explícito quando possível.
- Frases curtas. Pode quebrar uma linha sozinha pra dar peso.
- Use número específico em vez de adjetivo vago. "47%" > "uma boa parte".
- Use português brasileiro corporativo de operador. Não traduza jargão americano cru.`;

function describeLeader(profile: LeaderProfile): string {
  const traits = profile.tone_traits.length
    ? profile.tone_traits.join(", ")
    : "sem traços de tom definidos";
  const avoid = profile.tone_avoid.length
    ? profile.tone_avoid.join(", ")
    : "sem listas de evitar";
  return `O LÍDER QUE VOCÊ VAI ASSINAR:
- Nome: ${profile.full_name}
- Cargo: ${profile.role}
- Área: ${profile.area}
- LinkedIn: ${profile.linkedin_url ?? "—"}
- Audiência-alvo: ${profile.target_audience}
- Objetivo principal de thought leadership: ${profile.main_objective}

TOM DE VOZ:
- Traços a usar: ${traits}
- Coisas que esse líder NUNCA escreveria: ${avoid}
- Exemplos do tom dele(a):
${profile.tone_examples ?? "(não fornecido — extrapole a partir dos traços acima)"}

BRIEFING ADICIONAL DO LÍDER:
${profile.custom_briefing ?? "(nenhum)"}`;
}

function describeReferenceProfiles(refs: ReferenceProfile[]): string {
  if (!refs.length) return "PERFIS DE REFERÊNCIA: nenhum fornecido.";
  return (
    "PERFIS DE REFERÊNCIA (estude o estilo, padrões de hook, ritmo. NÃO copie tema nem opinião):\n" +
    refs
      .map(
        (r, i) =>
          `${i + 1}. ${r.name} — ${r.url}\n   Por que importa: ${r.why_relevant ?? "—"}\n   Hooks/exemplos: ${r.hook_examples ?? "—"}`
      )
      .join("\n\n")
  );
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

ESTRUTURA OBRIGATÓRIA:
- HOOK em uma única linha. Forte. Pode ser número, contradição, recorte de bastidor, declaração curta.
- Quebra de linha. Sempre quebre linhas para criar respiração visual (LinkedIn corta no terceiro parágrafo).
- Corpo de 4 a 10 parágrafos CURTOS. Cada parágrafo no máximo 2-3 linhas.
- Ao menos um número específico OU um recorte de bastidor concreto.
- Fechamento que provoca pensamento ou convida a comentar. Sem CTA agressivo.
- Sem hashtag em excesso. Máximo 3, no fim, e só se fizerem sentido.
- Tamanho ideal: entre 900 e 1500 caracteres. Pode ir até 1900 se a história pedir.

ENTREGUE APENAS O POST. Sem cabeçalho, sem explicação, sem "aqui está seu post". Apenas o texto pronto pra copiar e colar.`;

const ARTICLE_GUIDELINES = `FORMATO: artigo de autoridade / coluna de imprensa em português.

ESTRUTURA:
- Título curto e provocativo (até 12 palavras). Promete uma tese, não descreve o assunto.
- Lead de 2 a 3 frases: ancora o leitor, dá o recorte e antecipa a tese.
- 4 a 7 seções com sub-títulos curtos (3-6 palavras). Cada seção desenvolve UM argumento.
- Cada seção tem 2-4 parágrafos, sem listas decorativas. Listas só quando o conteúdo for de fato enumerável.
- Pelo menos um dado, número ou referência concreta por seção.
- Conclusão que cristaliza a tese e deixa uma aposta pro futuro.
- Tamanho ideal: 800 a 1500 palavras.

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
}): string {
  const formatRules =
    opts.format === "linkedin_post" ? POST_GUIDELINES : ARTICLE_GUIDELINES;

  return [
    `TAREFA: produzir um ${opts.format === "linkedin_post" ? "POST DE LINKEDIN" : "ARTIGO DE AUTORIDADE"} sobre o tema abaixo, assinado pelo líder descrito no system prompt.`,
    "",
    `TEMA: ${opts.topic}`,
    "",
    opts.brief ? `BRIEFING DO LÍDER:\n${opts.brief}` : "BRIEFING DO LÍDER: (sem briefing — use os documentos e contexto do system prompt).",
    "",
    opts.extraInstructions
      ? `INSTRUÇÕES EXTRAS:\n${opts.extraInstructions}`
      : "",
    "",
    formatRules,
  ].join("\n");
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
}): string {
  const sources = opts.fetchedSources
    .map(
      (s, i) =>
        `### Fonte ${i + 1}: ${s.title}\nURL: ${s.url}\n\nConteúdo extraído:\n${s.content.slice(0, 4000)}`
    )
    .join("\n\n---\n\n");

  return [
    "TAREFA: analisar as fontes que o líder acompanha e gerar 6 a 10 ideias de conteúdo (posts ou artigos) que ele pode escrever AGORA.",
    "",
    "FONTES DISPONÍVEIS (matéria-prima crua):",
    sources,
    "",
    "REGRAS DAS IDEIAS:",
    "- Cada ideia deve ser AUTORAL: o líder precisa ter uma opinião própria sobre o tema, não só repercutir.",
    "- Conectar com a área e a audiência-alvo descritas no system prompt.",
    "- Trazer ângulo contraintuitivo, dado novo, ou conexão entre tema externo e operação interna.",
    "- Ignorar ideias genéricas (\"a importância de X\", \"5 dicas pra Y\").",
    "- Priorizar timeliness — assuntos que estão quentes e o líder pode comentar com autoridade.",
    "",
    "FORMATO DE SAÍDA: JSON puro. NADA de texto antes ou depois. NADA de markdown. Objeto único com chave `ideas`, array de objetos com:",
    "- title (string): título da ideia, máximo 12 palavras",
    "- angle (string): a tese / aposta autoral do líder (2-3 frases)",
    "- why_now (string): por que esse tema é relevante agora (1 frase)",
    "- source_url (string): URL da fonte que inspirou (uma das fornecidas)",
    "- source_title (string): título da fonte",
    "- relevance_score (number): 0-100, quão alinhado com posicionamento do líder",
    "",
    "Exemplo de schema:",
    '{ "ideas": [ { "title": "...", "angle": "...", "why_now": "...", "source_url": "...", "source_title": "...", "relevance_score": 85 } ] }',
  ].join("\n");
}
