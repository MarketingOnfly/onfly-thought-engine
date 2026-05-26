import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildLeaderSystemPrompt,
  buildContentUserPrompt,
} from "@/lib/anthropic/prompts";
import { generateContentSchema } from "@/lib/validation";
import { CONTENT_LENGTHS } from "@/lib/style-presets";

export const maxDuration = 60;

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

  const systemPrompt = buildLeaderSystemPrompt(context);
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
  });

  // max_tokens segue o tamanho pedido — corta antes do modelo "ficar empolgado".
  const lengthPreset = parsed.data.length
    ? CONTENT_LENGTHS.find((l) => l.key === parsed.data.length)
    : null;
  const maxTokens = lengthPreset
    ? parsed.data.format === "linkedin_post"
      ? lengthPreset.maxTokensPost
      : lengthPreset.maxTokensArticle
    : parsed.data.format === "linkedin_post"
      ? 1400 // default = médio
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

  try {
    const anthropic = getAnthropic();
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

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({ draft_markdown: text })
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

