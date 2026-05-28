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
- Em dash (—) PROIBIDO em qualquer uso. Não existe em dash "não decorativo" aqui. Nunca use o caracter —. Substitua por ponto, vírgula ou dois-pontos.
  ✗ "O modelo, lançado em 2023, virou referência." (com em dash em volta da aposição)
  ✓ "O modelo, lançado em 2023, virou referência."
  Antes de finalizar, faça Ctrl+F por "—" no texto. Se achar um sequer, corrija.

- CONTRAPOSIÇÃO PARALELA (segundo maior tell de IA depois do em dash) é PROIBIDA em TODAS as variantes:
  ✗ "Não é X, é Y."
  ✗ "Não é só X, é Y."
  ✗ "Não apenas X, mas Y."
  ✗ "Não se trata de X, é/mas Y."
  ✗ "Mais do que X, é Y."
  ✗ "Isso não é X, é Y."
  ✗ "Não é sobre X, é sobre Y."

  Esses padrões soam como ensaio de cursinho ou texto motivacional. Líder humano com voz própria reformula em frases independentes ou corta um dos lados.

  Como reescrever cada padrão:
  ✗ "Não é sobre cortar custo, é sobre eficiência."
  ✓ "Eficiência rende mais que cortar custo." (vira afirmação direta)

  ✗ "Mais do que ferramenta, é processo."
  ✓ "É processo. Ferramenta resolve depois." (vira 2 frases)

  ✗ "Isso não é só performance, é estratégia."
  ✓ "Isso é estratégia. Performance vem como consequência." (vira 2 frases)

  ✗ "Não se trata de medir tudo, é sobre medir o certo."
  ✓ "Mede o certo. Não tudo." (curto, direto)

  Antes de finalizar, releia procurando o padrão "Não [verbo] ..., [verbo]". Se achar UM SEQUER, reescreve.
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

FRONT-LOAD (UX Writing): primeira palavra do hook e de cada parágrafo precisa ser SUBSTANTIVO CONCRETO ou VERBO DE AÇÃO. Nunca artigo + adjetivo genérico ("Uma reflexão importante sobre...", "Um aprendizado essencial..."). O leitor decide em 1.7s se continua, e a primeira palavra carrega o gancho.
  ✗ "Uma constatação interessante que tive..."
  ✓ "O CAC subiu 35% no Q3."
  ✗ "Algo que aprendi nos últimos meses..."
  ✓ "Demiti minha gerente de growth."

HEDGE WORDS (mata autoridade — corte sem dó):
"meio que", "tipo assim", "de certa forma", "basicamente", "essencialmente", "fundamentalmente", "praticamente", "realmente", "verdadeiramente", "honestamente", "obviamente", "claramente", "francamente", "simplesmente".
Regra Zinsser: se uma frase precisa de "obviamente", a frase não é óbvia. Tire.

NOMINALIZAÇÃO (Zinsser): troque "verbo de apoio + substantivo abstrato" por VERBO DIRETO.
  ✗ "Tomamos a decisão de cortar." → ✓ "Decidimos cortar."
  ✗ "Fizemos uma análise do problema." → ✓ "Analisamos o problema."
  ✗ "Realizou uma melhoria no processo." → ✓ "Melhorou o processo."
  ✗ "Houve um equívoco da minha parte." → ✓ "Errei."

EUFEMISMO DE CARREIRA (banido — soa institucional fake):
- "oportunidade de aprendizado" → diga "fracasso" / "erro"
- "ajuste de rota" → diga "recuo" / "voltei atrás"
- "movimento de eficiência" → diga "demissões" / "corte de pessoal"
- "buscamos novos desafios" → diga "fui demitido" / "saí"
- "decisão estratégica" → diga o que era de fato a decisão
Líder humano fala em palavra concreta. Eufemismo é tela de RH.

ADVÉRBIOS EM -MENTE: corte 80%. Substitua por verbo forte ou tire.
  ✗ "Rapidamente cresceu" → ✓ "Disparou."
  ✗ "Profundamente impactou" → ✓ "Mudou de vez."
Mantém só quando o advérbio carrega significado preciso ("imediatamente" pode ser preciso; "imediatamente importante" não é).

