/**
 * Catálogos de presets — tudo o que era texto livre virou seleção.
 * Mexer aqui é mexer no produto inteiro: prompts, UI, validação.
 */

// ------------------------------------------------------------
// TOM
// ------------------------------------------------------------

export const TONE_TRAITS = [
  { key: "direct", label: "Direto", description: "Vai ao ponto, sem rodeio." },
  { key: "provocative", label: "Provocador", description: "Coloca o dedo na ferida." },
  { key: "analytical", label: "Analítico", description: "Mostra a lógica passo a passo." },
  { key: "operator_bts", label: "Mostra os bastidores", description: "Conta como é por dentro da operação." },
  { key: "personal_stories", label: "Conta histórias pessoais", description: "Narrativa em primeira pessoa." },
  { key: "data_first", label: "Começa pelo número", description: "Dados abrem cada argumento." },
  { key: "counterintuitive", label: "Vai contra o consenso", description: "Vira a mesa do que todo mundo acha." },
  { key: "wit", label: "Bem-humorado", description: "Tom leve, sem palhaçada." },
  { key: "market_critic", label: "Crítico de mercado", description: "Aponta o que ninguém quer apontar." },
  { key: "realistic_optimist", label: "Otimista pé-no-chão", description: "Vê o problema, mas aposta na saída." },
] as const;

export type ToneTraitKey = (typeof TONE_TRAITS)[number]["key"];

export const TONE_AVOID = [
  { key: "us_jargon", label: "Jargão americano sem tradução", description: "'Synergy', 'gameplan', 'at the end of the day'." },
  { key: "filler", label: "Floreio corporativo", description: "'No fim do dia', 'no mundo dinâmico de hoje'." },
  { key: "emoji_hooks", label: "Aberturas com emoji", description: "🚀 Esse tipo de coisa." },
  { key: "lessons_lists", label: "Listas de '3 lições'", description: "'7 aprendizados que mudaram tudo'." },
  { key: "motivational", label: "Tom de coach motivacional", description: "Frases de Instagram inspiracional." },
  { key: "self_praise", label: "Auto-elogio explícito", description: "'Tenho orgulho do nosso time...'" },
  { key: "em_dashes", label: "Travessões decorativos (—)", description: "Substitui por ponto ou vírgula." },
  { key: "long_sentences", label: "Frases longas demais", description: "Mais que 25 palavras quebra o ritmo." },
] as const;

export type ToneAvoidKey = (typeof TONE_AVOID)[number]["key"];

// ------------------------------------------------------------
// OBJETIVOS
// ------------------------------------------------------------

export const OBJECTIVES = [
  {
    key: "brand_awareness",
    label: "Reconhecimento de marca",
    description: "Aumentar visibilidade e top-of-mind.",
    promptHint: "Foque em fazer a marca ser lembrada. Cada conteúdo termina com um conceito ownable.",
  },
  {
    key: "lead_gen",
    label: "Geração de leads",
    description: "Atrair pipeline qualificado.",
    promptHint: "Termine com convite sutil a continuar a conversa (DM, link de demo, conteúdo gated). Nunca pitch.",
  },
  {
    key: "recruitment",
    label: "Recrutamento",
    description: "Atrair talento que se identifica com o time.",
    promptHint: "Mostre cultura por dentro. Bastidor de decisão > discurso de RH. Diga o que NÃO somos.",
  },
  {
    key: "thought_leadership",
    label: "Liderança de pensamento",
    description: "Cravar tese e ser citado quando o tema aparece.",
    promptHint: "Conteúdo majoritariamente autoral — aposta, não comentário. Conecta argumento a impacto de negócio.",
  },
  {
    key: "product_release",
    label: "Release de produto",
    description: "Anunciar lançamentos ou features.",
    promptHint: "Voz de operador, não release. Diga o problema antes da solução. Use bastidor.",
  },
] as const;

export type ObjectiveKey = (typeof OBJECTIVES)[number]["key"];

// ------------------------------------------------------------
// FORMATOS
// ------------------------------------------------------------

export const CONTENT_FORMATS = [
  {
    key: "linkedin_post",
    label: "Post de LinkedIn",
    description: "Hook curto, 4-10 parágrafos, voz pessoal.",
    icon: "linkedin",
  },
  {
    key: "article",
    label: "Artigo de autoridade",
    description: "800-1500 palavras com tese e seções, pra imprensa.",
    icon: "fileText",
  },
  {
    key: "newsletter",
    label: "Newsletter",
    description: "1000-2000 palavras com seções nomeadas, voz mais conversacional.",
    icon: "mail",
  },
  {
    key: "twitter_thread",
    label: "Thread de X/Twitter",
    description: "8-15 tweets curtos, cada um carregando 1 ponta da tese.",
    icon: "messageCircle",
  },
  {
    key: "press_release",
    label: "Press release",
    description: "Anúncio formal, lead com fato + corpo + cita.",
    icon: "megaphone",
  },
  {
    key: "talk_script",
    label: "Script de palestra",
    description: "Notas pra falar (não ler), 15-20 minutos.",
    icon: "presentation",
  },
] as const;

