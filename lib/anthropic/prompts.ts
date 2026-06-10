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
  // Textos escritos PELO líder — fonte soberana do tom. Opcional pra
  // retrocompat com callers que ainda não carregam (ex: scripts antigos).
  voiceSamples?: { title: string; body: string }[];
  // Story Bank — histórias/números reais do líder (migration 019).
  // Única fonte legítima de caso/número específico além do input.
  stories?: {
    title: string;
    story: string;
    facts: string | null;
    times_used: number;
  }[];
}

/**
 * Versão DESTILADA das regras anti-IA (era ~400 linhas, virou ~60).
 *
 * Por que destilou: o prompt do draft tinha ~10k palavras de instrução,
 * incluindo teoria de 17 livros (SUCCESs, Cialdini, McKee...). Modelo
 * perdia atenção no meio (onde ficava a VOZ do líder), recebia regras
 * conflitantes ("seja ultra-específico" vs "nunca invente número") e
 * escrevia texto defensivo de checklist — com MAIS cara de IA, não
 * menos. Idiossincrasia é o que humaniza, e prompt obeso mata
 * idiossincrasia.
 *
 * A teoria dos livros continua no PLANNER (Opus decide framework e
 * estrutura). O executor precisa de: voz + exemplos + poucas regras
 * duras. A detecção fina (contraposição, triplas, fabricação) é
 * PROGRAMÁTICA no pipeline — não precisa estar no prompt.
 */
const HUMANIZER_RULES = `COMO ESCREVER COMO HUMANO (as 5 primeiras regras são INVIOLÁVEIS):

1. EM DASH (—) PROIBIDO em qualquer uso. Vírgula, ponto ou dois-pontos no lugar. Reticências (...) valem pra pausa.

2. CONTRAPOSIÇÃO PARALELA PROIBIDA em todas as variantes: "não é X, é Y", "não é só X, é Y", "não apenas X, mas Y", "mais do que X, é Y", "não se trata de X", "o que muda / o que não muda". Quebre em duas frases independentes ou corte um lado.
   ✗ "Não é sobre cortar custo, é sobre eficiência." → ✓ "Eficiência rende mais que cortar custo."

3. NUNCA INVENTE NADA: número, nome, data, citação, caso, cena com hora/lugar, resultado medido. Só use fato que veio do input (tema, briefing, materiais, documentos, preferências). Sem o fato? Use "[a confirmar]", linguagem qualitativa ("dobrou", "a maior parte") ou corte o parágrafo. Especificidade falsa é PIOR que generalidade verdadeira. Post curto e verdadeiro vale mais que post longo inventado.

4. MÁXIMO UMA TRIPLA PARALELA no texto inteiro ("X. Y. Z." com mesma estrutura). IA adora tripla; humano não.

5. ZERO emojis, zero negrito unicode, máximo 1 pergunta retórica (nunca "você já parou pra pensar?").

VOZ PT-BR (use ativamente):
- Repetição em vez de sinônimo culto: "O custo subiu. O custo dobrou." Não procure "o dispêndio".
- Strawman dialogado: cite a objeção entre aspas e responda. "'Ah, mas isso não escala.' Escala. Só não do jeito que você mediria."
- "a gente" como pronome de ação interna (não "nós", não "a empresa"), salvo se o líder for formal.
- Termos técnicos em minúscula (ads, mmm, cac, b2b). Caixa alta só pra siglas-nome (TV, CFO, GMV).
- Verbos com sangue: "queimar caixa" > "consumir recursos". Palavras curtas: "pôr de pé" > "operacionalizar".
- Aposto sardônico entre vírgulas: "A reforma, que ninguém leu, entra em vigor."
- Corte hedges e parasitas: basicamente, essencialmente, realmente, obviamente, "vale destacar", "é importante notar", "no fim do dia".
- Sem floreio de abertura: "Em um mundo onde...", "Pensando nisso...", "Trago hoje...". Comece pelo fato ou pela tensão.
- Sem vocabulário IA-coded: jornada, ecossistema, robusto, sinergia, alavancar, mindset, stakeholder (sem tradução).

ALMA (a metade que regras não cobrem — sem isso o texto sai tecnicamente limpo e morto):
- TENHA OPINIÃO. Reaja, aposte, discorde. Texto sem aposta é ruído. "Isso vai dar errado. E rápido." vale mais que um parágrafo analítico.
- DEIXE ENTRAR BAGUNÇA CONTROLADA: uma digressão curta que quase foge do assunto e volta. Uma auto-correção ("Achei que era processo. Era cultura."). Parágrafos de tamanhos DIFERENTES — um de uma frase, outro de quatro linhas.
- ADMITA INCERTEZA quando for real: "Ainda não sei se isso segura no Q4." Humano tem dúvida; IA tem certeza de tudo.
- ESCREVA COMO FALA: se você não mandaria a frase num áudio de WhatsApp pro sócio, reescreva.

FECHAMENTO: seco. Afirmação que aterrissa a tese, payoff concreto ou zinger. Sem resumo, sem "e você, o que acha?", sem CTA mole. Pergunta só se pedir um dado específico do leitor.

AUTO-CHECK (30 segundos antes de entregar):
1. Tem "—"? Corrija.
2. Tem "não é X, é Y" em qualquer variante? Quebre.
3. Cada número/nome/data veio do input? Os que não vieram: "[a confirmar]" ou corte.
4. Os parágrafos têm tamanhos variados? Se uniformes, quebre 2.
5. Tem pelo menos UMA frase com opinião/aposta do líder? Se não, o post é ruído — adicione.
6. Você falaria cada frase em voz alta pro seu time? As que não, reescreva.`;

