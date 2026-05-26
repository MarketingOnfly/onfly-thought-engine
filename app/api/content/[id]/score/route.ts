import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { scoreStyle } from "@/lib/anthropic/score-style";
import type { LeaderProfile } from "@/lib/db/types";

export const maxDuration = 60;

/**
 * POST /api/content/[id]/score — roda o motor pra autoavaliar o draft
 * e persiste em content_drafts.style_score.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: draft }, { data: profile }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("id, draft_markdown, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("leader_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  if (!draft.draft_markdown)
    return NextResponse.json({ error: "draft sem texto pra avaliar" }, { status: 400 });
  if (!profile)
    return NextResponse.json({ error: "profile not found" }, { status: 412 });

  let result;
  try {
    result = await scoreStyle({
      draftText: draft.draft_markdown,
      profile: profile as LeaderProfile,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "score_failed" },
      { status: 500 }
    );
  }

  const score = {
    ...result,
    computed_at: new Date().toISOString(),
  };

  const { error: updErr } = await supabase
    .from("content_drafts")
    .update({ style_score: score })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ score });
}
