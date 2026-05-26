import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Fluxo de recuperação de senha — redireciona para página de nova senha
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/recuperar-senha/nova-senha`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
