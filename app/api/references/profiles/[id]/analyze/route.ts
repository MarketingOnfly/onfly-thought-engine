import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { analyzeReference } from "@/lib/anthropic/analyze";
import type { ReferenceProfile } from "@/lib/db/types";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: ref, error } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !ref) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const manualSample = typeof body?.sample === "string" ? body.sample : null;

  const result = await analyzeReference({
    url: (ref as ReferenceProfile).url,
    manualSample,
  });

  // Resultado em formato { error: "..." } — persiste erro pra UI e devolve 500
  if (result && "error" in result) {
    await supabase
      .from("reference_profiles")
      .update({
        analyzed_at: new Date().toISOString(),
        analysis_error: result.error,
      })
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (!result) {
    const msg = "Análise não retornou resultado. Tente de novo.";
    await supabase
      .from("reference_profiles")
      .update({ analysis_error: msg })
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Sucesso — persiste tudo e zera erro
  const { data: updated, error: updErr } = await supabase
    .from("reference_profiles")
    .update({
      hook_examples:
        result.hook_examples || (ref as ReferenceProfile).hook_examples,
      style_notes: result.style_notes,
      tone_signals: result.tone_signals,
      positioning: result.positioning,
      topics_recurring: result.topics_recurring,
      vocab_notes: result.vocab_notes,
      analyzed_at: new Date().toISOString(),
      analysis_status: result.status,
      analysis_error: null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ item: updated });
}
