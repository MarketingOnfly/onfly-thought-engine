import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin, seedEnvAdmins } from "@/lib/admin";
import type { Campaign, OrgDocument } from "@/lib/db/types";
import AdminTabs from "./tabs";

export default async function AdminHome() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user))) redirect("/dashboard");

  // Sincroniza ADMIN_EMAILS → org_admins toda vez que /admin é aberto.
  // Idempotente — só insere se faltar e se o user já tiver feito login.
  await seedEnvAdmins();

  const supabase = await createSupabaseServerClient();

  const [docsRes, campaignsRes, leadersRes] = await Promise.all([
    supabase.from("org_documents").select("*").order("created_at", { ascending: true }),
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    supabase
      .from("leader_profiles")
      .select("user_id, full_name, role, area, onboarding_completed")
      .order("full_name", { ascending: true }),
  ]);

  const allLeaders = (leadersRes.data ?? []).filter((l) => l.onboarding_completed);
  const activeLeaders = allLeaders.length;

  return (
    <div className="container max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin
        </span>
      </div>

      <h1 className="mt-4 font-display text-4xl tracking-tight">Painel admin</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Suas orientações entram no contexto que o motor lê pra todo líder. Campanhas geram um
        rascunho personalizado pra cada líder ativo. Use com peso.
      </p>

      <AdminTabs
        initialDocs={(docsRes.data ?? []) as OrgDocument[]}
        initialCampaigns={(campaignsRes.data ?? []) as Campaign[]}
        activeLeaders={activeLeaders}
        leaders={allLeaders.map((l) => ({
          user_id: l.user_id as string,
          full_name: l.full_name as string,
          role: (l.role as string | null) ?? "",
          area: (l.area as string | null) ?? "",
        }))}
        currentUserId={user.id}
      />
    </div>
  );
}
