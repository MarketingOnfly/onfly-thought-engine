import Link from "next/link";
import { ArrowRight, Compass, FilePenLine, Library, Sparkles } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, truncate } from "@/lib/utils";
import type { ContentDraft, LeaderProfile, ReferenceLink, ReferenceProfile, LeaderDocument } from "@/lib/db/types";

export default async function DashboardHome() {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();

  const [profileRes, draftsRes, refProfilesRes, refLinksRes, docsRes] = await Promise.all([
    supabase.from("leader_profiles").select("*").eq("user_id", user.id).single(),
    supabase
      .from("content_drafts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("reference_profiles").select("*").eq("user_id", user.id),
    supabase.from("reference_links").select("*").eq("user_id", user.id),
    supabase.from("leader_documents").select("*").eq("user_id", user.id),
  ]);

  const profile = profileRes.data as LeaderProfile;
  const drafts = (draftsRes.data ?? []) as ContentDraft[];
  const refProfiles = (refProfilesRes.data ?? []) as ReferenceProfile[];
  const refLinks = (refLinksRes.data ?? []) as ReferenceLink[];
  const docs = (docsRes.data ?? []) as LeaderDocument[];

  const stats = [
    { label: "Conteúdos criados", value: drafts.length, hint: "últimos 5 abaixo" },
    { label: "Perfis de referência", value: refProfiles.length },
    { label: "Fontes acompanhadas", value: refLinks.length },
    { label: "Documentos de base", value: docs.length },
  ];

  return (
    <div className="container max-w-6xl px-6 py-10 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Olá, {profile.full_name.split(" ")[0]}.</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">
            Sobre o que <span className="gradient-text">você vai escrever hoje?</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary" size="lg">
            <Link href="/dashboard/create">
              <FilePenLine className="h-4 w-4" /> Criar conteúdo
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard/discover">
              <Compass className="h-4 w-4" /> Descobrir pautas
            </Link>
          </Button>
        </div>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-2 font-display text-3xl tracking-tight">{s.value}</p>
            {s.hint && (
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            )}
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl tracking-tight">Últimos conteúdos</h2>
            <Link
              href="/dashboard/library"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver biblioteca →
            </Link>
          </div>

          {drafts.length ? (
            <ul className="mt-4 divide-y divide-border">
              {drafts.map((d) => (
                <li key={d.id} className="py-4">
                  <Link
                    href={`/dashboard/content/${d.id}`}
                    className="group block"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={d.format === "linkedin_post" ? "brand" : "soft"}
                      >
                        {d.format === "linkedin_post" ? "Post" : "Artigo"}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{d.status}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDate(d.updated_at)}
                      </span>
                    </div>
                    <p className="mt-2 font-medium group-hover:text-brand-700">
                      {d.topic}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {truncate(d.draft_markdown ?? d.brief ?? "", 160)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-brand-500" />
              <p className="mt-3 text-sm font-medium">Você ainda não criou nada.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vá pra "Criar conteúdo" ou comece pela descoberta de pauta.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild variant="primary" size="sm">
                  <Link href="/dashboard/create">Criar agora</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/discover">Ver ideias</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-display text-xl tracking-tight">Seu posicionamento</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Resumo do que o motor sabe sobre você.
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <DLRow label="Cargo">{profile.role} · {profile.area}</DLRow>
              <DLRow label="Audiência">{truncate(profile.target_audience, 140)}</DLRow>
              <DLRow label="Objetivo">{truncate(profile.main_objective, 140)}</DLRow>
              <DLRow label="Tom">{profile.tone_traits.slice(0, 4).join(" · ") || "—"}</DLRow>
            </dl>
            <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
              <Link href="/dashboard/profile">
                Editar perfil <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-display text-xl tracking-tight">Referências</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {refProfiles.length} perfis · {refLinks.length} fontes · {docs.length} docs
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/dashboard/library">
                <Library className="h-4 w-4" /> Gerenciar
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DLRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
