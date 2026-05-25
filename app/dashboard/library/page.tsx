import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import LibraryTabs from "./tabs";

export default async function LibraryPage() {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();

  const [drafts, refProfiles, refLinks, docs] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("reference_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("reference_links")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("leader_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="container max-w-5xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-4 font-display text-4xl tracking-tight">Biblioteca</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Seu acervo: conteúdos publicáveis, perfis e fontes de referência, documentos de base.
      </p>

      <LibraryTabs
        initialDrafts={drafts.data ?? []}
        initialProfiles={refProfiles.data ?? []}
        initialLinks={refLinks.data ?? []}
        initialDocs={docs.data ?? []}
      />
    </div>
  );
}
