import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getServerUser,
} from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Service role ignora RLS — admin enxerga todos os líderes na view.
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    supabase = await createSupabaseServerClient();
  }

  const { data, error } = await supabase
    .from("leader_overview")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaders: data ?? [] });
}
