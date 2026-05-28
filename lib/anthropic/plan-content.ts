/**
 * Pre-write planning — antes de escrever, o Opus pensa.
 * Devolve estrutura, tensão e fato concreto a usar.
 * Esse plano vira contexto da fase de execução (Sonnet).
 */

import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import type { LeaderProfile } from "@/lib/db/types";
import { CONTENT_TYPES, HOOK_STYLES } from "@/lib/style-presets";
import {
  NARRATIVE_FRAMEWORKS,
  frameworksForPlanner,
} from "@/lib/anthropic/narrative-frameworks";

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
}

const HOOK_OPTIONS_TEXT = HOOK_STYLES.map(
  (h) => `  - "${h.key}": ${h.label}. ${h.description}`
).join("\n");

const CONTENT_TYPE_OPTIONS_TEXT = CONTENT_TYPES.map(
  (c) => `  - "${c.key}": ${c.label}. ${c.description}`
).join("\n");

const SYSTEM_PROMPT = `Você é um editor sênior planejando o esqueleto de um post antes da redação. Não escreva o post. Planeje.

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
  "narrative_framework": "string — APENAS o key do framework escolhido (story_arc, pas, bab, contrarian_structured, story_brand_sb7, hook_story_offer, newsjacking_take, expensive_lesson).",
  "framework_rationale": "string — 1 frase explicando POR QUE esse framework cabe nessa ideia.",
  "controlling_idea": "string — a tese central em UMA frase declarativa, até 15 palavras, que cabe numa linha do LinkedIn."
}

Critérios:
- Plano deve ser ESPECÍFICO o suficiente pra a execução não ter ambiguidade.
- Se key_facts for vazio, escreve um placeholder ("verificar via web_search ou substituir por experiência operacional do líder").
- mood_signature é única em cada plano, não um clichê.
- recommended_hook_style e recommended_content_type SEMPRE preenchidos com um dos keys válidos.
- narrative_framework SEMPRE preenchido. controlling_idea SEMPRE preenchida.`;

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

  const response = await anthropic.messages.create({
    model: MODEL, // Opus pra pensar bem o plano
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Planeje um ${opts.format === "linkedin_post" ? "POST" : "ARTIGO"} sobre:\n\nTEMA: ${opts.topic}\n${opts.brief ? `BRIEFING: ${opts.brief}\n` : ""}\n${leaderSnapshot}\n\nLembre: você TAMBÉM precisa escolher recommended_hook_style e recommended_content_type olhando pra essa ideia específica. Use os critérios do system prompt.`,
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
  };
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