export type ContentFormatKey = (typeof CONTENT_FORMATS)[number]["key"];

// ------------------------------------------------------------
// TIPOS DE CONTEÚDO
// ------------------------------------------------------------

export const CONTENT_TYPES = [
  { key: "newsjacking", label: "Reagir a uma notícia quente", description: "Comentar algo que está bombando agora, com o seu ângulo." },
  { key: "bastidor", label: "Mostrar como funciona por dentro", description: "O 'como' da operação que ninguém vê de fora." },
  { key: "contrarian", label: "Defender uma ideia contra o consenso", description: "Mostrar onde o que todo mundo acredita está errado." },
  { key: "comparative", label: "Comparar X vs Y / antes vs depois", description: "Duas formas de fazer, ou dois momentos." },
  { key: "learnings", label: "Erro que ensinou algo", description: "História real do que custou caro e o que aprendeu." },
  { key: "manifesto", label: "Posição forte sobre um tema", description: "Declaração de princípio: você crava onde está." },
  { key: "data_drop", label: "Comentar uma estatística nova", description: "Sua leitura autoral de um número/estudo recém-saído." },
  { key: "case_study", label: "História real de cliente", description: "Um cliente, um número, um aprendizado." },
] as const;

export type ContentTypeKey = (typeof CONTENT_TYPES)[number]["key"];

// ------------------------------------------------------------
// HOOK STYLES (estilos de abertura)
// ------------------------------------------------------------

