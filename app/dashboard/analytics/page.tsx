import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { LinkedInConnection, PostMetric } from "@/lib/db/types";
import AnalyticsView from "./view";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();

  const params = await searchParams;

  const [connRes, metricsRes] = await Promise.all([
    supabase
      .from("linkedin_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("post_metrics")
      .select("*, content_draft:content_drafts(id, topic, tags, format)")
      .eq("user_id", user.id)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("fetched_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="container max-w-6xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-4 font-display text-4xl tracking-tight">
        Analytics <span className="text-muted-foreground">do seu LinkedIn</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Conecta seu perfil, sincroniza as métricas e o motor cruza com os temas que você escreveu
        — pra você ver o que ressoou.
      </p>

      <AnalyticsView
        connection={(connRes.data ?? null) as LinkedInConnection | null}
        metrics={(metricsRes.data ?? []) as (PostMetric & {
          content_draft?: { id: string; topic: string; tags: string[]; format: string } | null;
        })[]}
        flash={{
          connected: params.connected === "1",
          error: params.error ?? null,
        }}
      />
    </div>
  );
}
