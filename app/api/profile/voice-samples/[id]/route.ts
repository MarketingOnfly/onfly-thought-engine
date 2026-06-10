import { NextResponse, after, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { analyzeVoice } from "@/lib/anthropic/analyze-voice";

export const maxDuration = 60;
export const runtime = "nodejs";

/** DELETE — remove um texto próprio e re-analisa a voz em background */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("leader_voice_samples")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  after(async () => {
    try {
      const sb = await createSupabaseServerClient();
      const { data: samples } = await sb
        .from("leader_voice_samples")
        .select("title, body")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12);
      const fingerprint = samples?.length
        ? await analyzeVoice(samples as { title: string; body: string }[])
        : null;
      await sb
        .from("leader_profiles")
        .update({ voice_fingerprint: fingerprint })
        .eq("user_id", user.id);
    } catch (err) {
      console.error("[voice-samples] fingerprint recompute failed", err);
    }
  });

  return NextResponse.json({ ok: true });
}
