/**
 * Pre-write planning — antes de escrever, o Opus pensa.
 * Devolve estrutura, tensão e fato concreto a usar.
 * Esse plano vira contexto da fase de execução (Sonnet).
 */

import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import type { LeaderProfile } from "@/lib/db/types";
import { CONTENT_TYPES, HOOK_STYLES, MOOD_VARIATIONS } from "@/lib/style-presets";
import {
  NARRATIVE_FRAMEWORKS,
  frameworksForPlanner,
} from "@/lib/anthropic/narrative-frameworks";
import {
  getPreferredStrategies,
  preferredStrategiesAsPromptHint,
} from "@/lib/anthropic/learn-preferred-strategies";

export interface ContentPlan {
  audience_specific: string;
  tension: string;
  key_facts: string[];
  structural_arc: string;
  sensory_imagery: string[];
  closing_intent: string;
  mood_signature: string;
  // Decisões editoriais do planner — usadas quando o líder NÃO escolheu
  // hook_style/content_type explicitamente. O agente analisa a ideia e
  // recomenda o melhor ângulo a partir das opções disponíveis.
  recommended_hook_style: string | null;
  recommended_content_type: string | null;
  hook_rationale: string | null;
  content_type_rationale: string | null;
  // NOVO: framework narrativo escolhido (McKee/Heath/Bly/Miller).
  // O draft Sonnet recebe a estrutura COMPLETA do framework e segue.
  // Misturar frameworks gera lama — por isso UMA escolha.
  narrative_framework: string | null;
  framework_rationale: string | null;
  // NOVO: a tese central em 1 frase declarativa (McKee Controlling Idea).
  // Cabe em uma linha do LinkedIn. Se o post não cabe nessa frase, não
  // tem foco.
  controlling_idea: string | null;
  // NOVO (2026-05): estratégias DISTINTAS pra cada variação A/B/C.
  // O planner escolhe 3 combinações diferentes (framework + mood),
  // ponderando o histórico de escolhas/feedbacks do líder.
  // Versão A = exploitation (melhor pro tema), B = alternativa próxima,
  // C = exploração (estratégia que o líder nunca testou).
  variation_strategies?: Array<{
    framework: string; // key de NARRATIVE_FRAMEWORKS
    mood: string; // key de MOOD_VARIATIONS
    rationale: string; // por que essa estratégia pra essa variação
  }>;
}

const HOOK_OPTIONS_TEXT = HOOK_STYLES.map(
  (h) => `  - "${h.key}": ${h.label}. ${h.description}`
).join("\n");

const CONTENT_TYPE_OPTIONS_TEXT = CONTENT_TYPES.map(
  (c) => `  - "${c.key}": ${c.label}. ${c.description}`
).join("\n");