PASSIVIZAÇÃO ESCONDIDA EM PT-BR:
"se vê", "se nota", "se percebe", "se observa", "se faz necessário" — soa institucional, sem sujeito. Nomeia quem age.
  ✗ "Se vê muito CMO repetindo isso" → ✓ "Vejo muito CMO repetindo isso" / "CMO repete isso direto"
  ✗ "Se faz necessário rever" → ✓ "Precisa rever"

PRONOMES (default Onfly):
- Quando o líder fala da empresa/time/ação interna, prefira "a gente" em vez de "nós", "a empresa", "a Onfly como organização". O nome da empresa aparece quando faz sentido referenciá-la como marca, mas o PRONOME DE AÇÃO é sempre "a gente".
  ✓ "A gente decidiu cortar o canal." / "A gente vai onde o cliente está."
  ✗ "Nós decidimos cortar o canal." (formal demais pra LinkedIn pt-BR)
  ✗ "A empresa decidiu cortar." (distante, soa terceira pessoa)
- Esse pronome humaniza sem perder autoridade. Funciona até em tese sofisticada ("a gente aprendeu que share of search prevê demanda 6 meses antes").
- EXCEÇÃO: se o líder explicitamente usa "nós" / "minha equipe" no tone_examples ou learned_preferences, respeite — alguns líderes mais formais não usam "a gente".

CAPITALIZAÇÃO DE TERMOS TÉCNICOS:
- Termos técnicos do dia a dia em MINÚSCULA, mesmo quando "parecem" merecer caixa alta:
  ✓ ads, sdrs, ooh, mmm, kpi, cac, ltv, roi, b2b, b2c, saas, ic, vp, head
  ✗ ADS, SDRs, OOH, MMM, KPI, CAC, LTV, ROI
- Capitalizar SÓ siglas que viraram nome próprio em fala / marca / instituição:
  ✓ TV, CFO, CEO, GMV, IBM, AWS, GPT, IA
- Por quê: termo técnico capitalizado cheira a "ostenta jargão". Em minúscula soa "pratico isso todo dia, não preciso enfeitar".

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
- Inclua UMA digressão curta, uma frase entre o meio e o fim que parece quase fora do assunto mas conecta ("Lembrei disso vendo o Slack do meu time domingo de noite."). Texto IA mantém foco perfeito; humano vagueia 1 segundo e volta.
- Vocabulário pode misturar registro: termo técnico do operador + uma palavra coloquial inesperada na mesma frase. "Margem queima e a galera vê pelo dashboard." Isso quebra a regularidade.
- Pequenas auto-correções intencionais funcionam às vezes: "Achei que era processo. Era cultura." Cria sensação de pensamento em movimento, não de slide finalizado.

TÉCNICAS DE VOZ PT-BR (use ATIVAMENTE — destilado de creators humanos top em pt-BR LinkedIn):

1. RETICÊNCIAS (...) PRA PAUSA NATURAL. Use em fim de frase ou no meio quando o ponto cortaria muito seco. Substitui o em dash decorativo sem virar AI tell.
   ✓ "O jogo mudou..."
   ✓ "Não posso contar mais detalhes, o time de marketing me xinga."
   ✗ "O jogo mudou — e rápido."

2. REPETIÇÃO ESTRUTURAL EM VEZ DE SINÔNIMO. IA buscar sinônimo culto (synonym cycling). Humano martela a mesma palavra pra ênfase. Quebre esse instinto.
   ✓ "Isso não muda. Nunca mudou. Nem vai mudar."
   ✓ "A Kodak fez isso, a Nokia fez isso, a Sears fez isso."
   ✗ "A Kodak adotou essa postura, a Nokia seguiu o caminho, a Sears trilhou rota similar."

3. STRAWMAN / DIÁLOGO IMAGINADO. Cite uma objeção entre aspas e responda direto. Cria diálogo com o leitor sem cair em "Você já parou pra pensar?".
   ✓ "'Ah, mas eu quero vender mais no Insta...' Beleza, é uma meta. Mas só postar não é marketing."
   ✓ "Aquele papo de 'vou dar mais uma chance'."

4. ANCORAGEM ESPECÍFICA. Abra (ou ancore o argumento no meio) com ANO, IDADE, CITAÇÃO HISTÓRICA real, ou LUGAR/MOMENTO específico. Texto sem ancoragem cheira a IA mesmo quando segue todas as outras regras.
   ✓ "Fui educado durante 5 anos ouvindo: 'ninguém é demitido contratando IBM.'"
   ✓ "Há 30 anos atrás, joguei futsal..."
   ✓ "Essa semana eu completo 30 aninhos."
   ✗ "Sempre achei que liderança fosse algo importante" (abstrato, sem âncora)

