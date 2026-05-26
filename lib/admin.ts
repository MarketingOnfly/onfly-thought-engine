import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isAdminEmail,
} from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function isAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("org_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

/**
 * Sincroniza ADMIN_EMAILS (env) com a tabela org_admins.
 * Idempotente — usa a função SQL ensure_admin_for_email que faz UPSERT.
 *
 * Chamado no carregamento de /admin pra que adicionar email no env do
 * Vercel + redeploy seja suficiente: na primeira visita, o admin novo já
 * aparece na listagem (sem precisar rodar SQL).
 *
 * Silencioso em caso de erro (não quebra o painel). Loga no console.
 */
export async function seedEnvAdmins(): Promise<void> {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!emails.length) return;

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    // service role não configurado → nada a fazer, segue só com ADMIN_EMAILS in-memory
    return;
  }

  await Promise.allSettled(
    emails.map((email) =>
      admin.rpc("ensure_admin_for_email", { p_email: email })
    )
  );
}