/**
 * Exemplares de voz pt-BR LinkedIn. São posts REAIS de humanos
 * (Marcelo Linhares CEO Onfly, Elisa Brand Manager Onfly, Vitor Peçanha,
 * Raphael Dykxhoorn da Barte) selecionados pelo Vini como referência
 * de qualidade.
 *
 * IMPORTANTE: o modelo deve estudar RITMO, ESTRUTURA, ANCORAGEM e USO DE
 * REPETIÇÃO/RETICÊNCIAS. NÃO copiar tema nem opinião — cada líder tem o seu.
 *
 * Esses 3 cobrem 3 flavors diferentes (intimista, contrarian, histórico)
 * pra o modelo entender que voz humana em pt-BR LinkedIn não é uma só:
 * a estrutura e as técnicas é que se repetem.
 */
const EXEMPLAR_PT_BR_LINKEDIN = `EXEMPLOS DE EXCELÊNCIA EM PT-BR LINKEDIN (estude RITMO, ESTRUTURA e TÉCNICAS — NÃO copie tema nem opinião; o líder atual tem voz própria definida acima):

═══ EXEMPLO 1 — Flavor INTIMISTA/INFORMAL (Brand Manager, voz coloquial corporativa) ═══
"""
algumas coisas que talvez você não tenha pegado vendo o filme da nossa nova campanha pela primeira vez, e que vou te contar como brand manager da Onfly. :)

1. esta é a primeira campanha B2B aqui no Brasil 100% focada no influenciador da empresa, e não no decisor que assina o contrato. em quem sente a dor na ponta, que sofre com os processos antigos e precisa melhorar a forma que a sua equipe trabalha.

2. esse filme é só o começo. em breve cês vão conferir 6 cases de pessoas que levaram a Onfly pras suas empresas e foram profundamente celebrados ao organizar de verdade toda a gestão de viagens e despesas.

3. decidimos anunciar no cinema por entender que também precisávamos de uma mídia de plena atenção da nossa audiência. uma escolha mega consciente, mas igualmente inovadora pro mercado B2B. se virem a gente na hora dos trailers me contem aqui!

4. um bônus pessoal: essa semana eu completo 30 aninhos e não poderia ter recebido um presente de aniversário melhor: uma campanha linda, feita por uma equipe de Marketing que eu AMO fazer parte.

viagem a trabalho não precisa dar trabalho, né? 🩵
"""
TÉCNICAS USADAS: minúsculas, contrações ("cês", "pra"), ALLCAPS pontual ("AMO"), lista narrativa (cada item parágrafo completo), ancoragem em data ("essa semana completo 30 aninhos"), fechamento com pergunta retórica + emoji ("né? 🩵"), tom de carta aberta.

═══ EXEMPLO 2 — Flavor CONTRARIAN ESTRUTURAL (creator, tese ousada + strawman) ═══
"""
O mercado criou uma ilusão coletiva chamada "marketing digital".

E muita gente acreditou.

A culpa é dos cursos.
Dos reels.
Dos gurus que ensinam a criar "máquinas de dinheiro".

Sabe qual o problema?

As pessoas acham que sabem marketing porque aprenderam a fazer carrossel no Canva.

Sinto informar: isso é operacional. Não é marketing.

Marketing é saber quem é seu cliente. Entender o que você vende. Posicionar. Precificar.

Isso não muda. Nunca mudou. Nem vai mudar.

"Ah, mas eu quero vender mais no Insta..."

Beleza, é uma meta.

Mas só postar em redes sociais não é marketing.
"""
TÉCNICAS USADAS: tese ousada na linha 1, lista de atribuição fragmentada ("A culpa é dos cursos. Dos reels."), endereçamento direto ("Sabe qual o problema?", "Sinto informar:"), repetição estrutural ("Isso não muda. Nunca mudou. Nem vai mudar."), strawman entre aspas ("'Ah, mas eu quero...'") + resposta direta ("Beleza, é uma meta."), fragmentos sentenciais.

═══ EXEMPLO 3 — Flavor HISTÓRICO/NARRATIVO (CEO, citação real + cases nomeados) ═══
"""
Fui educado durante 5 anos ouvindo: "ninguém é demitido contratando IBM."

A lógica era simples: contrate a grife, tire o seu da reta e você manterá o seu emprego pro resto da vida.

Se der errado, afinal, a culpa é da IBM e não sua.

Veja que a Kodak fez isso, a Nokia fez isso, a Sears fez isso.

Todas foram "responsáveis" até o último dia.

O jogo mudou de forma brutal.

O profissional que as empresas querem hoje não é o que evita o risco. É o que corre na frente dele.

A pessoa que pergunta "por que sempre foi assim? por que não pode ser melhor?"

A nova "promoção" vai para quem transformou o processo, não para quem manteve ele intacto pra preservar a cadeira.

A gente fez um vídeo sobre essa pessoa, porque ela existe em todo time e merece ser reconhecida...
"""
TÉCNICAS USADAS: hook por citação real entre aspas, ancoragem temporal ("durante 5 anos"), repetição estrutural ("a Kodak fez isso, a Nokia fez isso, a Sears fez isso"), strawman ("por que sempre foi assim?"), reticências pra suspender (... no fim), fechamento com payoff concreto ("a gente fez um vídeo").

═══ APLIQUE O NÍVEL DE NATURALIDADE DOS 3 EXEMPLOS ═══
O líder atual tem voz própria (definida acima). Não copie a voz dos exemplos. COPIE as técnicas: ancoragem específica, repetição estrutural, strawman dialogado, reticências, lista narrativa, fragmento sentencial. Esses são UNIVERSAIS em pt-BR LinkedIn humano de alto nível.`;

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
/**
 * Constrói uma seção de REGRAS DURAS PERSONALIZADAS quando o líder
 * marca tone_avoid específicos. Não basta dizer "esse líder evita X"
 * — vira um bloco com peso de instrução no topo.
 *
 * Esta função é chamada em separado pra ser inserida no bloco de
 * REGRAS DURAS (não no de "calibração do líder").
 */