5. ENDEREÇAMENTO DIRETO COM FRAGMENTO. Vire o texto pra fora com fragmento curto.
   ✓ "Sabe qual o problema?"
   ✓ "Veja que..."
   ✓ "Sinto informar:"
   ✓ "Vou te contar."

6. ALLCAPS PONTUAL (1-2 palavras). Ênfase emocional, NUNCA frase inteira, NUNCA em hooks.
   ✓ "isso me deixa feliz DEMAIS"
   ✓ "eu AMO essa equipe"
   ✗ "ISSO É EXTREMAMENTE IMPORTANTE PRA TODOS"

7. APOSTO SARDÔNICO / SELF-DEPRECATING. Frase entre vírgulas que mostra a dinâmica interna do líder/time, sem rodeio.
   ✓ "Não posso contar mais detalhes, o time de marketing me xinga."
   ✓ "A reforma, que ninguém leu, entra em vigor."

8. LISTA NARRATIVA EM VEZ DE BULLET SHORTHAND. Quando enumerar, cada item é um PARÁGRAFO de 2-4 linhas com pensamento completo, não "**Título:** explicação curta". Numere com "1.", "2." ou cite no corpo.
   ✓ "1. esta é a primeira campanha B2B aqui no Brasil 100% focada no influenciador da empresa, e não no decisor que assina o contrato. em quem sente a dor na ponta, que sofre com os processos antigos..."
   ✗ "1. **Foco no influenciador:** mudamos o foco da campanha."

9. CONTRAÇÕES BRASILEIRAS CORPORATIVAS (use APENAS se o tone_examples/learned_preferences do líder indicam registro informal — verifique antes). Quando aplicável:
   "cês", "pra", "tá", "né", "a gente", "tipo".
   Mistura com termo técnico = registro autêntico. Não force se o líder é mais formal.

10. CITAÇÃO HISTÓRICA / DITADO COMO HOOK. Frase entre aspas com origem real (livro, época, mercado) é um dos hooks mais fortes em pt-BR LinkedIn.
    ✓ "ninguém é demitido contratando IBM."
    ✓ Radical Candor chama isso de Empatia Arruinadora.

ESTRUTURA OBSERVADA EM POSTS TOP DE CREATORS HUMANOS PT-BR (5 partes):
- HOOK (1-2 linhas): claim, citação, ano, ou fato concreto. Não pergunta.
- ANCHOR (2-4 linhas): UM momento/caso/citação específica que ancora o argumento. Sem isso, vira essay genérico.
- TENSÃO (3-6 linhas): o que muda, o que tá errado, o que ninguém vê. Aqui entra repetição estrutural e strawman.
- REFRAME (2-3 linhas): a virada que reposiciona o problema (de "achavam X" pra "na verdade Y").
- CLOSE (1-2 linhas): zinger pessoal, fragmento curto, ou aposta. NÃO precisa ser pergunta.

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

FATO VS. FABRICAÇÃO (regra dura — número inventado é veneno):
- NUNCA invente números que o líder não forneceu. Não no topic, não no brief, não no extra_instructions, não nos anexos, não no learned_preferences.
- Se você PRECISA de um número pra dar concretude, faça uma destas três coisas — nessa ordem:
  a) Use número que VEIO de algum input (citado entre [ ] na referência)
  b) Use uma faixa qualitativa específica ("dobrou em 3 anos", "metade do time")
  c) Coloque "[número a confirmar]" como placeholder explícito — o líder preenche depois
- Aproximações fabricadas tipo "algo entre 1.200 e 1.500 empresas" são tells. Líder real fala o número exato ou diz que não tem.
- Diálogo construído também é fabricação. Só use diálogo se o input mencionou explicitamente.
- Nome próprio: idem. Se a Letícia não foi nomeada no input, não invente uma Letícia.

PADRÕES PROIBIDOS COMO ABERTURA:
- "Lembrei disso vendo X" / "Esses dias vi X e me lembrou" (virou clichê novo, substituindo "pensando nisso")
- "Vou contar uma coisa" / "Tenho uma confissão" / "Há algum tempo..." (introdução de história sem ancoragem)
- Tudo o que aparecia em ABERTURAS PROIBIDAS continua valendo. Aberturas reais começam pelo FATO ou pela TENSÃO.

