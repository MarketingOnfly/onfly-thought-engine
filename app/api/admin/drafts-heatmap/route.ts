import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getServerUser,
} from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * GET /api/admin/drafts-heatmap
 * Devolve {user_id, user_name, created_at} de todos os drafts das últimas
 * 12 semanas, pra o heatmap renderizar buckets semana × líder.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    supabase = await createSupabaseServerClient();
  }

  const sinceISO = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("content_drafts")
    .select("user_id, created_at, leader_profile:leader_profiles!inner(full_name)")
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((r: any) => ({
    user_id: r.user_id as string,
    user_name: (r.leader_profile?.full_name as string) ?? "Sem nome",
    created_at: r.created_at as string,
  }));

  return NextResponse.json({ rows });
}
