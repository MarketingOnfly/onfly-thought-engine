-- ------------------------------------------------------------
-- Migration 007 — org_documents seed (frameworks de escrita)
--
-- Carrega 8 guias condensados de frameworks de influência e
-- storytelling, em português, para serem injetados como contexto
-- no prompt do gerador de posts de LinkedIn para C-level.
--
-- Tudo idempotente: cada insert checa por nome antes de gravar.
-- ------------------------------------------------------------

-- 1. Cialdini — 7 princípios de influência
insert into public.org_documents (name, content, kind, is_active)
select 'Cialdini — 7 princípios de influência', $BODY$
Guia operacional dos 7 gatilhos de Cialdini para uso em posts de C-level. Não citar Cialdini no texto. Escolher 1 ou 2 gatilhos por post, nunca empilhar tudo.

1. RECIPROCIDADE
Pessoas devolvem o que receberam. No post, isso vira: entregar primeiro um aprendizado real (número, framework, decisão que deu errado) antes de qualquer convite. O CTA, quando houver, vem depois de uma entrega concreta.
Exemplo: "Compartilhei a planilha que usamos pra decidir onde cortar viagem em 2025. Vou deixar o link no comentário. Se ajudar, me conta o que cortou."

2. COMPROMISSO E COERÊNCIA
Pessoas tendem a manter posições que assumiram em público. No post, isso vira: pedir que o leitor declare algo pequeno (concordar com uma premissa, escrever a categoria dele nos comentários) antes de propor a tese maior.
Exemplo: "Se você é CFO e olhou o gasto de viagem do último trimestre sem desconfiar de nada, escreve 'tranquilo' nos comentários. Vou voltar nesse post em 30 dias."

3. PROVA SOCIAL
Pessoas decidem olhando o que pessoas parecidas fizeram. No post, citar pares específicos por categoria, não por nome. Funciona melhor com referência setorial concreta do que com "todo mundo".
Exemplo: "Conversei com 6 CFOs de SaaS B2B esse mês. Cinco baixaram travel spend sem mexer em headcount. O sexto ainda acha que viagem é linha pequena."

4. AUTORIDADE
Pessoas obedecem quem demonstra competência. Em post, autoridade não se reivindica, se mostra: detalhe específico que só quem operou conhece, número não-público, bastidor de decisão.
Exemplo: "Nos primeiros 90 dias depois que viramos a política de viagem, perdi dois VPs. Voltaram em 45 dias quando viram o impacto no fim do trimestre. Hoje o programa é deles."

5. SIMPATIA
Pessoas dizem sim para quem gostam. Simpatia em post de líder não é piada, é vulnerabilidade calibrada: assumir erro específico, mostrar que estava errado em algo que defendia, citar quem te ensinou.
Exemplo: "Defendi por dois anos que política de viagem mata cultura. Errei. O que mata cultura é não ter política e cada um interpretar."

6. ESCASSEZ
Pessoas valorizam o que é raro. Em post, escassez é de informação, não de produto: dado que poucos têm, janela de mercado curta, momento específico que não vai voltar.
Exemplo: "A janela pra renegociar contrato com OTA fecha em fevereiro. Quem chegar em março paga preço de 2025 até 2027."

7. UNIDADE
Pessoas seguem quem é "dos nossos". No post, unidade vem de marcadores de tribo: linguagem do operador, referência interna do setor, dor que só quem está dentro conhece.
Exemplo: "Quem nunca abriu o relatório de viagem no domingo de noite com medo do que ia achar, não está em finanças."

REGRA DE COMBINAÇÃO: prova social + autoridade funciona em post de tese. Reciprocidade + escassez funciona em post com convite. Simpatia + unidade funciona em post de bastidor. Nunca usar os 7 no mesmo post.
$BODY$, 'voice_guidelines', true
where not exists (
  select 1 from public.org_documents where name = 'Cialdini — 7 princípios de influência'
);

-- 2. Made to Stick — SUCCESs framework
insert into public.org_documents (name, content, kind, is_active)
select 'Made to Stick — SUCCESs framework', $BODY$
SUCCESs é o checklist do Heath para fazer uma ideia grudar. Cada letra é um teste que o post tem que passar antes de publicar. Não precisa marcar os 6 num post só, mas precisa marcar pelo menos 3.