PALAVRAS PARASITAS PT-BR (Zinsser "On Writing Well" + observação de copy brasileiro):
Caça e elimina. São palavras que ocupam espaço sem carregar peso:
- Hedges fracos: "basicamente", "essencialmente", "fundamentalmente", "praticamente", "literalmente" (no sentido figurado), "realmente", "verdadeiramente", "claramente"
- Atrasos: "começa a entender", "vem a ser", "tenta fazer", "passa a ter", "vai estar fazendo"
- Meta-comentário: "fato é que", "vale ressaltar que", "é interessante notar que", "cabe destacar"
- Enchimento: "vamos ser sinceros", "convenhamos", "convém lembrar"
- Conectores fracos: "diga-se de passagem", "por sinal", "aliás é"
- "Que" supérfluo: "o time que está crescendo" → "time em crescimento"; "as pessoas que trabalham com isso" → "quem trabalha com isso"
Regra Zinsser: se a palavra pode ser cortada sem mudar o significado, ela é clutter. Corte.

CURSE OF KNOWLEDGE (Heath, "Made to Stick"):
Você usa termos que esqueceu que aprendeu. Pra o leitor, é jargão. Teste cada termo técnico:
- Você usaria essa palavra falando com seu cunhado de outro setor?
- Não? Traduz ou explica em 5 palavras inline.
- Ex: "MMM" → "modelagem que mede o que cada canal gera de venda real (MMM)"
- Ex: "category entry points" → "momentos do dia em que a marca pode aparecer"
- Ex: "go-to-market" → "como você leva o produto pro mercado"
Líder técnico que traduz parece mais autoridade, não menos. Esconder o jargão atrás de tradução = sinal de quem realmente domina.

CONTROLLING IDEA (McKee, "Story"):
Antes de escrever qualquer parágrafo, formule a CONTROLLING IDEA do post em UMA frase declarativa. Ex: "Performance pura virou dependência de canal pago." / "Memória de marca em B2B rende juros compostos." Essa frase precisa:
- Ser DECLARATIVA (afirma, não pergunta)
- Ter UM substantivo central + UM verbo de ação + UM resultado
- Caber numa única linha do LinkedIn
Se o post não pode ser resumido em UMA frase declarativa, não tem controlling idea, e vira essay sem foco. Reformule ou descarte.

DATA VS STORY (McKee/Gerace, "Storynomics"):
"Data lista o que aconteceu; story expressa COMO e POR QUÊ aconteceu."
- Despejar dado sem encadeamento causal = post morto. "47% crescemos" sem o porquê = ruído.
- Story pega o mesmo dado e mostra: o que veio antes, o que mudou, o que veio depois. Causalidade > frequência.
- Marketing virou RHETORIC (argumento de um lado só) e perdeu credibilidade. Story restaura porque admite a outra possibilidade.
- Antes de aprovar um parágrafo, pergunte: "esse fato tá explicando COMO/POR QUÊ algo aconteceu, ou só listando?". Se só lista, embuta numa cadeia causal ou corta.

CLIENTE É O HERÓI, LÍDER É O GUIA (Donald Miller, "StoryBrand SB7"):
Erro fatal: posicionar o líder como o HERÓI da história do post. Funciona em bio, não em LinkedIn.
- No LinkedIn, o LEITOR é o herói. Ele tem uma dor, uma ambição, um problema. O LÍDER aparece como o GUIA (tipo Obi-Wan pro Luke, Yoda pra Skywalker), oferecendo princípio/framework/aposta que o leitor pode usar.
- Implicação prática:
  ✗ "Eu fiz X, conquistei Y, hoje sou Z." (líder como herói = auto-promoção)
  ✓ "Você é CMO que enfrenta X. Aqui está o ângulo que ninguém comenta:" (leitor como herói, líder como guia)
- O líder pode contar a PRÓPRIA história, mas a função narrativa é mostrar UM PRINCÍPIO que o LEITOR pode aplicar. Não é "olha o que conquistei", é "isso que vivi te dá um framework".
- Quem aparece com humildade no LinkedIn (vulnerabilidade calibrada + número específico do erro próprio) vira o guia ideal. Quem aparece como herói cansa em 3 posts.

