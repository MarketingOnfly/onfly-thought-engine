/**
 * Aprende quais estratégias de geração funcionam melhor pra cada líder.
 *
 * "Estratégia" = combinação de (framework narrativo + mood + hook style)
 * usada numa variação gerada.
 *
 * Sinais de preferência (em ordem de peso):
 *  1. PROMOÇÃO: líder usou /use-variation pra promover uma versão alt
 *     como primária. Sinal mais forte: ele explicitamente escolheu B/C.
 *  2. RATING ALTO (4-5): feedback explícito positivo.
 *  3. PUBLICAÇÃO: post foi publicado no LinkedIn (sinal implícito de "ficou bom").
 *
 * Sinais negativos:
 *  1. RATING BAIXO (1-2): feedback negativo direto.
 *  2. REVISÃO MANUAL: líder pediu pra refazer com instrução — texto
 *     não estava bom.
 *
 * Devolve ranking de frameworks/moods/hooks que o planner usa pra
 * decidir as 3 estratégias das variações A/B/C.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AltVersion, ContentDraft } from "@/lib/db/types";

interface StrategyScore {
  key: string;
  score: number; // peso acumulado
  uses: number; // quantas vezes apareceu
  avg_rating: number | null;
}

export interface PreferredStrategies {
  frameworks: StrategyScore[]; // ranqueado, mais preferido primeiro
  moods: StrategyScore[];
  hook_styles: StrategyScore[];
  total_drafts_analyzed: number;
}

/**
 * Lê o histórico do líder e devolve ranking de estratégias preferidas.
 * Usa service_role pra ler todos os drafts + feedbacks do líder.
 */
export async function getPreferredStrategies(
  userId: string
): Promise<PreferredStrategies> {
  const admin = createSupabaseAdminClient();

  // Pega últimos 60 drafts do líder com meta (que tem plan + strategy info)
  const { data: drafts } = await admin
    .from("content_drafts")
    .select("id, meta, draft_markdown, published_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (!drafts?.length) {
    return {
      frameworks: [],
      moods: [],
      hook_styles: [],
      total_drafts_analyzed: 0,
    };
  }

  const draftIds = drafts.map((d) => d.id);

  // Feedbacks desses drafts
  const { data: feedbacks } = await admin
    .from("content_feedback")
    .select("content_draft_id, rating, comment")
    .in("content_draft_id", draftIds);

  const feedbackByDraft = new Map<string, { rating: number; comment: string | null }>();
  for (const f of feedbacks ?? []) {
    feedbackByDraft.set(f.content_draft_id, { rating: f.rating, comment: f.comment });
  }

  // Acumuladores
  const frameworkStats = new Map<string, { totalScore: number; uses: number; ratings: number[] }>();
  const moodStats = new Map<string, { totalScore: number; uses: number; ratings: number[] }>();
  const hookStats = new Map<string, { totalScore: number; uses: number; ratings: number[] }>();

  function recordStrategy(
    framework: string | null,
    mood: string | null,
    hookStyle: string | null,
    weight: number,
    rating: number | null
  ) {
    const apply = (
      map: Map<string, { totalScore: number; uses: number; ratings: number[] }>,
      key: string | null
    ) => {
      if (!key) return;
      const cur = map.get(key) ?? { totalScore: 0, uses: 0, ratings: [] };
      cur.totalScore += weight;
      cur.uses += 1;
      if (rating !== null) cur.ratings.push(rating);
      map.set(key, cur);
    };
    apply(frameworkStats, framework);
    apply(moodStats, mood);
    apply(hookStats, hookStyle);
  }

  for (const draft of drafts) {
    const meta = (draft.meta as Record<string, unknown>) ?? {};
    const plan = (meta.plan as Record<string, unknown>) ?? {};
    const fb = feedbackByDraft.get(draft.id) ?? null;
    const rating = fb?.rating ?? null;

    // Estratégia usada na versão PRINCIPAL (que ficou como draft_markdown).
    // Se houve promoção de variação, prefere a strategy promovida.
    const promoted = meta.promoted_variation as
      | { strategy: { framework: string; mood: string; hook_style: string } | null }
      | undefined;
    const promotedStrategy = promoted?.strategy ?? null;

    const mainFramework =
      promotedStrategy?.framework ??
      (plan.narrative_framework as string) ??
      null;
    const mainMood =
      promotedStrategy?.mood ?? (meta.mood as string) ?? null;
    const mainHook =
      promotedStrategy?.hook_style ??
      (meta.effective_hook_style as string) ??
      (plan.recommended_hook_style as string) ??
      null;

    // Peso baseado em sinais de qualidade:
    //  base 1 (uso) + 2 publicação + bônus rating + 3 EXTRA se foi promovida
    //  (promoção alt é sinal MUITO forte: líder explicitamente prefere isso)
    let weight = 1;
    if (draft.published_at) weight += 2;
    if (rating != null) {
      weight += [0, 0, 0.5, 1, 2, 3][rating] ?? 1;
    }
    if (promotedStrategy) weight += 3; // bônus pesado por promoção explícita

    recordStrategy(mainFramework, mainMood, mainHook, weight, rating);
  }

  function rankMap(
    map: Map<string, { totalScore: number; uses: number; ratings: number[] }>
  ): StrategyScore[] {
    const arr: StrategyScore[] = [];
    for (const [key, stats] of map) {
      const avgRating =
        stats.ratings.length > 0
          ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length
          : null;
      // Score normalizado: peso médio por uso, com bônus pequeno por volume
      const normalizedScore = stats.totalScore / stats.uses + Math.log(1 + stats.uses) * 0.1;
      arr.push({
        key,
        score: normalizedScore,
        uses: stats.uses,
        avg_rating: avgRating,
      });
    }
    return arr.sort((a, b) => b.score - a.score);
  }

  return {
    frameworks: rankMap(frameworkStats),
    moods: rankMap(moodStats),
    hook_styles: rankMap(hookStats),
    total_drafts_analyzed: drafts.length,
  };
}