S — SIMPLE (simples / núcleo)
Reduzir a ideia a uma frase que carrega o essencial. Se o leitor sair com uma só frase, qual é? O resto do post existe pra defender essa frase, não pra adicionar outras teses.
Exemplo: "Viagem corporativa não é despesa, é dado da operação." Tudo no post serve essa frase.

U — UNEXPECTED (inesperado)
Quebrar o padrão que o leitor espera. Começar pelo contraintuitivo, pelo número que contradiz a tese de mercado, pela pergunta que ninguém faz. Se o primeiro parágrafo poderia abrir 50 posts iguais, refaz.
Exemplo: "O CFO que mais corta viagem é o que mais perde receita no trimestre seguinte." Inverte a expectativa de que cortar é virtuoso.

C — CONCRETE (concreto)
Sair do abstrato. Trocar "eficiência operacional" por "reduzimos o tempo de aprovação de 4 dias para 6 horas". Quanto mais sensorial e específico, mais gruda. Substantivos concretos, verbos de ação, números.
Exemplo: ruim — "otimizamos o processo". Bom — "tiramos 3 cliques da aprovação e o time fechou o mês com 22h a mais por pessoa."

C — CREDIBLE (crível)
Credibilidade vem de detalhe que só quem operou tem. Não é título, é especificidade. Citar a empresa, o trimestre, o ticket médio. Detalhe sustenta a tese melhor que adjetivo.
Exemplo: "Em uma operação de 800 viagens/mês com ticket médio de R$ 2.400, 18% das reservas eram canceladas a menos de 24h da partida."

E — EMOTIONAL (emocional)
Ideia conecta com pessoa, não com categoria. Falar do dono que perdeu a noite refazendo a planilha, não da "necessidade de melhoria de processo". Emoção em post de líder é dor identificada, não cena dramatizada.
Exemplo: "Quando um VP de vendas perde um deal porque o sistema de aprovação engasgou na sexta à noite, o problema deixa de ser de TI."

S — STORIES (estórias)
Ideias grudam dentro de história. Não é "case", é cena: um momento, um personagem, uma decisão, uma consequência. A história prova a tese melhor que o argumento.
Exemplo: "Em março de 2024, recebi um email do COO às 23h. Tinham aprovado 18 viagens duplicadas no mesmo mês. Foi quando entendi que o problema não era de governança, era de UX."

REGRA DE USO: post curto (até 800 caracteres) precisa de S simples + um C concreto. Post médio (até 1500) precisa adicionar U inesperado. Post longo precisa de história (S de stories) sustentando a tese.
$BODY$, 'voice_guidelines', true
where not exists (
  select 1 from public.org_documents where name = 'Made to Stick — SUCCESs framework'
);

-- 3. StoryBrand BrandScript — 7 partes
insert into public.org_documents (name, content, kind, is_active)
select 'StoryBrand BrandScript — 7 partes', $BODY$
A BrandScript do Donald Miller estrutura mensagem em torno de uma regra: o cliente é o herói, a marca é o guia. Aplicar isso em post de líder significa que o leitor é o protagonista da história, não o autor. O autor entra como mentor.

1. PERSONAGEM (quem é o herói)
Definir o leitor com clareza de cargo, momento e dor. Não "líderes de empresas", e sim "CFO em SaaS B2B que acabou de fechar Série B". Quanto mais específico, mais o leitor certo se reconhece.
Exemplo: "Esse post é pra CFO que recebeu pressão do board pra cortar 15% de OPEX em 30 dias."

2. PROBLEMA (o que está no caminho)
Três camadas: externo (o problema visível), interno (como o herói se sente sobre o problema), filosófico (por que esse problema é injusto / errado).
Exemplo: externo — "travel spend cresceu 40% em 6 meses"; interno — "você não sabe explicar pro board sem parecer que perdeu o controle"; filosófico — "ninguém devia ter que escolher entre crescer e prestar contas".

