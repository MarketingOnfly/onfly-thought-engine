import { NextResponse, after, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";
import { analyzeVoice } from "@/lib/anthropic/analyze-voice";

export const maxDuration = 60;
export const runtime = "nodejs";

const postSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(100, "Cole o texto inteiro — mínimo 100 caracteres pra análise valer.").max(20_000),
});

/**
 * Recalcula o voice_fingerprint a partir de TODOS os samples do líder.
 * Roda em background (after) — o líder não espera a análise.
 */
async function recomputeFingerprint(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: samples } = await supabase
    .from("leader_voice_samples")
    .select("title, body")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);

  const fingerprint = samples?.length
    ? await analyzeVoice(samples as { title: string; body: string }[])
    : null;

  await supabase
    .from("leader_profiles")
    .update({ voice_fingerprint: fingerprint })
    .eq("user_id", userId);
}

/** GET — lista os textos próprios + fingerprint atual */
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const [{ data: samples }, { data: profile }] = await Promise.all([
    supabase
      .from("leader_voice_samples")
      .select("id, title, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leader_profiles")
      .select("voice_fingerprint")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    samples: samples ?? [],
    fingerprint: profile?.voice_fingerprint ?? null,
  });
}

/** POST — adiciona um texto próprio e re-analisa a voz em background */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 422 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leader_voice_samples")
    .insert({
      user_id: user.id,
      title: parsed.data.title?.trim() || "Texto sem título",
      body: parsed.data.body,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-análise em background — after() garante execução pós-response
  // em serverless (void fn() seria abortado).
  after(async () => {
    try {
      await recomputeFingerprint(user.id);
    } catch (err) {
      console.error("[voice-samples] fingerprint recompute failed", err);
    }
  });

  return NextResponse.json({ sample: data, analyzing: true });
}
