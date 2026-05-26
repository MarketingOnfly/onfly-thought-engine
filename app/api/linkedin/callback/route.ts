import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { exchangeCodeForToken, fetchProfile, fetchFollowerCount } from "@/lib/linkedin/client";

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateFromQuery = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieState = request.cookies.get("linkedin_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/analytics?error=${encodeURIComponent(
          errorDescription ?? error
        )}`,
        request.url
      )
    );
  }

  if (!code || !stateFromQuery || stateFromQuery !== cookieState) {
    return NextResponse.redirect(
      new URL(`/dashboard/analytics?error=state_mismatch`, request.url)
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const profile = await fetchProfile(token.access_token);
    const followers = await fetchFollowerCount(token.access_token, profile.sub);

    const supabase = await createSupabaseServerClient();
    const tokenExpiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const vanity = (profile as unknown as { vanityName?: string }).vanityName;
    const linkedinUrl = vanity ? `https://www.linkedin.com/in/${vanity}` : null;

    await supabase.from("linkedin_connections").upsert(
      {
        user_id: user.id,
        linkedin_user_id: profile.sub,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        token_expires_at: tokenExpiresAt,
        scope: token.scope,
        profile_data: profile as unknown as Record<string, unknown>,
        linkedin_url: linkedinUrl,
        followers_count: followers,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Best-effort: also stamp the leader_profile linkedin_url if blank
    await supabase
      .from("leader_profiles")
      .update({ linkedin_url: linkedinUrl })
      .eq("user_id", user.id)
      .is("linkedin_url", null);

    const res = NextResponse.redirect(
      new URL(`/dashboard/analytics?connected=1`, request.url)
    );
    res.cookies.delete("linkedin_oauth_state");
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao conectar com LinkedIn";
    return NextResponse.redirect(
      new URL(`/dashboard/analytics?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