function describePersonalHardRules(profile: LeaderProfile): string {
  const avoid = profile.tone_avoid ?? [];
  if (!avoid.length) return "";

  const lines: string[] = [];
  if (avoid.includes("em_dashes")) {
    lines.push(
      "- TRAVESSÃO/EM DASH (—): este líder marcou explicitamente 'nunca usar'. ZERO em dashes no texto. Use vírgula, ponto ou dois-pontos. Esse é um item NÃO NEGOCIÁVEL do perfil dele."
    );
  }
  if (avoid.includes("emoji_hooks")) {
    lines.push(
      "- EMOJI NO HOOK: este líder marcou 'nunca'. Zero emoji nas primeiras linhas. Se for usar emoji, só no fim, com moderação extrema."
    );
  }
  if (avoid.includes("lessons_lists")) {
    lines.push(
      "- LISTAS DE 'X LIÇÕES': este líder NÃO escreve 'X coisas que aprendi', 'Y lições que mudaram tudo', 'N hacks'. Esse formato é proibido. Use prosa corrida ou estrutura narrativa."
    );
  }
  if (avoid.includes("motivational")) {
    lines.push(
      "- TOM MOTIVACIONAL/COACH: este líder não escreve em tom de Instagram inspiracional. Sem 'acredite no processo', 'transforme sua jornada'. Voz direta de operador."
    );
  }
  if (avoid.includes("us_jargon")) {
    lines.push(
      "- JARGÃO AMERICANO SEM TRADUÇÃO: este líder não usa 'synergy', 'gameplan', 'leverage', 'at the end of the day' sem traduzir. Sempre traduza ou substitua."
    );
  }
  if (avoid.includes("filler")) {
    lines.push(
      "- FLOREIO CORPORATIVO: este líder não usa 'no fim do dia', 'no mundo dinâmico de hoje', 'em um cenário cada vez mais X'. Corte qualquer abertura genérica de essay."
    );
  }
  if (avoid.includes("self_praise")) {
    lines.push(
      "- AUTO-ELOGIO EXPLÍCITO: este líder não escreve 'tenho orgulho do meu time', 'estamos transformando o mercado'. Substitua por fato concreto."
    );
  }
  if (avoid.includes("long_sentences")) {
    lines.push(
      "- FRASES LONGAS: este líder marcou 'evitar'. Mantenha frases até 20 palavras. Quebra rítmica obrigatória."
    );
  }

  if (!lines.length) return "";
  return [
    "REGRAS DURAS PERSONALIZADAS DESTE LÍDER (marcadas no perfil dele, não negociáveis):",
    ...lines,
  ].join("\n");
}

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
    docs
      .map((d) => `### ${d.name} (${d.kind})\n${d.content.trim()}`)
      .join("\n\n---\n\n")
  );
}