3. GUIA (autoridade + empatia)
O guia mostra duas coisas: que entende a dor (empatia) e que tem competência (autoridade). Empatia primeiro, autoridade depois. Empatia sem autoridade é fraco, autoridade sem empatia é arrogante.
Exemplo: "Já passei por isso. Em 2022 cortei 22% de spend em 60 dias e perdi dois VPs no caminho. Hoje sei que dá pra fazer sem perder time."

4. PLANO (o caminho prático)
O guia oferece um plano de 3 a 4 passos concretos. Plano simples é mais convincente que plano completo. Cada passo tem nome curto.
Exemplo: "1. Mapear os 20% de gastos que respondem por 80% do total. 2. Olhar políticas, não pessoas. 3. Medir antes de cortar."

5. CHAMADO À AÇÃO (CTA)
Direto, sem fofura. Em post de LinkedIn, o CTA é leve: comentar, salvar, marcar alguém. Evitar "vamos conversar" genérico. Pedir uma ação pequena e específica.
Exemplo: "Se você está nesse cenário, comenta sua categoria. Vou voltar com um post detalhando o passo 2."

6. EVITAR FRACASSO (o que está em jogo se não agir)
Mostrar o custo de continuar onde está. Concreto, não dramático. Sem catastrofismo. Custo real, número se possível.
Exemplo: "Se continuar como está, no fechamento do próximo trimestre o board vai perguntar e você vai estar respondendo em vez de propondo."

7. SUCESSO (como é o final feliz)
Pintar o cenário pós-ação. Não é fantasia, é estado realista de operação resolvida. Detalhe sensorial específico.
Exemplo: "No fim do trimestre seguinte você abre o board deck e a linha de travel é a única que cresceu menos que a receita. Pela primeira vez em 18 meses."

REGRA: cada post não precisa rodar todas as 7. Posts curtos rodam Personagem + Problema + uma pista do Plano. Posts longos podem fechar com Sucesso. Nunca colocar a marca/empresa como herói. O líder é o guia, o leitor é o herói.
$BODY$, 'pillars', true
where not exists (
  select 1 from public.org_documents where name = 'StoryBrand BrandScript — 7 partes'
);

-- 4. Arquétipos de marca (Hero & Outlaw) — 12 personalidades
insert into public.org_documents (name, content, kind, is_active)
select 'Arquétipos de marca (Hero & Outlaw) — 12 personalidades', $BODY$
Os 12 arquétipos de Jung/Pearson definem o caráter da voz. Cada líder na Onfly carrega um arquétipo dominante. O post não declara o arquétipo, ele performa. Conhecer o arquétipo dominante ajuda a escolher imagem, exemplo, vocabulário.

Os 12 estão organizados em 4 orientações:

LIBERDADE
1. OUTLAW (rebelde) — quebra regra do setor. Voz: contrarian, provocativo, anti-establishment. Frases típicas: "isso aqui está errado e ninguém fala", "todo mundo finge que funciona". Marcas: Harley, Tesla cedo.
2. EXPLORER (explorador) — busca novo, anti-conformismo curioso. Voz: jornada, descoberta, fronteira. Frases típicas: "fui ver de perto", "ninguém tinha mapeado isso ainda". Marcas: Patagonia, Land Rover.
3. JESTER (bobo da corte) — leveza, ironia, vida boa. Voz: tirada, observação ácida, autodepreciação. Frases típicas: "rindo pra não chorar", "olha o tamanho desse absurdo". Marcas: Old Spice, Skol antiga.

SOCIAL
4. CAREGIVER (cuidador) — protege, serve. Voz: cuidado, responsabilidade pelo time. Frases típicas: "ninguém vai ficar pra trás", "o que importa é o time chegar inteiro". Marcas: Johnson, Nivea.
5. LOVER (amante) — paixão, beleza, intensidade. Voz: estética, sensorial, intimidade. Marcas: Magnum, Victoria's. Para C-level, raramente é dominante.
6. EVERYMAN (homem comum) — pé no chão, sem firula. Voz: bom senso, "como qualquer um faria", anti-elitista. Frases típicas: "no fim das contas a gente faz o básico", "não tem mágica". Marcas: IKEA, Magalu.

