import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildLeaderSystemPrompt,
  buildContentUserPrompt,
} from "@/lib/anthropic/prompts";
import { generateContentSchema } from "@/lib/validation";
import { CONTENT_LENGTHS, MOOD_VARIATIONS } from "@/lib/style-presets";
import { planContent, planAsPromptContext } from "@/lib/anthropic/plan-content";
import { polishPass, applyHardRules } from "@/lib/anthropic/polish-pass";
import { getFewShotExamples } from "@/lib/anthropic/few-shot";
import { reviewText } from "@/lib/anthropic/review";
import { selfRepair } from "@/lib/anthropic/self-repair";
import type { AltVersion, LeaderProfile } from "@/lib/db/types";

export const maxDuration = 180;

/**
 * Pipeline de geração (cada chamada faz):
 *  1. PLAN (Opus) — Sênior editor pensa estrutura, tensão, fato, mood.
 *  2. DRAFT (Sonnet) — Executor escreve seguindo o plano + few-shot.
 *  3. POLISH (Sonnet) — Anti-clichê + cut 20% + sensorial check.
 *  4. SELF-CRITIQUE (Sonnet) — Roda o MESMO revisor da revisão em tempo
 *     real. Se voice_match < 75 ou issue crítica, faz repair cirúrgico.
 *     Assim o texto que chega no editor já passou pelo mesmo crivo que o
 *     líder usaria manualmente.
 *
 * Pra variações > 1: cada versão usa um MOOD distinto pra dar variação
 * semântica de verdade (não só hook). Pipelines rodam em paralelo.
 */

function pickMoodBiases(
  chosenMood: string | null,
  count: number
): (string | null)[] {
  const all = MOOD_VARIATIONS.map((m) => m.key) as string[];
  const biases: (string | null)[] = [chosenMood];
  if (count <= 1) return biases;
  // Adiciona moods contrastantes
  for (const m of all) {
    if (biases.length >= count) break;
    if (biases.includes(m)) continue;
    biases.push(m);
  }
  return biases.slice(0, count);
}

/**
 * Pra cada variação A/B/C, força um HOOK PATTERN distinto baseado no
 * skill /linkedin-thought-leader. Sem isso, as 3 variações tendem a
 * usar o mesmo padrão (geralmente "Revelação Pessoal") só com mood
 * diferente — variação semântica fraca.
 *
 * Ordem prioriza diversidade: Stat surpresa → Ousada → Frustração →
 * Revelação → Pergunta. Se o líder pediu um hookStyle específico,
 * a 1ª variação usa esse (respeita preferência), as outras divergem.
 */
function pickHookPatterns(
  chosenHook: string | null,
  count: number
): (string | null)[] {
  const PATTERNS = [
    "estatistica_surpresa", // "X% subiu. E ninguém percebeu."
    "afirmacao_ousada", // "Travel virou tese de governança."
    "frustracao_relatavel", // "O que ninguém fala sobre X..."
    "revelacao_pessoal", // "Eu acreditava que X. Estava errado."
    "pergunta_provocadora", // "E se X não fosse o objetivo?"
  ];
  // Mapeia hookStyle do líder pra um dos PATTERNS, ou usa o 1º
  const seeded = chosenHook ?? PATTERNS[0];
  const biases: (string | null)[] = [seeded];
  if (count <= 1) return biases;
  for (const p of PATTERNS) {
    if (biases.length >= count) break;
    if (biases.includes(p)) continue;
    biases.push(p);
  }
  return biases.slice(0, count);
}

function hookHintFor(pattern: string | null): string {
  if (!pattern) return "";
  const HINTS: Record<string, string> = {
    estatistica_surpresa:
      "Abra com um número surpreendente seguido de afirmação curta. Ex: 'O CAC subiu 35% no Q3. E nenhum sócio percebeu.'",
    afirmacao_ousada:
      "Abra com uma afirmação ousada que desafie consenso. Ex: 'Documentação interna está morta. Aqui está por quê.'",
    frustracao_relatavel:
      "Abra com algo que o líder vive na pele que ninguém fala. Ex: 'O que ninguém fala sobre crescer time de 5 pra 50:'",
    revelacao_pessoal:
      "Abra com revelação de erro/mudança de visão. Ex: 'Eu defendia X. Estava errado. Aqui está o que mudou.'",
    pergunta_provocadora:
      "Abra com pergunta que vire premissa de cabeça pra baixo. Ex: 'E se a meta de retenção não fosse o objetivo? E se fosse a métrica errada?'",
  };
  return HINTS[pattern] ?? "";
}

