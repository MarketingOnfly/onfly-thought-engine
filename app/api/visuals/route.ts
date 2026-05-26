import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { generateVisual } from "@/lib/anthropic/visuals";
import { visualSchema } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = visualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }

  let result;
  try {
    result = await generateVisual({
      userId: user.id,
      archetype: parsed.data.archetype ?? undefined,
      topic: parsed.data.topic,
      brief: parsed.data.brief,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "visual_failed" },
      { status: 500 }
    );
  }

  if (!result) {
    return NextResponse.json({ error: "Profile not found" }, { status: 412 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_visuals")
    .insert({
      user_id: user.id,
      draft_id: parsed.data.draft_id ?? null,
      kind: parsed.data.kind,
      payload: result.payload,
      prompt_used: result.promptUsed,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visual: data });
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get("draft_id");
  if (!draftId) {
    return NextResponse.json({ error: "draft_id required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_visuals")
    .select("*")
    .eq("user_id", user.id)
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