ORDEM
7. CAREGIVER acima também tangencia ordem em alguns mapas.
8. RULER (governante) — controle, padrão, autoridade. Voz: critério, padrão alto, comando. Frases típicas: "o padrão precisa ser esse", "decidi e está decidido". Marcas: Rolex, BMW, Hugo Boss.
9. INNOCENT (inocente) — otimismo, simplicidade, fé no futuro. Voz: esperança, mundo melhor, beleza do simples. Marcas: Coca-Cola, Dove.
10. SAGE (sábio) — conhecimento, análise, discernimento. Voz: dado, framework, profundidade. Frases típicas: "olhando os números com calma", "o que esse padrão revela". Marcas: Philips, The Economist. Arquétipo natural de muito C-level analítico.

EGO
11. HERO (herói) — vence, supera, conquista. Voz: meta, ambição, "fizemos acontecer". Frases típicas: "no fim do trimestre entregamos", "passamos a meta em 18 meses". Marcas: Nike, BMW.
12. MAGICIAN (mago) — transformação, mudança de estado. Voz: virada, "antes era X, agora é Y", visão. Frases típicas: "isso aqui muda o jogo", "o sistema inteiro vira". Marcas: Disney, Apple cedo.
13. CREATOR (criador) — inovação, originalidade, fazer do zero. Voz: design, primeiro princípio, "construímos diferente". Marcas: Apple, Lego.

REGRA DE USO: cada líder tem 1 arquétipo dominante e 1 secundário. Posts ficam mais fortes quando puxam para o dominante, mas escapam do bordão usando o secundário pra variar tom. Nunca misturar mais de 2. Outlaw + Sage funciona (rebelde com dado). Hero + Caregiver funciona (vencedor que cuida do time). Sage + Magician funciona (analítico que faz a virada). Evitar Innocent em C-level B2B (soa ingênuo) e Lover em finanças (soa fora de contexto).
$BODY$, 'pillars', true
where not exists (
  select 1 from public.org_documents where name = 'Arquétipos de marca (Hero & Outlaw) — 12 personalidades'
);

-- 5. Arco de McKee — estrutura clássica de história
insert into public.org_documents (name, content, kind, is_active)
select 'Arco de McKee — estrutura clássica de história', $BODY$
McKee descreve a história como movimento de um equilíbrio inicial para um novo equilíbrio, atravessando um arco. Em post de C-level, o arco é comprimido em 5 movimentos. A história não é decoração, é o vetor que carrega a tese.

1. EQUILÍBRIO INICIAL (cenário antes do problema)
Frase ou parágrafo que estabelece o estado normal da operação. O leitor precisa entender o que estava funcionando antes de algo mudar.
Exemplo: "Em janeiro fechamos o orçamento de viagem com 12% de crescimento previsto pro ano. Operação rodando, time alinhado, política revisada."

2. INCIDENTE INCITANTE (a quebra)
O evento específico que rompe o equilíbrio. Tem data, tem nome, tem consequência. Sem incidente incitante, não há história, só comentário.
Exemplo: "No dia 17 de março recebi um print de um relatório do BI: 38% das viagens do trimestre tinham sido canceladas a menos de 24h. Crescemos volume e jogamos dinheiro fora."

3. COMPLICAÇÕES PROGRESSIVAS (escalada)
A pressão aumenta. Cada tentativa de resolver revela uma camada nova do problema. Não é lista de problemas, é progressão: cada item piora o anterior.
Exemplo: "Tentamos resolver com política mais rígida. Time reclamou. Voltamos atrás. Olhamos o relatório de novo, vimos que 80% dos cancelamentos vinham de 3 times. Falamos com os líderes. Não era preguiça, era processo de aprovação travado."

4. CRISE / CLÍMAX (o ponto de virada)
A decisão difícil que define o resto. Crise é o momento em que o personagem precisa escolher entre dois bens (ou dois males). Clímax é a ação que resulta da escolha.
Exemplo: "Tive que escolher entre proteger a política que defendi por 18 meses ou admitir que ela estava criando o problema. Reescrevemos do zero em uma semana."