// Como o líder gosta de ABRIR um post. (Internamente "hook style", mas
// na UI sempre apresentado como "Como abrir o texto".)
export const HOOK_STYLES = [
  {
    key: "number_punch",
    label: "Abrir com um número impactante",
    description: "Estatística específica como primeira linha.",
    example: "87% das empresas medem custo de viagem. 4% medem retorno.",
  },
  {
    key: "contradiction",
    label: "Virar o consenso na primeira frase",
    description: "Dizer o oposto do que todo mundo acha.",
    example: "Todo CFO me pergunta como cortar travel. Resposta certa: aumentar.",
  },
  {
    key: "confessional",
    label: "Admitir algo desconfortável",
    description: "Confissão sincera que cria identificação.",
    example: "Demorei três anos pra entender que estava medindo a coisa errada.",
  },
  {
    key: "provocative_question",
    label: "Fazer uma pergunta provocativa",
    description: "Faz o leitor pausar e responder mentalmente.",
    example: "Quando foi a última vez que o financeiro olhou pra travel como dado?",
  },
  {
    key: "short_punch",
    label: "Frase curta, sem contexto",
    description: "1-4 palavras. Punchline antes da explicação.",
    example: "Funcionou.",
  },
  {
    key: "quote_callout",
    label: "Citar alguém e reagir",
    description: "Cita um líder ou estudo conhecido, depois discorda ou complementa.",
    example: '"O futuro do trabalho é remoto", disse o McKinsey em 2021. Errou.',
  },
  {
    key: "list_promise",
    label: "Prometer uma lista (X coisas que aprendi…)",
    description: "Abre anunciando quantas coisas vêm. Cada item com corpo, sem placeholder.",
    example: "Cinco coisas que aprendi escalando um SaaS B2B de R$ 10M pra R$ 100M.",
  },
  {
    key: "story_open",
    label: "Começar com uma cena concreta",
    description: "Lugar, hora, pessoa. Como se fosse o primeiro frame de um filme.",
    example: "Sexta-feira, 23h. Slack do CEO acende: 'precisamos conversar segunda'.",
  },
  {
    key: "before_after",
    label: "Antes / depois em duas linhas",
    description: "Dois estados contrastantes, sem explicação no meio.",
    example: "2022: 12 viagens corporativas/mês.\n2025: 47. Mesma equipe.",
  },
  {
    key: "data_revelation",
    label: "Revelar um número que pouca gente conhece",
    description: "Dado público mas pouco usado, com leitura própria.",
    example: "Travel corporativo brasileiro: R$ 87 bi/ano. Quanto vira insight de negócio? Quase zero.",
  },
  {
    key: "hypothetical_scenario",
    label: "Abrir com um cenário hipotético",
    description: "Use quando quiser que o leitor se imagine dentro da situação antes de entregar o insight.",
    example: "Imagine que você é CFO de uma empresa que cresceu 40% em 12 meses. O caixa está cheio. E mesmo assim o board cancela seu bônus.",
  },
  {
    key: "common_enemy",
    label: "Apontar um vilão comum (X vs Y)",
    description: "Cria identificação rápida atacando uma prática que sua audiência já odeia em silêncio.",
    example: "CMO que pede dashboard novo toda semana vs CMO que olha o dashboard que já existe. Adivinha qual bate meta.",
  },
  {
    key: "newsjacking",
    label: "Pegar carona em notícia recente",
    description: "Use quando a manchete da semana tem relação direta com sua tese. Leitor reconhece e baixa a guarda.",
    example: "A Magalu demitiu 1.500 pessoas ontem. E os relatórios continuam dizendo que o problema é macroeconomia. Não é.",
  },
  {
    key: "forbidden_truth",
    label: "Verdade que ninguém do mercado fala em público",
    description: "Revela prática, dado ou opinião que circula em bastidor mas raramente aparece em post. Gera autoridade.",
    example: "Nenhum CMO vai te falar isso em palestra: 70% do orçamento de mídia da maioria das empresas B2B está sendo queimado.",
  },
  {
    key: "expensive_lesson",
    label: "Lição que custou caro",
    description: "Aprendizado com o número do que custou. Vulnerabilidade + número específico engaja.",
    example: "Perdi R$ 2,3 milhões em pipeline porque insisti que SDR era papel humano. Hoje meu time tem 1 pessoa e 4 agentes.",
  },
  {
    key: "objection_preempt",
    label: "Antecipar a objeção do leitor",
    description: "Quando a tese é polêmica e você quer desarmar o crítico antes dele comentar.",
    example: "Sim, eu sei. Vão dizer que estou exagerando, que B2B não funciona assim. Mas os últimos 6 trimestres não mentem.",
  },
  {
    key: "cliffhanger_case",
    label: "Teaser de caso real com gancho",
    description: "Abre com o resultado ou virada de um caso, sem entregar o como. Força o leitor a continuar.",
    example: "Em 90 dias trocamos a agência, demitimos metade do time de marketing e dobramos o CAC payback. Numa decisão que o board pediu pra eu não tomar.",
  },
  {
    key: "direct_callout",
    label: "Endereçar diretamente um perfil específico",
    description: "Quando o post é pra um nicho claro. Aumenta relevância pra quem é alvo e filtra o resto.",
    example: "Se você é fundador de SaaS B2B faturando entre R$ 5M e R$ 30M ARR e ainda contrata vendedor sênior por LinkedIn, esse post é pra você.",
  },
  {
    key: "metaphor_reframe",
    label: "Reenquadrar via analogia inesperada",
    description: "Faz o leitor enxergar um problema conhecido por uma lente nova. Cria o momento 'nunca tinha pensado assim'.",
    example: "Funil de vendas é igual encanamento de prédio antigo: ninguém quer mexer enquanto vaza pouco, todo mundo entra em pânico quando estoura no 12º andar.",
  },
  {
    key: "insider_observation",
    label: "Observação de bastidor com tempo de casa",
    description: "Invoca autoridade pela experiência. Funciona melhor quando a observação contradiz o senso comum.",
    example: "Em 14 anos vendendo pra C-level, nunca vi um único deal acima de R$ 1 milhão ser fechado por causa do PDF da proposta.",
  },
] as const;

export type HookStyleKey = (typeof HOOK_STYLES)[number]["key"];

// ------------------------------------------------------------
// MOOD / HUMOR DO LÍDER (usado em variações de geração)
// ------------------------------------------------------------
//
// Cada humor é um estado interno do líder no momento de escrever.
// Quando o líder pede 2-3 versões do mesmo conteúdo, o motor gera
// uma por mood — dando variação semântica de verdade, não só de hook.

export const MOOD_VARIATIONS = [
  {
    key: "best_day",
    label: "No melhor dia",
    description: "Otimista pé-no-chão, energia construtiva.",
    promptHint:
      "Tom equilibrado, aposta no futuro mas ancorado em fato real. Sem motivacional vazio. Vê o problema, aponta a saída.",
  },
  {
    key: "critical",
    label: "Cansado de ver erro",
    description: "Crítico afiado, vai pra cima de uma prática equivocada.",
    promptHint:
      "Frases curtas, verbos fortes. Inimigo nomeado (concorrente, prática, crença). Sem chorar nem reclamar — argumenta com fato e ironia seca.",
  },
  {
    key: "reflective",
    label: "Reflexivo",
    description: "Analítico calmo, conecta pontos com o leitor.",
    promptHint:
      "Primeira pessoa, processo de pensamento explícito. 'Estou pensando que…', 'Cheguei a conclusão depois de…'. Deixa o leitor pensar junto, não conclui sozinho.",
  },
] as const;