const SYSTEM_PROMPT = `Você é um editor sênior planejando o esqueleto de um post antes da redação. Não escreva o post. Planeje.

🔒 REGRA ZERO (acima de tudo): NUNCA INVENTE ABSOLUTAMENTE NADA.
No key_facts e sensory_imagery do plano: só inclua número/nome/data que VEIO DO INPUT do líder.
- Se a ideia é abstrata e líder não forneceu número específico, key_facts pode ser vazio OU ter placeholders explícitos ("[número da própria empresa do líder]").
- NÃO invente "47%", "R$ 2,3mi", "ano passado", "Magalu" pra dar concretude. O modelo executor vai usar como verdade.
- sensory_imagery deve ser GENÉRICA quando não há cena específica do input ("uma reunião de comitê" em vez de "terça 14h, sala de reunião do 8º andar").
- Prefira plan com key_facts: [] e sensory_imagery: [] do que com fatos inventados.
- Plausibilidade NÃO é permissão pra inventar. Se você não sabe, deixa vazio.


Você também TOMA 2 DECISÕES EDITORIAIS quando o líder não as definiu:
1. Qual HOOK STYLE (estilo de abertura) cai melhor pra ESSA ideia específica
2. Qual CONTENT TYPE (ângulo do conteúdo) faz mais sentido pra ESSA ideia específica

Critérios de decisão (use SEMPRE que precisar escolher):
- Notícia recente / acontecimento → content_type=newsjacking, hook=newsjacking ou quote_callout
- Erro/aprendizado pessoal do líder → content_type=learnings, hook=confessional ou expensive_lesson
- Tese contra consenso → content_type=contrarian ou manifesto, hook=contradiction ou forbidden_truth
- Dado/estatística recente → content_type=data_drop, hook=number_punch ou data_revelation
- Bastidor da operação → content_type=bastidor, hook=story_open ou insider_observation
- Caso de cliente concreto → content_type=case_study, hook=cliffhanger_case ou before_after
- Comparação dois jeitos → content_type=comparative, hook=before_after ou common_enemy
- Declaração de princípio → content_type=manifesto, hook=short_punch ou direct_callout

NÃO escolha hook_style/content_type aleatoriamente. Olhe pra IDEIA do líder e pegue o ângulo que faz a tensão ressoar mais forte.

HOOK STYLES DISPONÍVEIS:
${HOOK_OPTIONS_TEXT}

CONTENT TYPES DISPONÍVEIS:
${CONTENT_TYPE_OPTIONS_TEXT}

Você também ESCOLHE UM FRAMEWORK NARRATIVO entre estas opções (NUNCA misture dois):
${frameworksForPlanner()}

Critérios de escolha do framework:
- Bastidor / aprendizado com virada → story_arc
- Mudar opinião sobre prática consensual → pas (Problem-Agitate-Solve)
- Mostrar transformação operacional → bab (Before-After-Bridge)
- Hot take com lastro técnico → contrarian_structured
- Jornada de educação técnica → story_brand_sb7
- Caso curto + tese (não pitch) → hook_story_offer
- Notícia recente (24-48h) com leitura diferenciada → newsjacking_take
- Erro pessoal com número específico → expensive_lesson

Você também FORMULA A CONTROLLING IDEA (McKee): tese central em UMA frase declarativa que cabe em 1 linha do LinkedIn. Sem isso, post vira essay sem foco.
- DECLARATIVA: afirma, não pergunta
- UMA ideia central, NÃO duas
- Cabe em 15 palavras ou menos
- Exemplos: "Performance pura virou dependência de canal pago." / "Memória de marca em B2B rende juros compostos." / "Cargo errado consome caixa silenciosamente."

Devolva JSON puro com:
{
  "audience_specific": "string — quem é o leitor IDEAL desse post (cargo + momento + dor). Específico, não 'profissionais B2B'.",
  "tension": "string — qual é a tensão central? O que está em jogo? Por que essa ideia importa AGORA? 1-2 frases.",
  "key_facts": ["3-5 fatos concretos que devem entrar, número específico, nome próprio, data, valor. Se inventar, marca '(verificar)'."],
  "structural_arc": "string — esqueleto em 3-5 beats. Ex: 'cena → contradição → dado → tese → fechamento provocativo'.",
  "sensory_imagery": ["2-4 imagens concretas pra ancorar o leitor: hora, lugar, pessoa, objeto palpável."],
  "closing_intent": "string — qual a frase-tese ou pergunta que fica? O leitor sai com qual frase na cabeça?",
  "mood_signature": "string — qual o estado emocional dominante? (ex: 'crítico curioso', 'otimista cansado', 'irritado mas com humor'). Deve combinar com o tom registrado do líder.",
  "recommended_hook_style": "string — APENAS o key (ex: 'number_punch', 'contradiction'). Escolha 1 das opções listadas acima que melhor cabe na ideia.",
  "recommended_content_type": "string — APENAS o key (ex: 'learnings', 'newsjacking'). Escolha 1 das opções listadas acima que melhor cabe na ideia.",
  "hook_rationale": "string curta — 1 frase explicando POR QUE esse hook style cabe nessa ideia específica.",
  "content_type_rationale": "string curta — 1 frase explicando POR QUE esse content type cabe nessa ideia específica.",
  "narrative_framework": "string — APENAS o key do framework escolhido (story_arc, pas, bab, contrarian_structured, story_brand_sb7, hook_story_offer, newsjacking_take, expensive_lesson, paisa, sb7_short, three_sentence).",
  "framework_rationale": "string — 1 frase explicando POR QUE esse framework cabe nessa ideia.",
  "controlling_idea": "string — a tese central em UMA frase declarativa, até 15 palavras, que cabe numa linha do LinkedIn.",
  "variation_strategies": [
    {
      "framework": "string — key (igual narrative_framework pra versão A)",
      "mood": "string — key (best_day | critical | reflective)",
      "rationale": "string curta — POR QUE essa estratégia pra essa variação"
    },
    "{ ...3 estratégias DISTINTAS no total. A = exploitation (melhor pro tema, considerando histórico). B = alternativa próxima. C = exploração (estratégia que o líder testou pouco). NUNCA repita o mesmo framework em 2 variações. }"
  ]
}

Critérios:
- Plano deve ser ESPECÍFICO o suficiente pra a execução não ter ambiguidade.
- Se key_facts for vazio, escreve um placeholder ("verificar via web_search ou substituir por experiência operacional do líder").
- mood_signature é única em cada plano, não um clichê.
- recommended_hook_style e recommended_content_type SEMPRE preenchidos com um dos keys válidos.
- narrative_framework SEMPRE preenchido (igual à 1ª variation_strategies). controlling_idea SEMPRE preenchida.
- variation_strategies SEMPRE 3 entradas com FRAMEWORKS DIFERENTES entre si. Sem isso, A/B/C ficam iguais e o aprendizado não acontece.`;