/**
 * Formata o ranking pra entrar no system prompt do planner.
 * Quando o planner está decidindo as 3 estratégias das variações,
 * ele lê esse texto e prioriza estratégias que historicamente funcionam
 * pra ESSE líder específico — mas com viés pra DIVERSIDADE (não usar
 * sempre a top 1, senão a aprendizagem fica saturada).
 */
export function preferredStrategiesAsPromptHint(
  prefs: PreferredStrategies
): string {
  if (prefs.total_drafts_analyzed < 3) {
    // Pouco histórico — não força preferência
    return "Histórico insuficiente pra preferência aprendida. Escolha estratégias diversas.";
  }

  const top3Frameworks = prefs.frameworks.slice(0, 5);
  const top3Moods = prefs.moods.slice(0, 5);

  const fwLine = top3Frameworks.length
    ? top3Frameworks
        .map(
          (f) =>
            `${f.key} (${f.uses}x, rating médio ${f.avg_rating?.toFixed(1) ?? "—"})`
        )
        .join("; ")
    : "(sem dados)";

  const moodLine = top3Moods.length
    ? top3Moods
        .map(
          (m) =>
            `${m.key} (${m.uses}x, rating médio ${m.avg_rating?.toFixed(1) ?? "—"})`
        )
        .join("; ")
    : "(sem dados)";

  return [
    `HISTÓRICO DE ESTRATÉGIAS DESTE LÍDER (${prefs.total_drafts_analyzed} drafts analisados):`,
    `- Frameworks que mais rendem: ${fwLine}`,
    `- Moods que mais rendem: ${moodLine}`,
    "",
    "REGRA DE EXPLORAÇÃO vs EXPLOITATION:",
    "Quando escolher as 3 estratégias pras variações A/B/C:",
    "- Versão A (PRIMÁRIA): use a melhor combinação pro tema específico, ponderando o histórico (exploitation).",
    "- Versão B (ALTERNATIVA): use a 2ª melhor pro tema, OU a top 1 do histórico se não for igual à A.",
    "- Versão C (EXPLORADORA): use uma estratégia que o líder NUNCA testou OU testou pouco. Diversidade gera aprendizado.",
    "Sem essa diversidade, o motor satura no que já funcionou e nunca descobre que outro estilo poderia funcionar melhor.",
  ].join("\n");
}
