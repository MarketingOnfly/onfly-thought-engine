import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/linkedin/client";
import { randomBytes } from "node:crypto";

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  let authUrl: string;
  try {
    const state = randomBytes(16).toString("hex");
    authUrl = buildAuthUrl(state);
    const res = NextResponse.redirect(authUrl);
    // store state in httpOnly cookie pra validar no callback
    res.cookies.set("linkedin_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LinkedIn config error";
    return NextResponse.redirect(
      new URL(`/dashboard/analytics?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
