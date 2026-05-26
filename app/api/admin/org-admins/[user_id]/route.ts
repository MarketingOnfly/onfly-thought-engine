import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  getServerUser,
  isAdminEmail,
} from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

/**
 * Remove um admin. Não permite remover a si mesmo (footgun) nem admins
 * fixados via ADMIN_EMAILS (esses são imutáveis pela UI).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { user_id } = await params;

  if (user_id === user.id) {
    return NextResponse.json(
      { error: "Você não pode remover a si mesmo. Peça pra outro admin fazer." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "service role missing" },
      { status: 500 }
    );
  }

  // Checa se é admin fixado por env
  const { data: targetUser } = await admin.auth.admin.getUserById(user_id);
  if (targetUser?.user && isAdminEmail(targetUser.user.email)) {
    return NextResponse.json(
      {
        error:
          "Esse admin está fixado via ADMIN_EMAILS. Pra remover, tire o email da variável e faça redeploy.",
      },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("org_admins")
    .delete()
    .eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
