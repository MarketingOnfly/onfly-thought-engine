import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const maxDuration = 30;
export const runtime = "nodejs";

interface FeedbackRow {
  id: string;
  user_id: string;
  content_draft_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface DraftRow {
  id: string;
  user_id: string;
  topic: string;
  format: string;
  draft_markdown: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
  role: string | null;
  area: string | null;
  avatar_url: string | null;
  learned_preferences: string | null;
}

/**
 * GET /api/admin/learning-summary
 *
 * Devolve um compilado dos feedbacks + aprendizado do motor por líder.
 * Admin only. Usa service_role pra ler entre RLS sem precisar ser cada
 * líder — já é cross-user por design.
 *
 * Estrutura:
 *  - global: totais + médias
 *  - leaders[]: por líder, stats + learned_preferences + 3 exemplos
 *    de feedback recentes (com excerpt do draft)
 */
export async function GET(_request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();

  // Pega tudo em paralelo
  const [profilesRes, feedbacksRes, draftsRes] = await Promise.all([
    admin
      .from("leader_profiles")
      .select(
        "user_id, full_name, role, area, avatar_url, learned_preferences"
      )
      .eq("onboarding_completed", true),
    admin
      .from("content_feedback")
      .select("id, user_id, content_draft_id, rating, comment, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("content_drafts")
      .select("id, user_id, topic, format, draft_markdown, created_at"),
  ]);

  if (profilesRes.error) {
    return NextResponse.json(
      { error: profilesRes.error.message },
      { status: 500 }
    );
  }

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const allFeedbacks = (feedbacksRes.data ?? []) as FeedbackRow[];
  const allDrafts = (draftsRes.data ?? []) as DraftRow[];

  const draftsById = new Map<string, DraftRow>();
  for (const d of allDrafts) draftsById.set(d.id, d);

  // Agrupa feedbacks por user_id
  const feedbacksByUser = new Map<string, FeedbackRow[]>();
  for (const f of allFeedbacks) {
    const arr = feedbacksByUser.get(f.user_id) ?? [];
    arr.push(f);
    feedbacksByUser.set(f.user_id, arr);
  }

  // Monta a estrutura por líder
  const leaders = profiles.map((p) => {
    const myFeedbacks = feedbacksByUser.get(p.user_id) ?? [];
    const ratings = myFeedbacks.map((f) => f.rating);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;
    const positiveCount = ratings.filter((r) => r >= 4).length;
    const negativeCount = ratings.filter((r) => r <= 2).length;

    // 5 exemplos mais recentes (com excerpt do draft)
    const recentExamples = myFeedbacks.slice(0, 5).map((f) => {
      const draft = draftsById.get(f.content_draft_id);
      return {
        feedback_id: f.id,
        rating: f.rating,
        comment: f.comment,
        created_at: f.created_at,
        draft_id: f.content_draft_id,
        draft_topic: draft?.topic ?? null,
        draft_format: draft?.format ?? null,
        draft_excerpt: draft?.draft_markdown?.slice(0, 200) ?? null,
      };
    });

    return {
      user_id: p.user_id,
      full_name: p.full_name,
      role: p.role,
      area: p.area,
      avatar_url: p.avatar_url,
      learned_preferences: p.learned_preferences,
      feedback_count: myFeedbacks.length,
      avg_rating: avgRating,
      positive_count: positiveCount,
      negative_count: negativeCount,
      recent_examples: recentExamples,
    };
  });

  // Stats globais
  const totalFeedbacks = allFeedbacks.length;
  const globalAvg =
    totalFeedbacks > 0
      ? allFeedbacks.reduce((sum, f) => sum + f.rating, 0) / totalFeedbacks
      : null;
  const globalPositiveRate =
    totalFeedbacks > 0
      ? allFeedbacks.filter((f) => f.rating >= 4).length / totalFeedbacks
      : 0;
  const globalNegativeRate =
    totalFeedbacks > 0
      ? allFeedbacks.filter((f) => f.rating <= 2).length / totalFeedbacks
      : 0;
  const leadersWithFeedback = leaders.filter((l) => l.feedback_count > 0).length;

  // Últimos 10 comentários negativos com líder identificado — útil pra
  // o admin ver o que o time tá reclamando agora.
  const recentNegatives = allFeedbacks
    .filter((f) => f.rating <= 2 && f.comment && f.comment.trim().length > 0)
    .slice(0, 10)
    .map((f) => {
      const profile = profiles.find((p) => p.user_id === f.user_id);
      const draft = draftsById.get(f.content_draft_id);
      return {
        feedback_id: f.id,
        rating: f.rating,
        comment: f.comment,
        created_at: f.created_at,
        leader_name: profile?.full_name ?? "—",
        leader_user_id: f.user_id,
        draft_id: f.content_draft_id,
        draft_topic: draft?.topic ?? null,
      };
    });

  return NextResponse.json({
    global: {
      total_feedbacks: totalFeedbacks,
      avg_rating: globalAvg,
      positive_rate: globalPositiveRate,
      negative_rate: globalNegativeRate,
      active_leaders: profiles.length,
      leaders_with_feedback: leadersWithFeedback,
    },
    leaders: leaders.sort((a, b) => b.feedback_count - a.feedback_count),
    recent_negatives: recentNegatives,
  });
}
