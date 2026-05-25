import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { ReferenceLink, TopicSuggestion } from "@/lib/db/types";
import DiscoverPanel from "./panel";

export default async function DiscoverPage() {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();

  const [ideasRes, linksRes] = await Promise.all([
    supabase
      .from("topic_suggestions")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .order("relevance_score", { ascending: false })
      .limit(40),
    supabase.from("reference_links").select("*").eq("user_id", user.id),
  ]);

  return (
    <div className="container max-w-5xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-4 font-display text-4xl tracking-tight">
        Descobrir <span className="gradient-text">pautas</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        O motor varre as fontes da sua biblioteca e devolve ideias com seu ângulo. Você seleciona o
        que faz sentido e manda direto pro gerador.
      </p>

      <DiscoverPanel
        initialIdeas={(ideasRes.data ?? []) as TopicSuggestion[]}
        sources={(linksRes.data ?? []) as ReferenceLink[]}
      />
    </div>
  );
}
