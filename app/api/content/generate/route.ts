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
import { polishPass } from "@/lib/anthropic/polish-pass";
import { getFewShotExamples } from "@/lib/anthropic/few-shot";
import type { AltVersion, LeaderProfile } from "@/lib/db/types";

export const maxDuration = 180;

/**
 * Pipeline de geração (cada chamada faz):
 *  1. PLAN (Opus) — Sênior editor pensa estrutura, tensão, fato, mood.
 *  2. DRAFT (Sonnet) — Executor escreve seguindo o plano + few-shot.
 *  3. POLISH (Sonnet) — Anti-clichê + cut 20% + sensorial check.
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
        pipeline: "plan_draft_polish_v1",
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
    // ============================================================
    const plan = await planContent({
      format: parsed.data.format,
      topic: parsed.data.topic,
      brief: parsed.data.brief ?? null,
      leader: context.leader as LeaderProfile,
    });
    const planContext = planAsPromptContext(plan);

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
    const calls = moodBiases.map(async (moodKey) => {
      const userPrompt = buildContentUserPrompt({
        format: parsed.data.format,
        topic: parsed.data.topic,
        brief: parsed.data.brief,
        extraInstructions: parsed.data.extra_instructions,
        hookStyle: parsed.data.hook_style,
        objective: parsed.data.objective,
        contentType: parsed.data.content_type,
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

    const drafted = (await Promise.allSettled(calls))
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((x): x is { moodKey: string | null; raw: string } => !!x && !!x.raw);

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
        })
      )
    );

    const final = drafted.map((d, i) => {
      const p = polished[i];
      const text = p.status === "fulfilled" && p.value ? p.value : d.raw;
      return { moodKey: d.moodKey, text };
    });

    // ============================================================
    // Salva primary + alt_versions + plan no meta
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
      reason: `Geração inicial — Versão A (${labelForMood(primary.moodKey)})`,
    });

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({
        draft_markdown: primary.text,
        alt_versions: alts,
        meta: {
          ...((insertRes.data.meta as Record<string, unknown>) ?? {}),
          plan,
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
