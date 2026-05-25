import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase/server";
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