/**
 * Hierarquia do system prompt — REORGANIZADA pra atenção do modelo.
 *
 * Antes era uma colcha de retalhos: cada seção misturada na mesma página
 * mental. O modelo perdia atenção no meio porque não havia HIERARQUIA
 * de prioridade clara.
 *
 * Agora vai em 6 blocos com cabeçalho explícito de ===, em ordem de
 * primazia. O modelo lê do mais importante (regras duras) ao mais
 * referencial (exemplos), sem confundir o que é instrução com o que é
 * contexto.
 */
export function buildLeaderSystemPrompt(ctx: LeaderContext): string {
  const learnedPrefs = ctx.leader.learned_preferences?.trim();
  const orgDocsContent = describeOrgDocs(ctx.orgDocuments);

  const sections: string[] = [];

  // ─── 1. MISSÃO + REGRA ZERO (compacta) ────────────────────────────────────
  // A versão anterior da Regra Zero tinha 40+ linhas enumerando tudo que é
  // proibido inventar. Compactada: regra absoluta + 4 saídas honestas. O
  // detalhe fino é verificado PROGRAMATICAMENTE (detectFabricatedTokens),
  // não precisa inflar o prompt.
  sections.push(
    [
      "═══ MISSÃO + REGRA ZERO ═══",
      "Você escreve como o líder descrito abaixo — não como a Onfly, não como IA, não como ghostwriter genérico. O texto precisa soar como ELE mandando um áudio longo pro time, transcrito.",
      "",
      "REGRA ZERO (absoluta, ganha de qualquer outra): NUNCA INVENTE NADA.",
      "Nenhum número, nome, data, citação, caso, cena, diálogo ou resultado que não esteja no input (tema, briefing, materiais anexados, documentos, preferências e exemplos do líder).",
      "Sem o fato? Em ordem: (a) placeholder \"[a confirmar]\", (b) linguagem qualitativa (\"dobrou\", \"a maior parte\"), (c) corte o parágrafo. Post curto e verdadeiro vale mais que post longo inventado.",
      "Plausibilidade NÃO é permissão. Se você não sabe de onde veio um fato, ele é inventado.",
    ].join("\n")
  );

  // ─── 2. A VOZ (posição de primazia — é o coração do prompt) ───────────────
  // Antes a voz ficava enterrada no meio de ~10k palavras de regra e teoria
  // (zona cega do modelo). Agora vem logo após a missão: o modelo calibra
  // o registro ANTES de ler qualquer outra coisa.
  //
  // SOBERANIA: quando o líder cadastrou TEXTOS PRÓPRIOS (voice_samples),
  // eles + o fingerprint extraído são a fonte SUPREMA do tom — acima de
  // learned_preferences, acima de qualquer regra geral deste prompt.
  // Textos que ele escreveu com a própria mão > qualquer descrição.
  const voiceParts: string[] = [
    "═══ A VOZ QUE VOCÊ VAI ASSINAR (o mais importante deste prompt) ═══",
  ];

  const samples = (ctx.voiceSamples ?? []).slice(0, 3);
  const fingerprint = ctx.leader.voice_fingerprint?.trim();
  if (samples.length || fingerprint) {
    voiceParts.push(
      "FONTE SOBERANA DO TOM — textos que o líder ESCREVEU COM A PRÓPRIA MÃO.",
      "Hierarquia inegociável: estes textos > fingerprint > preferências aprendidas > qualquer regra geral abaixo. Se uma regra deste prompt conflitar com o jeito que o líder escreve nestes textos, IGNORE A REGRA e siga o texto dele.",
      ""
    );
    if (fingerprint) {
      voiceParts.push(
        "FINGERPRINT DA VOZ (extraído dos textos dele):",
        fingerprint,
        ""
      );
    }
    if (samples.length) {
      voiceParts.push(
        `TEXTOS REAIS DO LÍDER (imite RITMO, VOCABULÁRIO, ABERTURA e FECHAMENTO — nunca o tema):`,
        ...samples.map(
          (s, i) =>
            `--- Texto ${i + 1}: ${s.title} ---\n${s.body.slice(0, 2500)}`
        ),
        ""
      );
    }
  }
  voiceParts.push(describeLeader(ctx.leader));
  sections.push(voiceParts.join("\n"));

  // ─── 2.5 STORY BANK — estoque de especificidade VERDADEIRA ────────────────
  // Resolve a tensão "post bom precisa de caso/número concreto" vs
  // "REGRA ZERO: nunca invente". Histórias registradas pelo próprio
  // líder são a ÚNICA fonte legítima de especificidade além do input
  // da geração. Menos usadas vêm primeiro (anti-repetição).
  const stories = (ctx.stories ?? []).slice(0, 6);
  if (stories.length) {
    sections.push(
      [
        "═══ BANCO DE HISTÓRIAS REAIS DO LÍDER ═══",
        "Casos e números VERDADEIROS que o líder registrou. Quando o post pedir um exemplo/número concreto e o input não trouxer um, USE UMA DESTAS (a mais relevante pro tema) — em vez de inventar ou deixar vago.",
        "Regras: use NO MÁXIMO uma história por post. Não distorça números. Se nenhuma é relevante pro tema, não force — siga sem caso.",
        "",
        ...stories.map((s, i) =>
          [
            `[${i + 1}] ${s.title}${s.times_used > 0 ? ` (já usada ${s.times_used}x — prefira menos usadas)` : " (inédita)"}`,
            s.story.slice(0, 900),
            s.facts ? `Números/dados reais: ${s.facts.slice(0, 400)}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        ),
      ].join("\n\n")
    );
  }

  // ─── 3. REGRAS DE ESCRITA (destiladas) ─────────────────────────────────────
  const personalHardRules = describePersonalHardRules(ctx.leader);
  sections.push(
    [
      "═══ REGRAS DE ESCRITA ═══",
      personalHardRules ? `${personalHardRules}\n\n---` : "",
      HUMANIZER_RULES,
    ]
      .filter(Boolean)
      .join("\n\n")
  );

  // ─── 4. EXEMPLARES DE VOZ PT-BR ────────────────────────────────────────────
  sections.push(EXEMPLAR_PT_BR_LINKEDIN);

  // ─── 5. CONTEXTO (referência, não instrução) ───────────────────────────────
  const contextParts = [
    orgDocsContent
      ? `GUIDELINES DA ONFLY (vinculantes):\n\n${orgDocsContent}`
      : "",
    ctx.referenceProfiles.length
      ? describeReferenceProfiles(ctx.referenceProfiles)
      : "",
    ctx.referenceLinks.length
      ? describeReferenceLinks(ctx.referenceLinks)
      : "",
    ctx.leaderDocuments.length ? describeLeaderDocs(ctx.leaderDocuments) : "",
  ].filter(Boolean);
  if (contextParts.length) {
    sections.push(
      ["═══ CONTEXTO DE APOIO ═══", ...contextParts].join("\n\n")
    );
  }

  // ─── 6. LEMBRETE FINAL (recência) + PRIORIDADES ────────────────────────────
  sections.push(
    [
      "═══ ANTES DE ENTREGAR ═══",
      learnedPrefs
        ? `Preferências aprendidas deste líder (confira item a item):\n${learnedPrefs}\n`
        : "",
      "Prioridades em conflito:",
      "1. Soar como o líder (a amostra de voz acima é a referência). Tom pessoal ganha do tom Onfly.",
      "2. Ter opinião. Texto sem aposta é ruído.",
      "3. Se há materiais anexados, citar pelo menos UM fato específico deles.",
      "4. REGRA ZERO ganha de tudo: na dúvida entre específico-inventado e vago-verdadeiro, vago-verdadeiro.",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return sections.join("\n\n");
}

const POST_GUIDELINES = `FORMATO: post de LinkedIn em português.

ANTES DE ESCREVER — CHECKLIST OBRIGATÓRIO:
1. CONTROLLING IDEA (McKee): formula em UMA frase declarativa o que o post vai defender. Cabe em 1 linha. Se não cabe, o post não tem tese.
2. DESTINATÁRIO ÚNICO (Halvorson): nomeie pra QUEM você escreve. Não "líderes" — "CMO B2B de SaaS brasileiro entre 50-300 funcionários montando o primeiro time de growth". Sem destinatário específico, vira essay genérico.
3. PROPÓSITO (Halvorson): pra que serve esse post? Mudar opinião / convidar pra reflexão / marcar posição / processar publicamente um erro / pegar carona em notícia. Cada propósito muda formato.
4. EDGE CHECK (Godin Purple Cow): qual a BORDA que esse post defende? Se qualquer creator do setor concordaria de cara, o post é morno. Reescreva pra criar atrito produtivo.
5. DM-TEST: termina pensando "alguém comentaria isso com argumento próprio ou mandaria no DM?". Se a resposta é "diriam 'gostei'", está morno.

FRAMEWORK NARRATIVO (escolha UM, não misture):

Opção A — STORY ARC EM 5 PARTES (default pra bastidor/aprendizado):
1. HOOK (2-3 linhas pré "ver mais")
2. ANCHOR (citação real / ano / caso nomeado / cena com hora-lugar)
3. CORPO (contexto → inflexão → detalhe concreto → reflexão)
4. ÂNCORA VISUAL (frase isolada no meio carregando a tese)
5. CLOSE SECO (assertion / payoff / zinger)

Opção B — PAS (Problem-Agitate-Solve) — use pra mudar opinião:
1. PROBLEM: problema em 1 linha com dado ("87% das empresas medem custo de viagem. 4% medem retorno.")
2. AGITATE: consequência específica em 1-2 linhas, SECA (sem drama "isso está te custando milhões!")
3. SOLVE: o que dá pra fazer agora, concreto

Opção C — BAB (Before-After-Bridge) — use pra mostrar transformação real:
1. BEFORE: como você fazia antes ("Antes eu olhava CAC mensal.")
2. AFTER: como faz hoje ("Hoje olho CAC por cohort de canal por mês.")
3. BRIDGE: a mudança específica que destravou ("Parar de usar média ponderada quando o mix de canal muda.")

Opção D — CONTRARIAN STRUCTURED — use pra hot take com lastro:
1. AFIRMAÇÃO contrarian em 1-2 linhas
2. VALIDAÇÃO do que parece estranho ("muita gente vai discordar e tem motivo")
3. LASTRO: o dado, ciência, experiência que sustenta
4. IMPLICAÇÃO prática
5. FECHO que provoca reflexão sem ser pergunta retórica

A escolha do framework é DECISÃO EDITORIAL. Hoje você é o autor — pegue um que case com o objetivo, declare mentalmente qual escolheu, e mantém coerência interna. Misturar PAS com BAB no mesmo post gera lama.

PARTE 1 — HOOK (primeiras 2-3 linhas, visíveis antes do "...ver mais")

Hook precisa marcar 3 de 4 dos U's de Bob Bly:
- USEFUL: o leitor sabe o que ganha de ler até o fim?
- URGENT: por que LER agora? (sem clickbait barato — só se for de fato relevante)
- UNIQUE: outro creator do mesmo setor diria isso? Se sim, refaça
- ULTRA-SPECIFIC: tem número, nome, tempo, lugar concreto

Padrões testados (escolha UM):
- Revelação pessoal: "Eu acreditava em X. Estava errado." (contrarian/aprendizado)
- Estatística surpresa: "X meses atrás eu [ação]. Eis o que rolou."
- Frustração relatável: "O que ninguém fala sobre X é Y."
- Afirmação ousada: "X está morto. Por isso Y."
- Citação histórica: "[Frase específica entre aspas com origem real]."
- Cena curta: "[Lugar, hora]. [Ação específica]." Ex: "Sexta, 23h. Slack do CEO acende."

NUNCA use: "Você já parou pra pensar...", "Trago hoje uma reflexão...", "Compartilho com vocês...", "Tem uma coisa que aprendi...", "Vou contar uma história..."

CURIOSITY GAP NO HOOK (Loewenstein / Heath):
O hook precisa CRIAR uma lacuna entre o que o leitor sabe e o que ele sente que poderia saber. 4 tipos:
- OUTCOME GAP: revela o resultado, esconde o como. "Esse cargo virou R$ 1,2M em pipeline em 6 meses. Não foi o que imaginei."
- CAUSE GAP: revela efeito, esconde causa. "Nosso CAC caiu 31% em janeiro. Não foi otimização de mídia."
- IDENTITY GAP: revela personagem inesperado. "A pessoa que destravou nosso funil de SaaS foi a estagiária de RH."
- NUMBER GAP: número estranho que pede explicação. "Cortei 4 reuniões semanais. Sobrou 11h pra vender."
A lacuna do hook PRECISA fechar no corpo. Hook que promete e não entrega é clickbait. Banido.

PARTE 2 — ANCHOR (1-2 parágrafos curtos, OBRIGATÓRIO)
Logo após o hook, ANCORA o argumento em algo CONCRETO E REAL:
- Citação real entre aspas (livro, líder histórico, ditado de mercado)
- Ano, idade, momento ("Fui educado por 5 anos ouvindo...", "Há 30 anos atrás...")
- Caso nomeado (empresa, produto, pessoa que já apareceu no input)
- Cena observada com hora/lugar
Sem âncora, vira essay genérico de IA mesmo seguindo as outras regras.

PARTE 3 — CORPO (arco narrativo)
Não despeje fatos. Conte uma história curta:
a) Contexto: onde você estava, qual era o problema, por que a solução tradicional não servia
b) Inflexão: o momento que algo mudou — um número, uma observação, um experimento
c) Detalhe concreto: um número específico, um nome, uma cena, um arquivo
d) Reflexão: 1-2 frases sobre o que isso muda na sua tese
Cada bloco = 1-3 linhas. Quebra de linha entre blocos. Generosa.

PARTE 4 — CLOSE SECO (1-2 linhas finais) — DEFAULT É ASSERTION, NÃO PERGUNTA

Fecho seco é o padrão. Afirmação curta e direta que aterriza a tese e deixa o leitor pensando. SEM CTA, SEM pergunta retórica, SEM "espero ter ajudado", SEM "simples assim".

Três padrões aceitos (escolha UM, sem combinar):
- Assertion fragmento (PREFERIDO): "Mas só postar em redes sociais não é marketing." (Vitor Peçanha) / "A gente vai onde elas estiverem." (Vini)
- Payoff concreto: "A gente fez um vídeo sobre essa pessoa." (Marcelo Linhares)
- Zinger pessoal: "Não opero com o alerta ligado." (Raphael)

Pergunta só é aceitável EXCEPCIONALMENTE quando o post genuinamente pede um dado/case específico do leitor ("Me manda a sua taxa de no-show."). NÃO use pergunta retórica genérica ("e você, o que acha?").

OBRIGATÓRIO evitar: "Comente aí o que achou", "Deixa sua opinião nos comentários", "Espero ter ajudado", "E você, o que acha disso?", "Bora trocar uma ideia?", "Simples assim", "No fim do dia".

Por que assertion bate pergunta: post que fecha com afirmação forte deixa o leitor pensando ("ele cravou"). Post com pergunta clichê parece neediness ("olha como sou interativo, comenta aí"). Autoridade fecha sem pedir resposta.

ARQUITETURA VISUAL — frase-âncora isolada (OBRIGATÓRIO em posts médios e longos)
A cada 2-3 parágrafos, ISOLE uma frase forte em linha própria, sem texto antes nem depois no mesmo bloco. Ela funciona como pausa visual e ponto de fixação pro olho que rola o feed.

Exemplo do efeito:
"""
Os números do dashboard mentiram durante seis meses.

Não porque a ferramenta estava errada. A gente estava medindo a coisa errada.

Performance não é só sobre canal pago.

É sobre quanto da sua receita você defende quando o leilão dobra de preço amanhã.
"""
A linha "Performance não é só sobre canal pago." é a âncora. O olho para nela mesmo em scroll rápido.

Use a frase-âncora pra carregar a TESE CENTRAL ou um INSIGHT AFIADO. Não desperdice com filler.

REGRAS DE FORMATAÇÃO:
- Máximo 2-3 linhas por parágrafo. Espaço em branco é dinheiro no LinkedIn.
- Uma frase pode ser um parágrafo inteiro. Isolada. Pra dar peso.
- Padrão de respiração: alterne tamanho de parágrafo. 1 linha → 2-3 linhas → 1 linha → 2 linhas. Bloco corrido de 4+ linhas é morte da escaneabilidade.
- Bullets só quando o conteúdo é genuinamente enumerável. Use → ou • (não numerar).
- Se usar bullets: estrutura paralela (todos começam com verbo OU todos com substantivo).
- ZERO emojis no default. Só use emoji se o tone_examples do líder mostra que ele usa de fato (raro). Default = nenhum emoji em hook, corpo ou fim.
- ZERO negrito pseudo-unicode (𝗮𝘀𝘀𝗶𝗺). Cheira a hack de algoritmo. Use só asteriscos markdown se a UI exibir.

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

HEADINGS (não negocie):
- INFORMACIONAL, não meta-poético. Headings descrevem o argumento da seção, não fazem rodeio:
  ✓ "O ticket médio dobrou em 3 anos"
  ✗ "A planilha que parou no tempo"
  ✓ "Como ler travel como dado"
  ✗ "A confusão de categoria"
  ✓ "Por que CFO erra o sinal"
  ✗ "A linha do meio"
- Máximo 8 palavras por heading.
- Frase normal: maiúscula só no início. Sem Title Case Inglês.
- NÃO tente fazer cada heading virar uma "tweet". Headings de coluna de imprensa real são informativas, não punchy.

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
  // NOVO: quando o líder anexou material e a leitura extraiu fatos,
  // estes são INJETADOS NO TOPO do user prompt como FOCO OBRIGATÓRIO.
  // Sem isso, o modelo lê os attachments como "contexto" e escreve
  // sobre outro tema. Com isso, o post É OBRIGATORIAMENTE sobre os fatos.
  mustCiteFacts?: string[];
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

  // FOCO OBRIGATÓRIO: quando o líder anexou material e a leitura
  // extraiu fatos, o post DEVE girar em torno deles. Sem essa
  // instrução no topo, o modelo vê os fatos como "contexto" no
  // attachmentsToPromptBlock e escreve sobre outro tema.
  const facts = opts.mustCiteFacts ?? [];
  const focusBlock =
    facts.length > 0
      ? [
          "🎯 FOCO OBRIGATÓRIO DO POST (baseado em material lido pelo líder)",
          "",
          "ESTE POST DEVE SER SOBRE OS FATOS LISTADOS ABAIXO.",
          "O líder anexou material específico esperando que o post fale sobre o conteúdo dele.",
          "Se você ignorar esses fatos e escrever sobre outro tema, o material lido foi desperdiçado.",
          "",
          "Fatos centrais (escolha 1-2 pra ancorar o post):",
          ...facts.slice(0, 8).map((f, i) => `  ${i + 1}. ${f}`),
          "",
          "REGRA DURA:",
          "- O hook DEVE referenciar o tema central destes fatos.",
          "- O corpo DEVE desenvolver pelo menos UM desses fatos com perspectiva autoral do líder.",
          "- Se o tema dos fatos não combina com o perfil do líder (off-topic), reescreva fazendo a PONTE explícita entre o fato e a tese do líder.",
          "- NUNCA gere post genérico sobre o tema do material. SEMPRE ancore em fato específico listado.",
          "",
        ].join("\n")
      : "";

  return [
    `TAREFA: produzir um ${opts.format === "linkedin_post" ? "POST DE LINKEDIN" : "ARTIGO DE AUTORIDADE"} sobre o tema abaixo, assinado pelo líder descrito no system prompt.`,
    "",
    focusBlock, // PRIMEIRO no user prompt quando há facts
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

/**
 * Lentes de descoberta — rotacionadas a cada chamada pra evitar o loop
 * de "mesmos temas, mesmos ângulos". Sem rotação, o agente faz sempre
 * as mesmas buscas e devolve variações das mesmas pautas.
 */
const DISCOVERY_LENSES = [
  "REGULAÇÃO E COMPLIANCE: mudanças regulatórias, fiscais ou trabalhistas recentes que afetam o setor do líder. Ângulo: o que ninguém percebeu na letra miúda.",
  "MACROECONOMIA APLICADA: juros, câmbio, inflação — mas SÓ com tradução pro dia a dia do gestor (custo de viagem, budget, headcount).",
  "CASE INTERNACIONAL AINDA SEM ECO NO BRASIL: movimento de empresa gringa que vai chegar aqui em 12-24 meses. Ângulo: antecipação.",
  "DADO CONTRAINTUITIVO DE RELATÓRIO NOVO: pesquisa/estudo recém-publicado com número que contradiz o senso comum do setor.",
  "MOVIMENTO DE CONCORRENTE OU ADJACENTE: captação, demissão, pivot, lançamento de player próximo do mercado do líder.",
  "GESTÃO DE PESSOAS E CULTURA: tendência de trabalho/liderança quente AGORA (RTO, IA no trabalho, burnout, contratação).",
  "TECNOLOGIA APLICADA AO SETOR: lançamento de IA/ferramenta com impacto direto no trabalho da audiência do líder.",
  "CONTRARIAN A UMA PAUTA QUENTE: pegue a notícia mais comentada da semana no nicho e procure o ângulo que ninguém defendeu.",
  "HISTÓRIA ANTIGA COM LIÇÃO ATUAL: aniversário de evento de mercado (falência, fusão, lançamento) que ilumina algo de hoje.",
  "BASTIDOR DE FUNÇÃO: dor operacional específica do cargo da audiência que nunca vira post (planilha, ritual, aprovação, reunião).",
];

export function buildDiscoveryPrompt(opts: {
  fetchedSources: { url: string; title: string; content: string }[];
  trustedSourceUrls: string[];
  recentIdeaTitles: string[];
  recentDraftTopics?: string[];
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
  const recentDrafts = opts.recentDraftTopics?.length
    ? opts.recentDraftTopics.map((t) => `- ${t}`).join("\n")
    : "(nenhum)";

  // Sorteia 4 lentes por chamada — a rotação garante que duas rodadas
  // seguidas de discovery exploram territórios diferentes.
  const lenses = [...DISCOVERY_LENSES]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  return [
    `Hoje é ${opts.todayISO}. Você é um agente de descoberta de pauta pra o líder descrito no system prompt.`,
    "",
    "OBJETIVO: devolver 8 a 12 ideias de conteúdo (posts ou artigos) que o líder PODE escrever HOJE, com diversidade radical de ângulo, formato e tema.",
    "",
    "🔎 LENTES OBRIGATÓRIAS DESTA RODADA (sorteadas — pelo menos 1 ideia por lente; é isso que impede o loop de sempre os mesmos temas):",
    ...lenses.map((l, i) => `${i + 1}. ${l}`),
    "",
    "VOCÊ TEM A FERRAMENTA web_search. USE de verdade — pelo menos 4 buscas, UMA POR LENTE acima, cada uma com query diferente.",
    "",
    "FONTES QUE O LÍDER JÁ CONFIA (use como qualidade de referência, e quando possível resgate matéria fresca delas via web_search):",
    `- ${trusted}`,
    "",
    "MATÉRIA-PRIMA JÁ EXTRAÍDA DA BIBLIOTECA (use COMO PONTO DE PARTIDA, não como única fonte):",
    sources,
    "",
    "🚫 ANTI-LOOP (regra dura de exclusão):",
    "Ideias já sugeridas a esse líder — se a sua ideia toca o MESMO TEMA CENTRAL de qualquer item abaixo (mesmo com ângulo diferente), DESCARTE e busque outra:",
    recent,
    "",
    "Temas sobre os quais o líder JÁ ESCREVEU recentemente (idem — território saturado, só volte aqui se houver fato NOVO desta semana que mude a leitura):",
    recentDrafts,
    "",
    "APRENDIZADO: o system prompt traz as preferências aprendidas desse líder (o que rendeu nota alta). Priorize ângulos compatíveis com esses padrões, MAS reserve 2 ideias pra territórios que ele NUNCA tocou (exploração).",
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