export type MoodKey = (typeof MOOD_VARIATIONS)[number]["key"];

// ------------------------------------------------------------
// CARGOS E ÁREAS (presets pra evitar digitação no onboarding/perfil)
// ------------------------------------------------------------

export const ROLE_PRESETS = [
  "CEO / Founder",
  "CMO",
  "CFO",
  "COO",
  "CTO",
  "CPO",
  "CHRO",
  "VP",
  "Diretor(a)",
  "Head",
  "Gerente",
] as const;

export const AREA_PRESETS = [
  "Marketing",
  "Finanças",
  "Operações",
  "Tecnologia",
  "Produto",
  "Vendas / Comercial",
  "RH / Pessoas",
  "Estratégia",
  "Customer Success",
  "Dados / Analytics",
  "Jurídico / Compliance",
  "Travel / T&E",
] as const;

// ------------------------------------------------------------
// TAMANHO DO TEXTO (controla extensão na geração)
// ------------------------------------------------------------

export const CONTENT_LENGTHS = [
  {
    key: "short",
    label: "Curto",
    description: "Punchline rápida, 1-3 parágrafos. Ideal pra pegar atenção.",
    postTarget: "300-500 caracteres em 1-3 parágrafos curtos",
    articleTarget: "400-700 palavras em 2-3 seções diretas",
    maxTokensPost: 700,
    maxTokensArticle: 2200,
  },
  {
    key: "medium",
    label: "Médio",
    description: "Tamanho padrão pra LinkedIn. Conta uma história inteira.",
    postTarget: "700-1200 caracteres em 4-7 blocos curtos",
    articleTarget: "800-1200 palavras em 4-5 seções",
    maxTokensPost: 1400,
    maxTokensArticle: 4000,
  },
  {
    key: "long",
    label: "Longo",
    description: "Tese desenvolvida. Use quando a opinião precisa de espaço.",
    postTarget: "1200-2000 caracteres em 6-10 blocos com sub-argumentos",
    articleTarget: "1500-2500 palavras em 6-8 seções com tese desenvolvida",
    maxTokensPost: 2200,
    maxTokensArticle: 6500,
  },
] as const;

export type ContentLengthKey = (typeof CONTENT_LENGTHS)[number]["key"];

// ------------------------------------------------------------
// AUDIÊNCIAS (segmentos preset)
// ------------------------------------------------------------

export const AUDIENCE_SEGMENTS = [
  { key: "cfo_mid", label: "CFOs de mid-market", description: "500-5000 funcionários, foco em eficiência." },
  { key: "cfo_large", label: "CFOs de grande corp", description: "5000+, foco em controle e ROI." },
  { key: "ceo_founder", label: "CEOs / founders", description: "Decisores top, leem pra estratégia." },
  { key: "head_hr", label: "Heads de RH / People", description: "Foco em cultura, engajamento, retenção." },
  { key: "head_ops", label: "Heads de Operações", description: "Donos da execução, leem pra processo." },
  { key: "head_marketing", label: "CMOs / Heads de Marketing", description: "B2B, foco em demand gen e marca." },
  { key: "head_finance", label: "Controllers / Heads Financeiro", description: "Quem aprova o gasto, não o CFO." },
  { key: "head_travel", label: "Gestores de Travel/T&E", description: "Donos do dia-a-dia da viagem corporativa." },
  { key: "founder_early", label: "Founders early-stage", description: "Pre-seed a Série A." },
  { key: "investors_vc", label: "Investidores VC", description: "Leem pra teses de mercado." },
  { key: "tech_leads", label: "Engineering / Tech Leads", description: "CTOs, engineering managers." },
  { key: "product_leads", label: "Product Leads / CPOs", description: "Donos do roadmap." },
] as const;

export type AudienceSegmentKey = (typeof AUDIENCE_SEGMENTS)[number]["key"];

// ------------------------------------------------------------
// TEMAS / PILARES (sugeridos — líder também escreve livre)
// ------------------------------------------------------------

export const THEMES_LIBRARY = [
  "Travel-as-data",
  "Eficiência operacional",
  "Cultura híbrida",
  "Gestão financeira moderna",
  "B2B SaaS brasileiro",
  "Inteligência artificial aplicada",
  "Gestão de talentos",
  "Estratégia de crescimento",
  "Posicionamento de categoria",
  "Vendas consultivas",
  "Sustentabilidade corporativa",
  "Compliance + agilidade",
];
