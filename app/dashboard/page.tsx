import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Compass,
  FilePenLine,
  Hash,
  Library,
  Linkedin,
  Sparkles,
  Target,
} from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { formatCompact, formatDate, truncate } from "@/lib/utils";
import type {
  ContentDraft,
  LeaderProfile,
  ReferenceLink,
  ReferenceProfile,
  LeaderDocument,
} from "@/lib/db/types";
import { HOOK_STYLES, CONTENT_FORMATS } from "@/lib/style-presets";

export default async function DashboardHome() {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profileRes,
    draftsRes,
    refProfilesRes,
    refLinksRes,
    docsRes,
    metricsRes,
    linkedinRes,
  ] = await Promise.all([
    supabase.from("leader_profiles").select("*").eq("user_id", user.id).single(),
    supabase
      .from("content_drafts")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase.from("reference_profiles").select("id").eq("user_id", user.id),
    supabase.from("reference_links").select("id").eq("user_id", user.id),
    supabase.from("leader_documents").select("id").eq("user_id", user.id),
    supabase
      .from("post_metrics")
      .select("impressions, posted_at, content_draft_id")
      .eq("user_id", user.id)
      .gte("posted_at", since30)
      .order("posted_at", { ascending: true }),
    supabase
      .from("linkedin_connections")
      .select("followers_count, linkedin_url")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as LeaderProfile;
  const drafts = (draftsRes.data ?? []) as ContentDraft[];
  const refProfilesCount = (refProfilesRes.data ?? []).length;
  const refLinksCount = (refLinksRes.data ?? []).length;
  const docsCount = (docsRes.data ?? []).length;
  const metrics = metricsRes.data ?? [];
  const linkedin = linkedinRes.data;

  // ============================================================
  // CÁLCULOS DO COCKPIT
  // ============================================================

  // Daily impressions (últimos 30d) pra sparkline
  const days = 30;
  const today = new Date();
  const daily: number[] = new Array(days).fill(0);
  const dailyLabels: string[] = new Array(days).fill("");
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    dailyLabels[i] = `${d.getDate()}/${d.getMonth() + 1}`;
  }
  for (const m of metrics) {
    if (!m.posted_at) continue;
    const diff = Math.floor(
      (Date.now() - new Date(m.posted_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diff >= 0 && diff < days) {
      daily[days - 1 - diff] += (m.impressions as number) ?? 0;
    }
  }
  const totalImpressions30d = daily.reduce((a, b) => a + b, 0);
  const drafts30d = drafts.filter(
    (d) => new Date(d.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  // Cobertura de pilares — conta tags + temas
  const themesMap = new Map<string, number>();
  for (const t of profile.themes ?? []) themesMap.set(t, 0);
  for (const d of drafts30d) {
    for (const tag of d.tags ?? []) {
      themesMap.set(tag, (themesMap.get(tag) ?? 0) + 1);
    }
  }
  const pillarsData = Array.from(themesMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxPillarCount = Math.max(1, ...pillarsData.map((p) => p.count));

  // Formato mais publicado
  const formatCounts = drafts30d.reduce<Record<string, number>>((acc, d) => {
    acc[d.format] = (acc[d.format] ?? 0) + 1;
    return acc;
  }, {});
  const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0];

  // Hook style mais usado (do meta de cada draft)
  const hookCounts = drafts30d.reduce<Record<string, number>>((acc, d) => {
    const m = d.meta as Record<string, unknown> | null;
    const hk = m && typeof m.hook_style === "string" ? m.hook_style : null;
    if (hk) acc[hk] = (acc[hk] ?? 0) + 1;
    return acc;
  }, {});
  const topHook = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0];

  // ============================================================
  // CHECKLIST DE ONBOARDING
  // ============================================================
  const checklistItems = [
    {
      id: "profile_tone",
      label: "Configurar seu tom (Estilo)",
      href: "/dashboard/profile?tab=estilo#voz",
      done: (profile.tone_traits?.length ?? 0) >= 2,
    },
    {
      id: "profile_themes",
      label: "Marcar pelo menos 3 temas / pilares",
      href: "/dashboard/profile?tab=estilo#temas",
      done: (profile.themes?.length ?? 0) >= 3,
    },
    {
      id: "profile_objectives",
      label: "Definir objetivos de comunicação",
      href: "/dashboard/profile?tab=estilo#objetivos",
      done: (profile.objectives?.length ?? 0) >= 1,
    },
    {
      id: "ref_profile",
      label: "Adicionar 1 perfil de referência (Lara, Salim, etc.)",
      href: "/dashboard/library",
      done: refProfilesCount >= 1,
    },
    {
      id: "ref_link",
      label: "Adicionar 2 fontes (Substack, blog, portal)",
      href: "/dashboard/library",
      done: refLinksCount >= 2,
    },
    {
      id: "doc",
      label: "Subir 1 documento seu (case, manifesto, dados)",
      href: "/dashboard/library",
      done: docsCount >= 1,
    },
    {
      id: "linkedin",
      label: "Conectar LinkedIn pra puxar métricas",
      href: "/dashboard/analytics",
      done: !!linkedin?.linkedin_url,
    },
    {
      id: "first_draft",
      label: "Criar seu primeiro conteúdo",
      href: "/dashboard/create",
      done: drafts.length >= 1,
    },
    {
      id: "feedback",
      label: "Dar feedback (estrelas) em 1 conteúdo",
      href: drafts[0] ? `/dashboard/content/${drafts[0].id}` : "/dashboard/library",
      done: !!profile.learned_preferences,
    },
  ];

  // ============================================================
  // GREETING
  // ============================================================
  const hourSP = parseInt(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
    10
  );
  const greeting =
    hourSP < 5
      ? "Trabalhando até tarde,"
      : hourSP < 12
        ? "Bom dia,"
        : hourSP < 18
          ? "Boa tarde,"
          : "Boa noite,";

  return (
    <div className="container max-w-6xl px-6 py-10 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting} {profile.full_name.split(" ")[0]}.
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">
            Seu <span className="gradient-text">cockpit de autoridade</span>
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

      {/* Onboarding checklist — some sozinho quando 100% completo */}
      <section className="mt-8">
        <OnboardingChecklist items={checklistItems} />
      </section>

      {/* Hero stats */}
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Linkedin}
          label="Followers"
          value={
            linkedin?.followers_count != null
              ? formatCompact(linkedin.followers_count)
              : "—"
          }
          hint={linkedin?.linkedin_url ? "via LinkedIn" : "conecte o LinkedIn"}
        />
        <StatCard
          icon={BarChart3}
          label="Impressões 30d"
          value={formatCompact(totalImpressions30d)}
          hint={`${metrics.length} post${metrics.length === 1 ? "" : "s"} medido${metrics.length === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={FilePenLine}
          label="Conteúdos 30d"
          value={drafts30d.length.toString()}
          hint={drafts30d.length === 0 ? "comece agora" : "incluindo campanhas"}
        />
        <StatCard
          icon={Target}
          label="Pilares cobertos"
          value={`${pillarsData.filter((p) => p.count > 0).length}/${pillarsData.length}`}
          hint={pillarsData.length ? "dos seus temas" : "marque temas no Estilo"}
        />
      </section>

      {/* Gráfico de impressões + insights de uso */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-xl tracking-tight">
            Impressões — últimos 30 dias
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Soma diária. Vazio = nenhuma métrica importada ainda.
          </p>
          <div className="mt-4 text-foreground/70">
            <Sparkline data={daily} labels={dailyLabels} height={160} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-display text-xl tracking-tight">Seu jeito de escrever</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Padrões dos últimos 30 dias.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Formato mais usado">
              {topFormat
                ? `${CONTENT_FORMATS.find((f) => f.key === topFormat[0])?.label ?? topFormat[0]} (${topFormat[1]})`
                : "—"}
            </Row>
            <Row label="Hook mais frequente">
              {topHook
                ? HOOK_STYLES.find((h) => h.key === topHook[0])?.label.toLowerCase() ??
                  topHook[0]
                : "—"}
            </Row>
            <Row label="Tom registrado">
              {profile.tone_traits.slice(0, 4).join(" · ") || "—"}
            </Row>
            <Row label="Aprendizado acumulado">
              {profile.learned_preferences
                ? "Sim — usado em toda geração"
                : "Sem feedback ainda"}
            </Row>
          </dl>
        </div>
      </section>

      {/* Cobertura de pilares */}
      {pillarsData.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl tracking-tight">
                Cobertura de pilares
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Quanto cada tema seu apareceu nos últimos 30 dias. Pilar com 0 =
                considerar publicar.
              </p>
            </div>
            <Hash className="h-4 w-4 text-brand-600" />
          </div>
          <ul className="mt-4 space-y-2">
            {pillarsData.map((p) => {
              const pct = (p.count / maxPillarCount) * 100;
              const empty = p.count === 0;
              return (
                <li key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={
                        empty ? "text-muted-foreground" : "font-medium"
                      }
                    >
                      {p.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.count}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        empty
                          ? "bg-muted"
                          : "bg-gradient-to-r from-brand-400 to-brand-700"
                      }`}
                      style={{ width: empty ? "8%" : `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Últimos conteúdos */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
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
              {drafts.slice(0, 5).map((d) => (
                <li key={d.id} className="py-4">
                  <Link href={`/dashboard/content/${d.id}`} className="group block">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={d.format === "linkedin_post" ? "brand" : "soft"}
                      >
                        {d.format === "linkedin_post" ? "Post" : "Artigo"}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {d.status}
                      </Badge>
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
            <h3 className="font-display text-xl tracking-tight">Referências</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {refProfilesCount} perfis · {refLinksCount} fontes · {docsCount} docs
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/dashboard/library">
                <Library className="h-4 w-4" /> Gerenciar
              </Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-display text-xl tracking-tight">Ajustar perfil</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tom, hooks, temas, audiência — qualquer hora.
            </p>
            <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
              <Link href="/dashboard/profile?tab=estilo">
                Abrir estilo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-brand-600" />
        {label}
      </div>
      <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