5. RESOLUÇÃO / NOVO EQUILÍBRIO (estado pós-arco)
O mundo voltou ao normal, mas o normal mudou. Não é "tudo deu certo", é "agora opera diferente". Detalhe específico do estado novo.
Exemplo: "Hoje o cancelamento tardio está em 6%. O processo de aprovação tem 2 cliques. E eu nunca mais defendi política em público antes de testar 90 dias na operação."

REGRA DE COMPRESSÃO: post curto pode rodar só Incidente + Crise + Resolução. Post médio adiciona Equilíbrio Inicial. Post longo roda os 5 movimentos. Cada movimento ocupa 1 a 2 parágrafos curtos.

CONTROLLING IDEA (ideia controladora): McKee insiste que toda história forte tem uma ideia que se prova pelo arco. Não é moral declarada, é tese que emerge dos eventos. Em post, a ideia controladora aparece na última linha, depois da resolução. Ela conecta a história ao argumento maior.
Exemplo de ideia controladora: "Política sem operação é teatro." Ou: "Quem corta sem entender, perde duas vezes."

NEGATIVO IRREDUTÍVEL: McKee defende que a história deve fechar com um movimento real. Se o herói não mudou, não houve história. Em post de líder, isso significa: mostrar o que você sabe agora que não sabia no começo. Sem mudança, é só relato.
$BODY$, 'pillars', true
where not exists (
  select 1 from public.org_documents where name = 'Arco de McKee — estrutura clássica de história'
);

-- 6. Truby — 7 passos centrais de uma história
insert into public.org_documents (name, content, kind, is_active)
select 'Truby — 7 passos centrais de uma história', $BODY$
Truby destila a estrutura de qualquer história em 7 passos. É um esqueleto mais granular que McKee e funciona bem pra posts longos de bastidor ou case detalhado. O herói da história é quem viveu a situação (pode ser o próprio líder, ou um cliente / colaborador).

1. FRAQUEZA E NECESSIDADE
O herói começa com uma falha que ele não enxerga. A necessidade é o que ele precisa aprender pra crescer. Em post, isso vira: o pressuposto errado que você tinha antes da história começar.
Exemplo: "Eu achava que travel spend era um problema de política. Não era. Era de UX da ferramenta de reserva."

2. DESEJO
O objetivo concreto, externo, mensurável que move a história. Diferente da necessidade (interna), o desejo é o que o herói persegue.
Exemplo: "Queria cortar 20% do gasto de viagem em 90 dias sem perder velocidade comercial."

3. OPONENTE
A força que compete pelo mesmo objetivo (ou que bloqueia). Oponente não é vilão, é alguém ou algo que quer a mesma coisa por outro caminho. Em contexto corporativo, o oponente costuma ser o status quo, um processo, um pressuposto compartilhado, ou um time com prioridade diferente.
Exemplo: "O oponente era o próprio time de vendas. Eles defendiam que velocidade de aprovação não podia ser tocada. Estavam certos pelo motivo errado."

4. PLANO
A estratégia que o herói monta. O plano sempre falha em algum grau, e essa falha é o que gera a história.
Exemplo: "Plano inicial: política mais rígida, mais aprovadores no fluxo. Em 30 dias entendemos que era o oposto. Tiramos aprovadores."

5. BATALHA
O confronto direto, o momento em que tudo é decidido. Em post de líder, batalha é a reunião, a decisão pública, a conversa difícil, o trimestre que define.
Exemplo: "Apresentei o novo fluxo no comitê com 11 pessoas. Sete contra, quatro a favor. Decidi seguir mesmo assim. Tinha 90 dias pra provar."

6. AUTO-REVELAÇÃO
O herói descobre algo sobre si mesmo. É o que Truby chama de "self-revelation". Sem auto-revelação, a história é episódica, não tem alma. Em post, é a frase que começa com "entendi que" ou "vi que estava errado em".
Exemplo: "Entendi que tinha confundido governança com controle. Governança boa libera, controle ruim aprisiona."

7. NOVO EQUILÍBRIO
O estado final, depois da batalha. Não é vitória, é mudança. Pode ser positiva ou negativa, mas tem que ser diferente do começo.
Exemplo: "Hoje o time aprova viagem em média em 4h. Spend caiu 18%. E eu paro 5 minutos antes de defender qualquer política nova."