function labelForMood(moodKey: string | null): string {
  if (!moodKey) return "humor padrão";
  const m = MOOD_VARIATIONS.find((x) => x.key === moodKey);
  return m?.label.toLowerCase() ?? moodKey;
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = generateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const context = await loadLeaderContext(user.id);
  if (!context) {
    return NextResponse.json(
      { error: "Profile not found. Complete onboarding first." },
      { status: 412 }
    );
  }

  const variations = parsed.data.variations ?? 1;
  const systemPrompt = buildLeaderSystemPrompt(context);

  const lengthPreset = parsed.data.length
    ? CONTENT_LENGTHS.find((l) => l.key === parsed.data.length)
    : null;
  const maxTokens = lengthPreset
    ? parsed.data.format === "linkedin_post"
      ? lengthPreset.maxTokensPost
      : lengthPreset.maxTokensArticle
    : parsed.data.format === "linkedin_post"
      ? 1400
      : 4000;

  const supabase = await createSupabaseServerClient();

  const insertRes = await supabase
    .from("content_drafts")
    .insert({
      user_id: user.id,
      format: parsed.data.format,
      topic: parsed.data.topic,
      brief: parsed.data.brief ?? null,
      status: "draft",
      meta: {
        extra_instructions: parsed.data.extra_instructions ?? null,
        length: parsed.data.length ?? null,
        tone_override: parsed.data.tone_override ?? null,
        hook_style: parsed.data.hook_style ?? null,
        objective: parsed.data.objective ?? null,
        content_type: parsed.data.content_type ?? null,
        mood: parsed.data.mood ?? null,
        variations,
        pipeline: "plan_draft_polish_critique_v2",
      },
    })
    .select()
    .single();

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json(
      { error: insertRes.error?.message ?? "DB error" },
      { status: 500 }
    );
  }

  const draftId = insertRes.data.id;
  const moodBiases = pickMoodBiases(parsed.data.mood ?? null, variations);

  try {
    // ============================================================
    // FASE 1 — PLAN (Opus, 1 chamada compartilhada por todas variações)
    //
    // O planner também ESCOLHE o melhor hook_style e content_type
    // baseado na ideia. Se o líder forçou um valor no formulário,
    // a escolha do líder tem precedência (é o que ele quis). Se o
    // líder deixou em branco (default = automático), usamos a
    // recomendação do planner.
    // ============================================================
    const plan = await planContent({
      format: parsed.data.format,
      topic: parsed.data.topic,
      brief: parsed.data.brief ?? null,
      leader: context.leader as LeaderProfile,
    });
    const planContext = planAsPromptContext(plan);

    const effectiveHookStyle =
      parsed.data.hook_style ?? plan.recommended_hook_style ?? null;
    const effectiveContentType =
      parsed.data.content_type ?? plan.recommended_content_type ?? null;
    const hookPatterns = pickHookPatterns(effectiveHookStyle, variations);

    // ============================================================
    // FASE 2 — DRAFT (Sonnet, N paralelas com mood distinto)
    //          + opcional web_search se fact_check=true
    // ============================================================
    const fewShot = await getFewShotExamples({
      userId: user.id,
      format: parsed.data.format,
      excludeId: draftId,
    });

    const anthropic = getAnthropic();
    const calls = moodBiases.map(async (moodKey, idx) => {
      const hookPattern = hookPatterns[idx];
      const hookHint = hookHintFor(hookPattern);
      // Injeta o hint do hook pattern direto no extra_instructions
      // (em vez de criar um novo param no buildContentUserPrompt)
      // Cada variação A/B/C força um padrão diferente do skill
      // /linkedin-thought-leader
      const extraWithHook = [
        parsed.data.extra_instructions,
        hookHint
          ? `PADRÃO DE HOOK PRA ESSA VARIAÇÃO (não negocie — varia entre versões pra dar diversidade real): ${hookHint}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const userPrompt = buildContentUserPrompt({
        format: parsed.data.format,
        topic: parsed.data.topic,
        brief: parsed.data.brief,
        extraInstructions: extraWithHook || null,
        // Usa a escolha do planner quando o líder não forçou
        hookStyle: effectiveHookStyle,
        objective: parsed.data.objective,
        contentType: effectiveContentType,
        length: parsed.data.length ?? null,
        toneOverride: parsed.data.tone_override ?? null,
        mood: moodKey as "best_day" | "critical" | "reflective" | null,
        planContext,
        fewShot,
      });

      const tools = parsed.data.fact_check
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ([
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 2,
            },
          ] as any)
        : undefined;

      const response = await anthropic.messages.create({
        model: FAST_MODEL, // Sonnet é mais que suficiente — o plano vem do Opus
        max_tokens: maxTokens,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        ...(tools ? { tools } : {}),
        messages: [{ role: "user", content: userPrompt }],
      });

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();

      return { moodKey, raw };
    });

    // SAFETY NET: aplica applyHardRules JÁ no draft cru. Mesmo que o
    // polish ou self-repair falhem, o em dash não passa. Defesa em
    // profundidade — aplicado em CADA fase do pipeline.
    const drafted = (await Promise.allSettled(calls))
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((x): x is { moodKey: string | null; raw: string } => !!x && !!x.raw)
      .map((d) => ({ ...d, raw: applyHardRules(d.raw) }));

    if (!drafted.length) throw new Error("Todas as gerações falharam na fase de draft.");

    // ============================================================
    // FASE 3 — POLISH (Sonnet, N paralelas: anti-clichê + cut + sensorial)
    // ============================================================
    const polished = await Promise.allSettled(
      drafted.map((d) =>
        polishPass({
          draft: d.raw,
          format: parsed.data.format,
          notes: `Versão ${labelForMood(d.moodKey)}`,
          // Lista de fatos dos materiais anexados — polish verifica
          // que o draft cita pelo menos um. Sem isso, o modelo
          // "esquece" do material às vezes.
          mustCiteFacts: parsed.data.must_cite_facts ?? undefined,
        })
      )
    );

    const polishedFinal = drafted.map((d, i) => {
      const p = polished[i];
      // SAFETY NET 2: fallback do polish também passa por applyHardRules.
      // O d.raw já está limpo (aplicamos acima), mas a defesa redundante
      // protege contra qualquer reintrodução.
      const text = p.status === "fulfilled" && p.value ? p.value : d.raw;
      return { moodKey: d.moodKey, text: applyHardRules(text) };
    });

    // ============================================================
    // FASE 4 — SELF-CRITIQUE (review + conditional repair)
    //          Roda o MESMO revisor da revisão em tempo real e, se o
    //          score for ruim, corrige antes de devolver pro líder.
    // ============================================================
    const critiqued = await Promise.allSettled(
      polishedFinal.map(async (v) => {
        try {
          const review = await reviewText({
            userId: user.id,
            text: v.text,
            format: parsed.data.format,
          });
          if (!review) return { ...v, review: null, repaired: false };

          const errorIssues = review.issues.filter(
            (i) => i.severity === "error"
          );
          const needsRepair =
            review.voice_match_score < 75 || errorIssues.length > 0;

          if (!needsRepair) return { ...v, review, repaired: false };

          const repaired = await selfRepair({
            draft: v.text,
            format: parsed.data.format,
            issues: review.issues.slice(0, 6),
            voiceNotes: review.voice_notes,
            voiceMatchScore: review.voice_match_score,
          });
          return {
            ...v,
            text: repaired || v.text,
            review,
            repaired: !!repaired && repaired !== v.text,
          };
        } catch {
          return { ...v, review: null, repaired: false };
        }
      })
    );

    // SAFETY NET 3 (FINAL): aplica applyHardRules em CADA versão antes
    // de salvar no banco. Mesmo que o critique/repair tenha reintroduzido
    // qualquer tell, o em dash não chega no editor do líder.
    const final = critiqued
      .map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : {
              ...polishedFinal[i],
              review: null as Awaited<ReturnType<typeof reviewText>>,
              repaired: false,
            }
      )
      .map((v) => ({ ...v, text: applyHardRules(v.text) }));

    // ============================================================
    // Salva primary + alt_versions + plan + review no meta
    // ============================================================
    const primary = final[0];
    const alts: AltVersion[] = final.slice(1).map((s, i) => ({
      id: crypto.randomUUID(),
      label: `Versão ${String.fromCharCode(66 + i)} — ${labelForMood(s.moodKey)}`,
      body: s.text,
      generated_at: new Date().toISOString(),
    }));

    // Salva versão A no histórico
    await supabase.from("draft_versions").insert({
      content_draft_id: draftId,
      user_id: user.id,
      body: primary.text,
      reason: `Geração inicial — Versão A (${labelForMood(primary.moodKey)})${
        primary.repaired ? " · auto-revisado" : ""
      }`,
    });

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({
        draft_markdown: primary.text,
        alt_versions: alts,
        meta: {
          ...((insertRes.data.meta as Record<string, unknown>) ?? {}),
          plan,
          review: primary.review ?? null,
          self_repaired: primary.repaired,
          // Trilha de decisão editorial — útil pro líder ver o que o
          // motor escolheu quando ele deixou em automático.
          effective_hook_style: effectiveHookStyle,
          effective_content_type: effectiveContentType,
          hook_chosen_by:
            parsed.data.hook_style ? "leader" : plan.recommended_hook_style ? "planner" : "default",
          content_type_chosen_by:
            parsed.data.content_type
              ? "leader"
              : plan.recommended_content_type
                ? "planner"
                : "default",
        },
      })
      .eq("id", draftId)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ draft: updated });
  } catch (err) {
    await supabase
      .from("content_drafts")
      .update({
        meta: {
          error: err instanceof Error ? err.message : "generation_failed",
        },
      })
      .eq("id", draftId);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation_failed" },
      { status: 500 }
    );
  }
}
