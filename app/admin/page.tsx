import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import type { OrgDocument } from "@/lib/db/types";
import AdminPanel from "./panel";

export default async function AdminHome() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user))) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("org_documents")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="container max-w-5xl px-6 py-10">
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

      <h1 className="mt-4 font-display text-4xl tracking-tight">Guidelines da Onfly</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Tudo aqui é injetado como contexto OBRIGATÓRIO em cada prompt de cada líder. Edite com cuidado:
        muda o tom de todas as gerações.
      </p>

      <AdminPanel initial={(data ?? []) as OrgDocument[]} />
    </div>
  );
}