DIFERENÇA PRA MCKEE: McKee é mais cinematográfico (5 movimentos do arco). Truby é mais analítico (7 passos da decisão). Usar Truby quando o post precisa mostrar evolução de pensamento do herói. Usar McKee quando o post precisa de tensão narrativa.

REGRA DE USO: post longo (acima de 1500 caracteres) consegue rodar os 7 passos. Post médio roda 4: Fraqueza + Desejo + Batalha + Auto-revelação. Post curto roda só Auto-revelação amarrada a um Desejo. O passo mais importante sempre é o 6: sem auto-revelação, o post vira relato.
$BODY$, 'pillars', true
where not exists (
  select 1 from public.org_documents where name = 'Truby — 7 passos centrais de uma história'
);

-- 7. Long Game — cadência de construção de autoridade
insert into public.org_documents (name, content, kind, is_active)
select 'Long Game — cadência de construção de autoridade', $BODY$
Dorie Clark argumenta que autoridade não se constrói em sprint, se constrói em série. O Long Game é o framework de paciência estratégica aplicado a posicionamento. Em LinkedIn de C-level, isso vira regra de cadência: o post de hoje só pesa porque o de 6 meses atrás estabeleceu o vetor.

1. VISÃO DE LONGO PRAZO
Definir onde o líder quer estar reconhecido em 3 anos. Não é cargo, é território de ideia. Exemplo: "ser referência em travel-as-data no mercado brasileiro de SaaS". Cada post existe ou pra reforçar esse vetor ou pra abandoná-lo.

2. PRIORIZAÇÃO BRUTAL (o teste dos 3 anos)
Antes de publicar, perguntar: esse post vai importar em 3 anos? Se a resposta é não, é ruído. Long Game elimina post reativo, post de hype, post de comentário sobre notícia sem ângulo próprio.
Exemplo prático: post "minha opinião sobre o IPO da X" não passa no teste. Post "o que o IPO da X revela sobre a tese que defendo há 18 meses" passa.

3. CONSTRUÇÃO DE NETWORK INTENCIONAL
Network não é número de conexões, é qualidade do círculo. No Long Game, o líder identifica 30-50 pessoas-chave do território (outros C-level, jornalistas de mídia setorial, fundos, fundadores) e cultiva relação real. Posts são feitos pensando nesse círculo lendo, não no feed em massa.

4. PACIÊNCIA ESTRATÉGICA (saber quando agir e quando esperar)
Alguns posts precisam de timing. Não é só publicar quando quer. Newsjacking de evento setorial, post de tese amadurecida depois de 3 meses sentado com o dado, post de contrarian view que só funciona depois do consenso ficar barulhento. Esperar custa, mas o post acerta com mais força.

5. CRIAÇÃO DE VALOR CONSISTENTE (não viral, consistente)
Cadência semanal supera post viral mensal. Long Game prefere 50 posts médios bons no ano a 3 posts virais e 47 medíocres. O algoritmo do LinkedIn recompensa frequência regular, mas o leitor recompensa profundidade acumulada.

6. FLEXIBILIDADE TÁTICA, RIGIDEZ ESTRATÉGICA
A tese central não muda. A forma sim. Se o post de tese não engaja em formato curto, vira artigo longo. Se carrossel performa melhor que texto pra explicar o framework, muda o formato. Mas o vetor de autoridade fica.

7. REFLEXÃO E REBALANCEAMENTO TRIMESTRAL
A cada 90 dias, olhar os posts publicados e perguntar: o que reforçou o território? O que diluiu? Cortar temas que dispersam. Aprofundar temas que conectam. Long Game é loop, não linha reta.

REGRA DE APLICAÇÃO NO POST DE HOJE:
- Toda peça deve ter ângulo próprio (não comentário genérico de notícia).
- Toda peça deve conectar ao território de autoridade pré-definido do líder.
- Evitar tom de "quente do dia": o post tem que continuar fazendo sentido se lido daqui a 12 meses.
- CTA é opcional. Visibilidade é consequência da consistência, não objetivo do post isolado.