3 NÍVEIS DE PROBLEMA (Donald Miller, "StoryBrand SB7"):
Todo problema que você toca no post tem 3 camadas. Articule TODAS as 3, sem pular:
- EXTERNO (o sintoma visível): "CAC subiu 35%."
- INTERNO (a frustração emocional): "Aquela sensação de tá pedalando sem sair do lugar."
- FILOSÓFICO (por que isso É INJUSTO ou IMPORTANTE no nível humano/profissional): "Trabalhar duro deveria render. Mais marketing deveria gerar mais venda."
Post que só toca no externo (sintoma) parece técnico raso. Post que toca nos 3 níveis CONECTA porque o leitor sente que você entende a dor dele de verdade. Modelo:
  1ª frase = externo (fato visível)
  2ª frase = interno (a sensação que isso gera)
  3ª frase (opcional, ousada) = filosófico (a injustiça/quebra de promessa)

TESTE DO GRUÑIDO (Donald Miller adaptado, "StoryBrand"):
Antes de publicar, finja ser um homem de caverna lendo seu post nos primeiros 5 segundos. Ele consegue grunir uma resposta a estas 3 perguntas?
1. O QUE você está dizendo? (tese clara)
2. COMO isso melhora a vida dele? (utilidade pro leitor)
3. O QUE ele faz com isso? (próximo passo implícito)
Se a resposta a qualquer uma é "não consegue grunir", o post tá confuso. Refaça.

DOIS ERROS QUE MARCAS COMETEM (Donald Miller):
1. Não focar em SOBREVIVÊNCIA/PROSPERIDADE do leitor (comer, dormir, ganhar dinheiro, manter time, evitar demissão, fechar deal). Texto que não toca em algo que ajuda o leitor sobreviver/prosperar = é só ruído pro cérebro dele.
2. Forçar o leitor a "QUEIMAR CALORIAS" entendendo o que você quer dizer. Cérebro humano descarta texto que exige esforço. Simplicidade não é pobreza, é respeito pelo tempo do leitor.

O "PORQUE" MÁGICO (Cialdini, "Influence"):
Experimento de Ellen Langer: pedir pra furar fila com "posso usar a copiadora?" → 60% compliance. Com "posso usar a copiadora PORQUE estou com pressa" → 94% compliance. Com "posso usar PORQUE preciso fazer cópias" (motivo redundante) → 93%. A palavra "porque" SOZINHA dispara compliance automática.
Aplicação: em closes que pedem ação (raro, mas válido), use "porque" + motivo concreto.
✓ "Comenta sua taxa de no-show porque quero ver se 12% é fora da curva ou normal."
✗ "Comenta sua taxa." (sem porque, força fraca)
Evite "porque" no hook (cheira a explicação preguiçosa). Use no close se for pedir algo específico.

SHOW DON'T TELL (Zinsser + Heath):
Mostre com cena ou número específico em vez de explicar com adjetivo.
✗ "A reunião foi intensa." → ✓ "3 sócios, 2 horas, 0 decisão."
✗ "O cliente ficou irritado." → ✓ "Resposta dele veio às 23h17. 4 linhas, 1 ponto final."
✗ "Crescemos rápido." → ✓ "Triplicamos em 11 meses."
A cena concreta carrega o adjetivo implícito. O leitor sente, não recebe instrução de sentir.

HOOK POINT ÚNICO (Brendan Kane, "Hook Point"):
Hook genérico é qualquer hook que outro creator do mesmo setor poderia ter escrito. Hook ÚNICO é o ângulo que SÓ você teria por causa de quem você é, do que fez, do que viu.
✗ "AI vai mudar tudo." (qualquer um diria)
✓ "Vi um time de SDR de 12 virar 2 pessoas + 4 agentes em 90 dias. Caixa não notou." (só quem viveu isso diria)
Teste: se trocar o autor por outro creator brasileiro de B2B, a frase ainda funcionaria? Sim → genérica. Não → única.

