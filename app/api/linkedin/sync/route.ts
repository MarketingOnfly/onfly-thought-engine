import { NextResponse } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { fetchProfile, fetchFollowerCount } from "@/lib/linkedin/client";
import type { LinkedInConnection } from "@/lib/db/types";

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("linkedin_connections")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "LinkedIn ainda não conectado." },
      { status: 412 }
    );
  }

  const conn = data as LinkedInConnection;

  if (new Date(conn.token_expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Token expirou. Reconecte o LinkedIn." },
      { status: 401 }
    );
  }

  try {
    const profile = await fetchProfile(conn.access_token);
    const followers = await fetchFollowerCount(conn.access_token, profile.sub);

    const { data: updated, error: updErr } = await supabase
      .from("linkedin_connections")
      .update({
        profile_data: profile as unknown as Record<string, unknown>,
        followers_count: followers,
        last_synced_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({
      connection: updated,
      note:
        conn.marketing_api_status === "approved"
          ? null
          : "Métricas de impressões/reações dos posts requerem aprovação do app no Marketing Developer Platform do LinkedIn. Enquanto isso, use o CSV export do LinkedIn Creator Analytics ou entrada manual.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro" },
      { status: 500 }
    );
  }
}