ERRO COMUM A EVITAR: o post que tenta provar autoridade em vez de demonstrá-la. Long Game é jogo de mostrar trabalho real, não de declarar tese sem prova. Se o post começa com "como especialista em X", reescreve.
$BODY$, 'voice_guidelines', true
where not exists (
  select 1 from public.org_documents where name = 'Long Game — cadência de construção de autoridade'
);

-- 8. Sistema de storytelling Welsh — 7 etapas
insert into public.org_documents (name, content, kind, is_active)
select 'Sistema de storytelling Welsh — 7 etapas', $BODY$
E.M. Welsh propõe um sistema operacional para encontrar a forma certa de uma história. O original tem 5 fases (Define, Learn, Challenge, Pick, Tell), mas a fase Define se quebra em 3 etapas (começo, meio, fim) e a fase Tell em compromisso de entrega. Em contexto de post de C-level, vira um checklist de 7 etapas antes de escrever.

1. DEFINIR A HISTÓRIA EM UMA FRASE
Antes de escrever qualquer linha, responder: qual é a história? Se não cabe em uma frase, ainda não está pronta. Não é sobre o tema, é sobre o que aconteceu.
Exemplo ruim: "vou escrever sobre travel spend". Exemplo bom: "vou contar como cortei 22% de travel spend tirando aprovadores em vez de adicionando".

2. DESENHAR O COMEÇO (estado inicial)
O que o leitor precisa saber antes do problema aparecer. Não é introdução longa, é setup. Personagens, contexto, premissa que estava em jogo.
Exemplo: "Em fevereiro fechamos o orçamento com política de viagem revisada. Achei que estava resolvido."

3. DESENHAR O MEIO (a tensão / progressão)
O que dá errado, o que se descobre, a complicação que muda tudo. É no meio que a história ganha peso. Sem meio, vira anúncio.
Exemplo: "Em maio o BI mostrou que cancelamentos tardios tinham subido 40%. Tentei resolver com mais regra. Piorou."

4. DESENHAR O FIM (a saída / aprendizado)
O estado final. Não precisa ser feliz, precisa ser específico. Welsh insiste: o fim revela o significado da história sem declará-lo. Se você precisa explicar a moral, errou o fim.
Exemplo: "Em agosto o cancelamento estava em 6%. Mas o que ficou foi outra coisa: parei de confiar em política sem teste de operação."

5. APRENDER O FORMATO CERTO (mídia adequada)
Welsh testa: a mesma história fica melhor como qual formato? Em LinkedIn de C-level, as opções são: post curto (até 800 caracteres, 1 ideia), post médio (até 1500, narrativa enxuta), post longo (até 3000, arco completo), artigo (acima de 3000, tese desenvolvida com dados), carrossel (lista visual de pontos).

6. DESAFIAR A HISTÓRIA EM CADA FORMATO
Imaginar a mesma história em formato diferente do natural. Se naturalmente seria post longo, tentar resumir em carrossel de 5 slides. O exercício força destilação. Se sobrevive ao corte, a história estava boa. Se evapora, faltava substância.

7. ESCOLHER E ENTREGAR (compromisso)
Decidir o formato final e publicar. Welsh insiste no compromisso: histórias ficam paradas porque escritor não decide. Definir prazo (publicar hoje, amanhã, na sexta) e cumprir. Histórias melhoradas demais por meses perdem urgência.

REGRA DE USO COMO FILTRO:
- Etapa 1 mata 70% das ideias. Se não cabe em frase, não é história ainda.
- Etapas 2-4 são onde mora a substância. Pular o meio mata o post.
- Etapas 5-6 são onde mora a qualidade. Mesmo conteúdo em formato errado falha.
- Etapa 7 é onde mora a publicação. Sem compromisso, virou rascunho eterno.

DIFERENÇA PRA TRUBY E MCKEE: Welsh não é sobre estrutura interna da história, é sobre processo de produção. Truby diz o que a história tem que conter. McKee diz como a história se move. Welsh diz como o autor decide e entrega. Usar os três juntos: Welsh pra processo, Truby pra conteúdo, McKee pra ritmo.
$BODY$, 'pillars', true
where not exists (
  select 1 from public.org_documents where name = 'Sistema de storytelling Welsh — 7 etapas'
);
