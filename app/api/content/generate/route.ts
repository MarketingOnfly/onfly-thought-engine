import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildLeaderSystemPrompt,
  buildContentUserPrompt,
} from "@/lib/anthropic/prompts";
import { generateContentSchema } from "@/lib/validation";
import { CONTENT_LENGTHS, HOOK_STYLES } from "@/lib/style-presets";
import type { AltVersion } from "@/lib/db/types";

export const maxDuration = 90;

/**
 * Quando o líder pede mais de 1 variação, a gente força hooks distintos
 * pra cada uma — assim as versões abrem diferente em vez de saírem
 * variações sutis do mesmo texto.
 *
 * Bias 1: usa o hook escolhido pelo líder OU deixa o motor decidir.
 * Bias 2/3: pega hooks contrastantes da lista.
 */
function pickHookBiases(
  chosenHookStyle: string | null,
  count: number
): (string | null)[] {
  const biases: (string | null)[] = [chosenHookStyle];
  if (count <= 1) return biases;
  // Hooks com personalidades bem distintas — escolhidos pra dar variedade
  const diversityPool = [
    "data_revelation",
    "contradiction",
    "story_open",
    "confessional",
    "common_enemy",
    "forbidden_truth",
  ];
  const excluded = new Set<string>([chosenHookStyle ?? ""]);
  for (const candidate of diversityPool) {
    if (biases.length >= count) break;
    if (excluded.has(candidate)) continue;
    // Confirma que o hook existe no catálogo
    if (!HOOK_STYLES.find((h) => h.key === candidate)) continue;
    biases.push(candidate);
    excluded.add(candidate);
  }
  return biases.slice(0, count);
}

function labelForHook(hookKey: string | null): string {
  if (!hookKey) return "abertura livre";
  const h = HOOK_STYLES.find((x) => x.key === hookKey);
  return h?.label.toLowerCase() ?? hookKey;
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
        variations,
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
  const hookBiases = pickHookBiases(parsed.data.hook_style ?? null, variations);

  try {
    const anthropic = getAnthropic();

    // N calls em paralelo, cada um com hook bias diferente
    const calls = hookBiases.map(async (hookKey) => {
      const userPrompt = buildContentUserPrompt({
        format: parsed.data.format,
        topic: parsed.data.topic,
        brief: parsed.data.brief,
        extraInstructions: parsed.data.extra_instructions,
        hookStyle: hookKey,
        objective: parsed.data.objective,
        contentType: parsed.data.content_type,
        length: parsed.data.length ?? null,
        toneOverride: parsed.data.tone_override ?? null,
      });

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();

      return { hookKey, text };
    });

    const settled = await Promise.allSettled(calls);
    const successful = settled
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((x): x is { hookKey: string | null; text: string } => !!x && !!x.text);

    if (!successful.length) {
      const reason = settled.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      throw new Error(
        reason?.reason instanceof Error
          ? reason.reason.message
          : "Todas as gerações falharam."
      );
    }

    // Primeira chamada vira o draft principal. Outras viram alt_versions.
    const primary = successful[0];
    const alts: AltVersion[] = successful.slice(1).map((s, i) => ({
      id: crypto.randomUUID(),
      label: `Versão ${String.fromCharCode(66 + i)} — ${labelForHook(s.hookKey)}`, // B, C, D...
      body: s.text,
      generated_at: new Date().toISOString(),
    }));

    // Salva também a versão A no histórico (pra restaurar depois)
    await supabase.from("draft_versions").insert({
      content_draft_id: draftId,
      user_id: user.id,
      body: primary.text,
      reason: `Geração inicial — Versão A (${labelForHook(primary.hookKey)})`,
    });

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({
        draft_markdown: primary.text,
        alt_versions: alts,
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