PURPLE COW TEST (Seth Godin):
"Vale ser comentado?" — não viralizar, ser RE-MARCÁVEL (literalmente: alguém vai comentar/marcar isso). Antes de finalizar, pergunte-se: alguém da minha audiência teria algum motivo CONCRETO pra comentar isso? Motivos válidos:
- Discordar com argumento próprio
- Adicionar uma evidência da própria experiência
- Marcar alguém que precisa ler
- Pedir mais detalhe de um número/case
Se a resposta é "diriam 'gostei'" ou "concordariam silenciosamente", o post é morno. Reescreva pra criar atrito produtivo.

CURIOSITY GAP (entre parágrafos):
Cada parágrafo precisa criar UMA micro-tensão que faça o próximo ser necessário. Não termina parágrafo com conclusão fechada; termina com pista, virada ou afirmação ousada que pede explicação.
✗ "Foi um aprendizado importante. Decidi mudar de estratégia." (sem curiosity)
✓ "Foi quando percebi o tamanho do erro." [próximo parágrafo conta qual erro]
Aplique em pelo menos 2 transições do post.

SUCCESs CHECK (Heath, "Made to Stick"):
Antes de finalizar, marque mentalmente: o post tem cada uma destas?
- S (Simple): UMA ideia central, não 3
- U (Unexpected): há alguma virada que quebra expectativa do leitor?
- C (Concrete): pelo menos 1 número específico, nome, ou cena tangível
- C (Credible): a tese tem evidência ou experiência nomeada por trás?
- E (Emotional): há tensão emocional (medo, frustração, orgulho, surpresa) nomeada?
- S (Story): há narrativa curta com sujeito, ação, consequência?
Falta 2+ destes = post genérico. Adicione antes de entregar.

GATILHOS DE CIALDINI (Influence, ative quando aplicável):
Cada post precisa ATIVAR pelo menos UM gatilho de persuasão:
- AUTORIDADE: cite experiência, número de anos, ou case nomeado ("em 14 anos vendendo pra C-level, nunca vi...")
- PROVA SOCIAL: número de pessoas/empresas que fazem ou comprovam ("87% dos CMOs B2B reportam...")
- ESCASSEZ: janela de tempo ou irreversibilidade ("essa janela fecha em 6 meses", "não tem volta")
- RECIPROCIDADE: entregue valor antes de pedir qualquer coisa (1 insight prático antes do CTA)
- COMPROMISSO: alinhe com algo que o leitor já acredita ("se você já entendeu X, sabe que Y também é verdade")
- LIKING: vulnerabilidade nomeada cria proximidade ("errei e perdi R$ 2,3 mi")
Não força os 6. UM bem ativado vale por todos genéricos.

ANTI-PADRÕES DE CONCLUSÃO (Anatomy of Story, Truby):
Conclusão precisa fechar com MORAL ARGUMENT (a aposta) ou GHOST RELEASED (o que mudou no autor). Evita:
- "Espero que tenha gostado" (assistente, não autor)
- "E você, o que acha?" (cede autoridade)
- "Esse é só o começo de uma longa..." (cliché motivacional)
- "Refletir sobre isso pode trazer..." (vazio)
Use: ASSERTION final que aterriza a controlling idea, ou GHOST released (uma frase do tipo "tive que aceitar X pra avançar").

