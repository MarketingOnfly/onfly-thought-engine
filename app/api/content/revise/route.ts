import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildLeaderSystemPrompt,
  buildReviseUserPrompt,
} from "@/lib/anthropic/prompts";
import { reviseContentSchema } from "@/lib/validation";
import type { ContentDraft } from "@/lib/db/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = reviseContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: draftRow, error: draftErr } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("id", parsed.data.draft_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (draftErr || !draftRow) {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }

  const draft = draftRow as ContentDraft;
  const currentText = draft.draft_markdown ?? "";
  if (!currentText) {
    return NextResponse.json({ error: "draft has no content yet" }, { status: 400 });
  }

  const context = await loadLeaderContext(user.id);
  if (!context)
    return NextResponse.json({ error: "Profile not found" }, { status: 412 });

  const systemPrompt = buildLeaderSystemPrompt(context);
  const userPrompt = buildReviseUserPrompt({
    format: draft.format,
    currentDraft: currentText,
    instructions: parsed.data.instructions,
  });

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: draft.format === "linkedin_post" ? 2000 : 6000,
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

    const meta = (draft.meta as Record<string, unknown>) ?? {};
    const revisions = Array.isArray(meta.revisions) ? meta.revisions : [];
    const nextMeta = {
      ...meta,
      revisions: [
        ...revisions,
        {
          at: new Date().toISOString(),
          instructions: parsed.data.instructions,
          previous: currentText,
        },
      ],
    };

    // Salva a versão atual no histórico antes de sobrescrever
    await supabase.from("draft_versions").insert({
      content_draft_id: draft.id,
      user_id: user.id,
      body: currentText,
      reason: `Antes de revisar: "${parsed.data.instructions.slice(0, 120)}"`,
    });

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({
        draft_markdown: text,
        status: "refining",
        meta: nextMeta,
      })
      .eq("id", draft.id)
      .select()
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ draft: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "revise_failed" },
      { status: 500 }
    );
  }
}
