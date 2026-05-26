import { NextResponse } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("linkedin_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