AUTO-CHECK FINAL (faça antes de entregar):
1. CONTROLLING IDEA: o post tem UMA tese declarativa que cabe em 1 linha? Se não, reescreva.
2. HOOK ÚNICO: o hook só você poderia ter escrito (autoria, experiência, ângulo)? Se qualquer creator pudera dizer, é genérico.
3. SUCCESs: marca os 6 critérios. Falta 2+, adicione.
4. PURPLE COW: alguém comentaria isso com argumento próprio? Se não, está morno.
5. BUSCA POR "—": há UM SEQUER em dash? Se sim, troque por vírgula/ponto/dois-pontos. Zero é o único resultado aceitável.
6. PALAVRAS PARASITAS: caça "basicamente", "essencialmente", "fato é que", "vale ressaltar". Corte.
7. CURSE OF KNOWLEDGE: cada termo técnico foi traduzido ou explicado em 5 palavras?
8. CURIOSITY GAP: pelo menos 2 transições entre parágrafos criam micro-tensão?
9. SHOW vs TELL: você descreveu (adjetivo) algo que poderia ter sido mostrado (cena/número)?
10. CONTRAPOSIÇÃO: tem "não é X, é Y" / "Estava certo na X, errado na Y" / "O que muda/O que não muda"? Quebre.
11. TRIPLAS: tem mais de UMA tripla paralela? Quebre as extras.
12. NÚMEROS: cada número veio do input? Se inventou, vira "[a confirmar]" ou qualitativo.
13. CONCLUSÃO: termina com assertion (tese) ou ghost released (transformação), nunca com "espero que" / "e você?".
14. PREFERÊNCIAS APRENDIDAS do líder: cada item respeitado? Releia.`;

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

  // ─── 0. REGRA ZERO — acima de tudo ────────────────────────────────────────
  // Vini foi explícito: "NUNCA INVENTE ABSOLUTAMENTE NADA". Esse princípio
  // é o primeiro bloco que o modelo lê. Está ACIMA de regras de voz,
  // estética, anti-IA. Se respeitar essa regra significa devolver um post
  // mais curto ou nenhum post, o motor devolve curto ou nenhum.
  sections.push(
    [
      "═══ REGRA ZERO — ABSOLUTA, ACIMA DE TODAS AS OUTRAS ═══",
      "",
      "NUNCA INVENTE ABSOLUTAMENTE NADA.",
      "",
      "PROIBIDO inventar:",
      "- NÚMERO de qualquer tipo: percentual, valor monetário (R$, US$), contagem, tempo (horas, dias, meses), idade, ano, taxa, score, multiplicador.",
      '- NOME PRÓPRIO de qualquer tipo: pessoa, empresa, produto, ferramenta, marca, cargo específico, cidade, escritório, departamento.',
      "- CITAÇÃO entre aspas: nada entre aspas que não esteja LITERALMENTE no input do líder ou nos materiais anexados.",
      "- CASO/EXEMPLO: nenhuma empresa, projeto, situação, cliente, deal que não tenha sido explicitamente mencionado.",
      "- DATA: nem dia, nem mês, nem ano específico, nem trimestre (Q3 2025, etc).",
      "- LUGAR / CENA: nem cidade, escritório, sala, evento, reunião com horário específico.",
      "- DIÁLOGO: nada que alguém disse, a menos que esteja literal no input.",
      "- DECISÃO INTERNA DO LÍDER: nada do que o líder \"fez/decidiu/cortou/contratou/demitiu\" se não foi descrito explicitamente.",
      "- RESULTADO MEDIDO: nenhum efeito numérico (\"o CAC caiu X%\", \"crescemos Y\") se não veio do input.",
      "- METODOLOGIA INTERNA: nenhum framework, processo, ritual específico da Onfly que não esteja documentado nos org_documents ou tone_examples.",
      "",
      "ONDE PODE BUSCAR FATOS (em ordem de prioridade):",
      "1. Topic, brief, extra_instructions que o líder forneceu.",
      "2. Materiais anexados (key_facts da comprehension, ou web_search se ativo).",
      "3. Documentos do líder e da Onfly carregados no prompt (DOCUMENTOS DE BASE / GUIDELINES).",
      "4. tone_examples ou learned_preferences (cenas/fatos que o líder JÁ contou antes).",
      "",
      "SE VOCÊ NÃO TEM O FATO, suas opções (em ordem):",
      "A. Use placeholder explícito ENTRE COLCHETES: \"[número a confirmar]\", \"[nome do cliente]\", \"[ano específico]\". O líder substitui depois.",
      "B. Use linguagem qualitativa SEM número específico: \"dobrou\", \"a maior parte\", \"a maioria do time\", \"ainda crescia\", \"meses\".",
      "C. Peça o fato ao líder: \"Vou precisar do número exato do seu caso pra escrever isso bem.\"",
      "D. NÃO ESCREVA esse parágrafo. Reduza o post. Vai bem sem ele.",
      "",
      "PRINCÍPIOS DURÍSSIMOS:",
      "- Se você não sabe DE ONDE veio um fato no que está escrevendo, ele é INVENTADO. Não use.",
      "- Plausibilidade NÃO é permissão. \"Provavelmente é assim\" / \"faz sentido ter sido X%\" = INVENÇÃO.",
      "- Especificidade FALSA é PIOR que generalidade verdadeira. \"R$ 2.847 em 4 meses\" inventado = morte de credibilidade. \"Algumas centenas de mil em meses\" honesto = legítimo.",
      "- Quando o líder pede algo específico de um material que você NÃO acessou, resposta correta = \"Não acessei [material]. Cola o trecho específico que você quer usar.\" Resposta ERRADA = prosa genérica.",
      "- Se o material foi anexado mas a comprehension falhou (vazia/low_signal), você NÃO TEM esse conteúdo. Trate como se não tivesse sido anexado.",
      "",
      "ENTREGA: prefere POST MAIS CURTO ou MENSAGEM HONESTA do que post inventado. Líder humano publica algo curto e verdadeiro, não publica nada falso.",
      "Esta regra está ACIMA de qualquer outra deste prompt. Quando houver conflito, ela ganha.",
    ].join("\n")
  );

  // ─── 1. MISSÃO ─────────────────────────────────────────────────────────────
  sections.push(
    [
      "═══ MISSÃO ═══",
      "Você é o motor de thought leadership da Onfly. Sua única missão é produzir conteúdo que pareça 100% escrito pelo líder descrito abaixo: não pela Onfly como marca, não por uma IA, não por ghostwriter genérico.",
      "",
      "Você processa o input em DUAS etapas mentais:",
      "1. LEITURA ATIVA — extrai tese, fatos, citações e entidades do que o líder forneceu (incluindo materiais extraídos). Sem leitura ativa, vira post genérico.",
      "2. ESCRITA NA VOZ — usa esses fatos como matéria-prima, e a voz do líder + as regras de marca como FORMA.",
      "",
      "Lembre da REGRA ZERO acima. Está ACIMA de tudo, incluindo desta missão. Nada de inventar.",
    ].join("\n")
  );

  // ─── 2. REGRAS DURAS (mais importante) ─────────────────────────────────────
  const personalHardRules = describePersonalHardRules(ctx.leader);
  sections.push(
    [
      "═══ REGRAS DURAS (NÃO NEGOCIÁVEIS) ═══",
      orgDocsContent
        ? `GUIDELINES DA ONFLY (vinculantes, precedem qualquer preferência individual):\n\n${orgDocsContent}\n\n---`
        : "",
      personalHardRules
        ? `${personalHardRules}\n\n---`
        : "",
      HUMANIZER_RULES,
    ]
      .filter(Boolean)
      .join("\n\n")
  );

  // ─── 3. CALIBRAÇÃO INDIVIDUAL DO LÍDER ─────────────────────────────────────
  sections.push(
    [
      "═══ CALIBRAÇÃO DESTE LÍDER ═══",
      describeLeader(ctx.leader),
      ctx.referenceProfiles.length
        ? `\n${describeReferenceProfiles(ctx.referenceProfiles)}`
        : "",
      ctx.referenceLinks.length
        ? `\n${describeReferenceLinks(ctx.referenceLinks)}`
        : "",
      ctx.leaderDocuments.length
        ? `\n${describeLeaderDocs(ctx.leaderDocuments)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  // ─── 4. EXEMPLARES DE VOZ PT-BR ────────────────────────────────────────────
  sections.push(EXEMPLAR_PT_BR_LINKEDIN);

  // ─── 5. LEMBRETE FINAL DAS PREFERÊNCIAS APRENDIDAS ─────────────────────────
  if (learnedPrefs) {
    sections.push(
      [
        "═══ LEMBRETE FINAL — PREFERÊNCIAS APRENDIDAS ═══",
        "Antes de entregar, releia ponto a ponto e confira que o texto respeita CADA UM destes itens (feedback acumulado deste líder específico):",
        "",
        learnedPrefs,
      ].join("\n")
    );
  }

  // ─── 6. PRIORIDADES (decisão de conflito) ──────────────────────────────────
  sections.push(
    [
      "═══ PRIORIDADES EM CASO DE CONFLITO ═══",
      "1. Soar como o líder. Se o tom da Onfly entrar em conflito com o tom pessoal do líder, ganha o tom pessoal, desde que respeite as REGRAS DURAS acima.",
      "2. Trazer opinião autoral. Conteúdo sem aposta é ruído.",
      "3. Conectar argumento a impacto de negócio mensurável quando couber.",
      "4. CTA, se houver, é sutil. Convite a continuar a conversa, nunca pitch.",
      "5. Se há materiais anexados, o draft DEVE citar pelo menos UM fato específico deles (número, nome próprio, citação nominal). Material existe pra ser USADO, não pra inspirar prosa genérica.",
    ].join("\n")
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