function tryParse(text: string): Partial<ContentPlan> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export async function planContent(opts: {
  format: "linkedin_post" | "article";
  topic: string;
  brief: string | null;
  leader: LeaderProfile;
}): Promise<ContentPlan> {
  const anthropic = getAnthropic();
  const leaderSnapshot = `LÍDER: ${opts.leader.full_name}, ${opts.leader.role} em ${opts.leader.area}.
TOM: ${opts.leader.tone_traits.join(", ")}.
AUDIÊNCIA: ${opts.leader.target_audience}.
PILARES: ${opts.leader.themes.join(", ")}.
APRENDIDO (PRIORIDADE): ${opts.leader.learned_preferences ?? "(nenhum)"}.
PREFERE ABRIR ASSIM (use como sinal mas não obrigue): ${opts.leader.preferred_hook_styles.join(", ") || "(sem preferência registrada)"}.
TIPOS DE CONTEÚDO QUE COSTUMA PRODUZIR: ${opts.leader.content_types.join(", ") || "(sem preferência registrada)"}.
NUNCA ESCREVE: ${opts.leader.tone_avoid.join(", ")}.`;

  // NOVO: aprendizado de estratégias preferidas baseado no histórico
  // do líder. Rastreado por: rating, publicação, promoção de variação.
  // Usado pra o planner ponderar quais 3 estratégias escolher pras
  // variações A/B/C. Falha silenciosa se erro (planner ainda decide
  // sem o histórico).
  let strategiesHint = "";
  try {
    const prefs = await getPreferredStrategies(opts.leader.user_id);
    strategiesHint = preferredStrategiesAsPromptHint(prefs);
  } catch (err) {
    console.error("[planContent] failed to get preferred strategies", err);
  }

  const response = await anthropic.messages.create({
    model: MODEL, // Opus pra pensar bem o plano
    max_tokens: 2500, // aumentado pra caber variation_strategies
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Planeje um ${opts.format === "linkedin_post" ? "POST" : "ARTIGO"} sobre:\n\nTEMA: ${opts.topic}\n${opts.brief ? `BRIEFING: ${opts.brief}\n` : ""}\n${leaderSnapshot}\n\n${strategiesHint}\n\nLembre: você TAMBÉM precisa escolher recommended_hook_style, recommended_content_type, narrative_framework, e 3 variation_strategies DISTINTAS olhando pra essa ideia + o histórico do líder. Use os critérios do system prompt.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const parsed = tryParse(text);

  // Valida que as recomendações batem com keys válidos das constantes
  const validHookKeys = new Set<string>(HOOK_STYLES.map((h) => h.key));
  const validContentKeys = new Set<string>(CONTENT_TYPES.map((c) => c.key));
  const validFrameworkKeys = new Set<string>(NARRATIVE_FRAMEWORKS.map((f) => f.key));
  const recommendedHook =
    parsed?.recommended_hook_style &&
    validHookKeys.has(parsed.recommended_hook_style as string)
      ? (parsed.recommended_hook_style as string)
      : null;
  const recommendedContent =
    parsed?.recommended_content_type &&
    validContentKeys.has(parsed.recommended_content_type as string)
      ? (parsed.recommended_content_type as string)
      : null;
  const narrativeFramework =
    parsed?.narrative_framework &&
    validFrameworkKeys.has(parsed.narrative_framework as string)
      ? (parsed.narrative_framework as string)
      : "story_arc"; // default conservador

  // Parsear variation_strategies — 3 estratégias distintas pras variações A/B/C
  const validMoodKeys = new Set<string>(MOOD_VARIATIONS.map((m) => m.key));
  const rawStrategies = Array.isArray(parsed?.variation_strategies)
    ? (parsed.variation_strategies as unknown[]).filter(
        (s): s is { framework: string; mood: string; rationale: string } =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as { framework?: unknown }).framework === "string" &&
          typeof (s as { mood?: unknown }).mood === "string"
      )
    : [];

  // Valida cada estratégia + garante que sejam DIFERENTES (sem framework repetido)
  const seenFrameworks = new Set<string>();
  const variationStrategies = rawStrategies
    .filter((s) => {
      if (!validFrameworkKeys.has(s.framework)) return false;
      if (seenFrameworks.has(s.framework)) return false;
      seenFrameworks.add(s.framework);
      return true;
    })
    .map((s) => ({
      framework: s.framework,
      mood: validMoodKeys.has(s.mood) ? s.mood : "best_day",
      rationale: typeof s.rationale === "string" ? s.rationale : "",
    }))
    .slice(0, 3);

  // Fallback: se o planner não devolveu 3 estratégias válidas distintas,
  // completa com defaults DIVERSOS (3 frameworks diferentes do catálogo).
  if (variationStrategies.length < 3) {
    const DEFAULT_FALLBACK = [
      { framework: narrativeFramework, mood: "best_day", rationale: "default exploitation" },
      { framework: "expensive_lesson", mood: "critical", rationale: "default alternativa" },
      { framework: "three_sentence", mood: "reflective", rationale: "default exploração" },
    ];
    for (const def of DEFAULT_FALLBACK) {
      if (variationStrategies.length >= 3) break;
      if (variationStrategies.find((s) => s.framework === def.framework)) continue;
      variationStrategies.push(def);
    }
  }

  return {
    audience_specific:
      parsed?.audience_specific?.toString() ?? opts.leader.target_audience,
    tension: parsed?.tension?.toString() ?? "—",
    key_facts: Array.isArray(parsed?.key_facts)
      ? parsed.key_facts.map(String).slice(0, 6)
      : [],
    structural_arc: parsed?.structural_arc?.toString() ?? "—",
    sensory_imagery: Array.isArray(parsed?.sensory_imagery)
      ? parsed.sensory_imagery.map(String).slice(0, 5)
      : [],
    closing_intent: parsed?.closing_intent?.toString() ?? "—",
    mood_signature: parsed?.mood_signature?.toString() ?? "—",
    recommended_hook_style: recommendedHook,
    recommended_content_type: recommendedContent,
    hook_rationale: parsed?.hook_rationale?.toString() ?? null,
    content_type_rationale: parsed?.content_type_rationale?.toString() ?? null,
    narrative_framework: narrativeFramework,
    framework_rationale: parsed?.framework_rationale?.toString() ?? null,
    controlling_idea: parsed?.controlling_idea?.toString() ?? null,
    variation_strategies: variationStrategies,
  };
}

/**
 * Versão do planAsPromptContext PARAMETRIZADA por estratégia de variação.
 * Cada variação A/B/C usa um framework distinto — esta função substitui
 * o framework default do plan pelo da variação específica.
 */
export function planAsPromptContextForStrategy(
  plan: ContentPlan,
  strategy: { framework: string; mood: string; rationale: string }
): string {
  const planForStrategy: ContentPlan = {
    ...plan,
    narrative_framework: strategy.framework,
    framework_rationale: strategy.rationale || plan.framework_rationale,
  };
  return planAsPromptContext(planForStrategy);
}

export function planAsPromptContext(plan: ContentPlan): string {
  const lines = [
    "PLANO ESTRATÉGICO (já aprovado, siga ao pé da letra):",
  ];

  // CONTROLLING IDEA (McKee) — primeiro de tudo. Sem isso o post vira essay.
  if (plan.controlling_idea) {
    lines.push(
      "",
      `🎯 CONTROLLING IDEA (a tese central do post, em UMA frase):`,
      `   "${plan.controlling_idea}"`,
      `   Tudo no texto serve a defender essa frase. Se um parágrafo não puxa pra ela, corta.`,
      ""
    );
  }

  lines.push(
    `- Audiência específica: ${plan.audience_specific}`,
    `- Tensão central: ${plan.tension}`,
    `- Fatos concretos a usar: ${plan.key_facts.map((f) => `· ${f}`).join("\n  ") || "(nenhum, use experiência operacional)"}`,
    `- Arco estrutural: ${plan.structural_arc}`,
    `- Imagens sensoriais (USE pelo menos 2 dessas no texto):`,
    `  ${plan.sensory_imagery.map((i) => `· ${i}`).join("\n  ") || "(sem imagens, invente algo concreto)"}`,
    `- Intenção do fechamento: ${plan.closing_intent}`,
    `- Assinatura de humor: ${plan.mood_signature}`
  );

  // FRAMEWORK NARRATIVO ESCOLHIDO (importação tardia pra evitar ciclo)
  if (plan.narrative_framework) {
    const fw = NARRATIVE_FRAMEWORKS.find((f) => f.key === plan.narrative_framework);
    if (fw) {
      lines.push(
        "",
        `📐 FRAMEWORK NARRATIVO OBRIGATÓRIO: ${fw.label}`,
        `   Quando faz sentido: ${fw.when_to_use}`,
        ...(plan.framework_rationale
          ? [`   Por quê escolhi: ${plan.framework_rationale}`]
          : []),
        "   ESTRUTURA (siga ordem, não misture com outros frameworks):",
        ...fw.structure.map((s) => `     ${s}`),
        `   Exemplo de hook: "${fw.example_hook}"`,
        `   Exemplo de close: "${fw.example_close}"`,
        `   ANTI-PADRÃO: ${fw.anti_pattern}`,
        ""
      );
    }
  }

  if (plan.recommended_hook_style && plan.hook_rationale) {
    const h = HOOK_STYLES.find(
      (x) => x.key === (plan.recommended_hook_style as (typeof HOOK_STYLES)[number]["key"])
    );
    lines.push(
      `- HOOK ESCOLHIDO PELO PLANNER: ${h?.label ?? plan.recommended_hook_style}`
    );
    lines.push(`  Por quê: ${plan.hook_rationale}`);
    if (h?.example) lines.push(`  Exemplo desse padrão: "${h.example}"`);
  }
  if (plan.recommended_content_type && plan.content_type_rationale) {
    const c = CONTENT_TYPES.find(
      (x) => x.key === (plan.recommended_content_type as (typeof CONTENT_TYPES)[number]["key"])
    );
    lines.push(
      `- TIPO DE CONTEÚDO ESCOLHIDO PELO PLANNER: ${c?.label ?? plan.recommended_content_type}`
    );
    lines.push(`  Por quê: ${plan.content_type_rationale}`);
  }
  return lines.join("\n");
}
