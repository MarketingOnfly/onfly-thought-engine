import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { learnFromFeedback } from "@/lib/anthropic/learn-from-feedback";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * GET /api/content/[id]/feedback — devolve o feedback existente (se houver).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_feedback")
    .select("*")
    .eq("content_draft_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data });
}

/**
 * POST /api/content/[id]/feedback — registra/atualiza o feedback e
 * dispara a retroalimentação do perfil em background.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const ratingRaw = Number(body?.rating);
  const comment =
    typeof body?.comment === "string" && body.comment.trim().length
      ? body.comment.trim().slice(0, 2000)
      : null;

  if (!Number.isFinite(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    return NextResponse.json(
      { error: "Rating precisa ser número entre 1 e 5." },
      { status: 400 }
    );
  }
  const rating = Math.round(ratingRaw);

  const supabase = await createSupabaseServerClient();

  // Confirma que o draft pertence ao user (RLS já bloqueia, mas mensagem
  // fica mais clara aqui).
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!draft) {
    return NextResponse.json({ error: "Draft não encontrado." }, { status: 404 });
  }

  // Upsert pelo content_draft_id (1 feedback por draft).
  const { data: upserted, error: upErr } = await supabase
    .from("content_feedback")
    .upsert(
      {
        user_id: user.id,
        content_draft_id: id,
        rating,
        comment,
      },
      { onConflict: "content_draft_id" }
    )
    .select()
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Retroalimentação assíncrona. Não bloqueia a resposta — UI mostra
  // "salvo" imediato, e o aprendizado roda em background.
  void recomputeLearnedPreferences(user.id).catch((err) => {
    console.error("[feedback] learn error", err);
  });

  return NextResponse.json({ feedback: upserted });
}

/**
 * Pega os últimos 15 feedbacks + drafts e roda o Claude pra sintetizar
 * em learned_preferences. Roda em background depois do POST.
 */
async function recomputeLearnedPreferences(userId: string) {
  const supabase = await createSupabaseServerClient();

  // últimos 15 feedbacks
  const { data: feedbacks } = await supabase
    .from("content_feedback")
    .select(
      "rating, comment, created_at, content_draft_id, content_draft:content_drafts(topic, draft_markdown)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (!feedbacks?.length) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const samples = (feedbacks as any[]).map((f) => ({
    rating: f.rating,
    comment: f.comment,
    draft_topic: f.content_draft?.topic ?? "",
    draft_text: f.content_draft?.draft_markdown ?? null,
    created_at: f.created_at,
  }));

  const preferences = await learnFromFeedback(samples);
  if (!preferences) return;

  await supabase
    .from("leader_profiles")
    .update({ learned_preferences: preferences })
    .eq("user_id", userId);
}
