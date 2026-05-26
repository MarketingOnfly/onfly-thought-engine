import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Linkedin,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getServerUser,
} from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { Badge } from "@/components/ui/badge";
import { formatCompact } from "@/components/charts";
import { initials, formatDate, truncate } from "@/lib/utils";
import {
  AUDIENCE_SEGMENTS,
  CONTENT_FORMATS,
  CONTENT_TYPES,
  HOOK_STYLES,
  OBJECTIVES,
  TONE_AVOID,
  TONE_TRAITS,
} from "@/lib/style-presets";
import type { ContentDraft, LeaderProfile } from "@/lib/db/types";

function labelize<T extends { key: string; label: string }>(
  items: readonly T[],
  keys: string[] | null | undefined
): string[] {
  if (!keys?.length) return [];
  return keys.map((k) => items.find((i) => i.key === k)?.label ?? k);
}

export default async function LeaderDetailPage({
  params,
}: {
  params: Promise<{ user_id: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!(await isAdmin(user))) redirect("/dashboard");

  const { user_id } = await params;
  // Tenta service_role pra ignorar RLS — admin pode ler perfil/drafts de
  // qualquer líder. Se a env não estiver setada, cai pro client normal
  // (depende das policies da migration 011 + auth do user).
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    supabase = await createSupabaseServerClient();
  }

  const [profileRes, linkedinRes, draftsRes, campaignsRes, metricsRes] =
    await Promise.all([
      supabase
        .from("leader_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase
        .from("linkedin_connections")
        .select("followers_count, linkedin_url, last_synced_at, profile_data")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase
        .from("content_drafts")
        .select("id, format, topic, status, created_at, tags, scheduled_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("campaign_drafts")
        .select("id, status, created_at, campaign:campaigns(id, name, theme), draft_id")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("post_metrics")
        .select("impressions, likes, comments, reposts, content_draft_id, posted_at")
        .eq("user_id", user_id)
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(20),
    ]);

  if (!profileRes.data) notFound();
  const profile = profileRes.data as LeaderProfile;
  const linkedin = linkedinRes.data;
  const drafts = (draftsRes.data ?? []) as unknown as Pick<
    ContentDraft,
    "id" | "format" | "topic" | "status" | "created_at" | "tags" | "scheduled_at"
  >[];
  const campaigns = (campaignsRes.data ?? []) as unknown as {
    id: string;
    status: string;
    created_at: string;
    campaign: { id: string; name: string; theme: string } | null;
    draft_id: string | null;
  }[];
  const metrics = (metricsRes.data ?? []) as {
    impressions: number;
    likes: number;
    comments: number;
    reposts: number;
    content_draft_id: string | null;
    posted_at: string | null;
  }[];

  const totalImpressions = metrics.reduce((s, m) => s + m.impressions, 0);
  const totalEng = metrics.reduce(
    (s, m) => s + m.likes + m.comments + m.reposts,
    0
  );
  const avgEng =
    totalImpressions > 0 ? ((totalEng / totalImpressions) * 100).toFixed(2) : "0.00";

  return (
    <div className="container max-w-6xl px-6 py-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Painel admin
      </Link>

      {/* Header */}
      <header className="mt-4 flex flex-wrap items-start gap-5">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.full_name}
            className="h-20 w-20 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-medium text-white">
            {initials(profile.full_name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl tracking-tight md:text-4xl">
              {profile.full_name}
            </h1>
            {profile.onboarding_completed ? (
              <Badge variant="brand">
                <CheckCircle2 className="mr-1 h-3 w-3" /> ativo
              </Badge>
            ) : (
              <Badge variant="outline">em onboarding</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.role} · {profile.area}
          </p>
          {profile.bio && (
            <p className="mt-3 max-w-2xl text-sm text-foreground/80">{profile.bio}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {linkedin?.linkedin_url && (
              <a
                href={linkedin.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Linkedin className="h-3 w-3" /> LinkedIn{" "}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {profile.twitter_url && (
              <a
                href={profile.twitter_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                X / Twitter <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                Site <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            <span className="text-muted-foreground">
              Cadastrado em {formatDate(profile.created_at)}
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat
          icon={Users}
          label="Followers"
          value={linkedin?.followers_count != null ? formatCompact(linkedin.followers_count) : "—"}
          hint={
            linkedin?.last_synced_at
              ? `sync ${formatDate(linkedin.last_synced_at)}`
              : "sem LinkedIn conectado"
          }
        />
        <Stat
          icon={TrendingUp}
          label="Impressões"
          value={formatCompact(totalImpressions)}
          hint={`${metrics.length} post${metrics.length === 1 ? "" : "s"} medidos`}
        />
        <Stat
          icon={FileText}
          label="Drafts criados"
          value={drafts.length.toString()}
          hint="últimos 10"
        />
        <Stat
          icon={Megaphone}
          label="Eng. médio"
          value={`${avgEng}%`}
          hint={`${formatCompact(totalEng)} ações`}
        />
      </div>

      {/* Positioning */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Posicionamento</h2>
        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <Row label="Audiência (livre)">{profile.target_audience || "—"}</Row>
          <Row label="Audiência (segmentos)">
            <ChipList items={labelize(AUDIENCE_SEGMENTS, profile.audience_segments)} />
          </Row>
          <Row label="Objetivos">
            <ChipList items={labelize(OBJECTIVES, profile.objectives)} />
          </Row>
          <Row label="Formatos">
            <ChipList items={labelize(CONTENT_FORMATS, profile.preferred_formats)} />
          </Row>
          <Row label="Tipos de conteúdo">
            <ChipList items={labelize(CONTENT_TYPES, profile.content_types)} />
          </Row>
          <Row label="Hooks preferidos">
            <ChipList items={labelize(HOOK_STYLES, profile.preferred_hook_styles)} />
          </Row>
          <Row label="Tom — traços">
            <ChipList items={labelize(TONE_TRAITS, profile.tone_traits)} />
          </Row>
          <Row label="Tom — nunca">
            <ChipList items={labelize(TONE_AVOID, profile.tone_avoid)} variant="danger" />
          </Row>
          <Row label="Pilares / temas">
            <ChipList items={profile.themes} />
          </Row>
          {profile.tone_examples && (
            <Row label="Exemplos de tom" full>
              <p className="whitespace-pre-line text-sm">{profile.tone_examples}</p>
            </Row>
          )}
          {profile.custom_briefing && (
            <Row label="Briefing livre" full>
              <p className="whitespace-pre-line text-sm">{profile.custom_briefing}</p>
            </Row>
          )}
        </dl>
      </section>

      {/* Recent drafts */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Conteúdos recentes</h2>
        {drafts.length ? (
          <ul className="mt-4 divide-y divide-border">
            {drafts.map((d) => (
              <li key={d.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={d.format === "linkedin_post" ? "brand" : "soft"}>
                    {d.format === "linkedin_post" ? "Post" : "Artigo"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {d.status}
                  </Badge>
                  {d.scheduled_at && (
                    <span className="text-xs text-muted-foreground">
                      agendado {formatDate(d.scheduled_at)}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(d.created_at)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{truncate(d.topic, 120)}</p>
                {(d.tags ?? []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(d.tags ?? []).slice(0, 6).map((t: string) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Sem conteúdos ainda.
          </p>
        )}
      </section>

      {/* Campaigns received */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Campanhas recebidas</h2>
        {campaigns.length ? (
          <ul className="mt-4 space-y-2">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3"
              >
                <Badge variant="brand" className="capitalize">
                  {c.status}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.campaign?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {truncate(c.campaign?.theme ?? "", 100)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(c.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma campanha recebida ainda.</p>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
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

function Row({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function ChipList({
  items,
  variant = "default",
}: {
  items: string[];
  variant?: "default" | "danger";
}) {
  if (!items.length) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i}
          className={
            variant === "danger"
              ? "rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-0.5 text-xs text-destructive"
              : "rounded-full bg-secondary px-2.5 py-0.5 text-xs text-foreground"
          }
        >
          {i}
        </span>
      ))}
    </div>
  );
}
