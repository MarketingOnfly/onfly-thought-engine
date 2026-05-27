"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Linkedin,
  Loader2,
  RefreshCw,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarRanking, Sparkline, formatCompact } from "@/components/charts";
import type { LinkedInConnection, PostMetric } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/confirm";

type MetricRow = PostMetric & {
  content_draft?: { id: string; topic: string; tags: string[]; format: string } | null;
};

const RANGE_DAYS = 30;

export default function AnalyticsView({
  connection,
  metrics: initialMetrics,
  flash,
  linkedinConfig,
}: {
  connection: LinkedInConnection | null;
  metrics: MetricRow[];
  flash: { connected: boolean; error: string | null };
  linkedinConfig: { configured: boolean; missing: string[] };
}) {
  const [conn, setConn] = useState(connection);
  const [metrics, setMetrics] = useState<MetricRow[]>(initialMetrics);
  const [syncing, setSyncing] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [error, setError] = useState<string | null>(flash.error);
  const [info, setInfo] = useState<string | null>(
    flash.connected ? "LinkedIn conectado." : null
  );
  const csvInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const stats = useMemo(() => computeStats(metrics, RANGE_DAYS), [metrics]);
  const ranking = useMemo(() => {
    return [...metrics]
      .filter((m) => m.impressions > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 8)
      .map((m) => {
        // título: rascunho linkado > título do export > URL > placeholder
        const rawLabel =
          m.content_draft?.topic ??
          m.title ??
          m.linkedin_post_url ??
          "Post sem título";
        const label =
          rawLabel.length > 90 ? `${rawLabel.slice(0, 90)}…` : rawLabel;
        return {
          label,
          value: m.impressions,
          subtitle: `${formatCompact(m.likes)} likes · ${formatCompact(
            m.comments
          )} comentários · ${formatCompact(m.reposts)} reposts`,
          href: m.content_draft
            ? `/dashboard/content/${m.content_draft.id}`
            : m.linkedin_post_url ?? undefined,
        };
      });
  }, [metrics]);

  const topicInsights = useMemo(() => computeTopicInsights(metrics), [metrics]);

  async function sync() {
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/linkedin/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao sincronizar");
        return;
      }
      setConn(data.connection);
      setInfo(
        data.note
          ? "Perfil atualizado. " + data.note
          : "Sincronizado com LinkedIn."
      );
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    const ok = await confirm({
      title: "Desconectar o LinkedIn?",
      description:
        "Você para de receber métricas automáticas. Dá pra reconectar a qualquer momento.",
      confirmText: "Desconectar",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch("/api/linkedin/disconnect", { method: "POST" });
    if (res.ok) {
      setConn(null);
      setInfo("LinkedIn desconectado.");
    }
  }

  async function handleCsv(file: File) {
    setCsvBusy(true);
    setError(null);
    setInfo(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/metrics/csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao importar");
        return;
      }
      setInfo(`Importadas ${data.inserted ?? 0} linhas.`);
      // refresh list
      await reloadMetrics();
    } finally {
      setCsvBusy(false);
    }
  }

  async function reloadMetrics() {
    const res = await fetch("/api/metrics");
    if (res.ok) {
      const data = await res.json();
      setMetrics(data.items ?? []);
    }
  }

  async function deleteMetric(id: string) {
    const ok = await confirm({
      title: "Apagar este registro de métrica?",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/metrics/${id}`, { method: "DELETE" });
    if (res.ok) setMetrics(metrics.filter((m) => m.id !== id));
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Flash */}
      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="flex items-start gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {/* LinkedIn não configurado — banner explicativo pro admin */}
      {!linkedinConfig.configured && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div className="space-y-2">
              <p className="font-semibold">
                LinkedIn ainda não está configurado neste deploy
              </p>
              <p>
                Quem é admin precisa adicionar essas variáveis no Vercel
                (Project Settings → Environment Variables):
              </p>
              <ul className="list-disc space-y-0.5 pl-5 font-mono text-xs">
                {linkedinConfig.missing.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
              <p className="text-xs">
                Depois de salvar, faça um novo deploy (ou redeploy o último)
                — as envs só ficam ativas no próximo build.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn connection */}
      <LinkedInCard
        conn={conn}
        syncing={syncing}
        onSync={sync}
        onDisconnect={disconnect}
        disabled={!linkedinConfig.configured}
      />

      {/* Stats hero */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Seguidores"
          value={conn?.followers_count != null ? formatCompact(conn.followers_count) : "—"}
          hint={conn ? "via LinkedIn" : "conecte o LinkedIn"}
        />
        <StatCard
          label="Impressões (30d)"
          value={formatCompact(stats.totalImpressions)}
          hint={`${stats.postCount} post${stats.postCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Engajamento (30d)"
          value={`${(stats.avgEngagement * 100).toFixed(2)}%`}
          hint={`${formatCompact(stats.totalEngagements)} ações`}
        />
        <StatCard
          label="Melhor post"
          value={formatCompact(stats.bestPostImpressions)}
          hint={stats.bestPostTitle ? truncate(stats.bestPostTitle, 36) : "sem dados"}
        />
      </div>

      {/* Sparkline */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl tracking-tight">Impressões nos últimos 30 dias</h2>
            <p className="text-xs text-muted-foreground">
              {formatCompact(stats.totalImpressions)} no período · pico de{" "}
              {formatCompact(stats.peakImpressions)} num dia
            </p>
          </div>
        </div>
        <div className="mt-4 text-foreground/70">
          <Sparkline
            data={stats.daily}
            labels={stats.dailyLabels}
            height={200}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Ranking */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl tracking-tight">Ranking de posts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Por impressões. Click pra abrir o draft.
          </p>
          <div className="mt-4">
            {ranking.length ? (
              <BarRanking items={ranking} />
            ) : (
              <EmptyHint text="Sem métricas ainda. Sincroniza, importa CSV ou adiciona manualmente." />
            )}
          </div>
        </div>

        {/* Topic insights */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl tracking-tight">Insights por tema</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Agregado pelas tags dos seus drafts.
          </p>
          <div className="mt-4">
            {topicInsights.length ? (
              <ul className="space-y-3">
                {topicInsights.map((t) => (
                  <li key={t.tag} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="brand">{t.tag}</Badge>
                      <span className="font-mono text-xs text-brand-700">
                        {formatCompact(t.totalImpressions)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.posts} post{t.posts === 1 ? "" : "s"} · engajamento médio{" "}
                      {(t.avgEngagement * 100).toFixed(1)}%
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text="Tags ainda não foram tagueadas nos seus drafts. Quando o motor taggear, agregamos aqui." />
            )}
          </div>
        </div>
      </div>

      {/* Manual + CSV import */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-tight">Importar métricas</h2>
            <p className="text-xs text-muted-foreground">
              Enquanto a API completa do LinkedIn não libera, baixe o relatório
              do{" "}
              <a
                href="https://www.linkedin.com/analytics/creator/content/"
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 underline-offset-2 hover:underline"
              >
                LinkedIn Creator Analytics
              </a>{" "}
              (XLSX ou CSV) ou cole os números à mão pra um post.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCsv(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => csvInputRef.current?.click()}
              disabled={csvBusy}
            >
              {csvBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…
                </>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" /> Importar XLSX / CSV
                </>
              )}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowManual((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar manualmente
            </Button>
          </div>
        </div>

        {showManual && (
          <ManualEntry
            onSaved={(row) => {
              setMetrics([row, ...metrics]);
              setShowManual(false);
              setInfo("Métrica salva.");
            }}
            onCancel={() => setShowManual(false)}
          />
        )}

        {/* Recent metrics list */}
        {metrics.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Últimas medições ({metrics.length})
            </p>
            <ul className="mt-3 space-y-2">
              {metrics.slice(0, 10).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {m.source}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {m.content_draft?.topic ?? m.linkedin_post_url ?? "Post sem título"}
                  </span>
                  <span className="font-mono text-xs">
                    {formatCompact(m.impressions)} imp
                  </span>
                  {m.linkedin_post_url && (
                    <a
                      href={m.linkedin_post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteMetric(m.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function LinkedInCard({
  conn,
  syncing,
  onSync,
  onDisconnect,
  disabled = false,
}: {
  conn: LinkedInConnection | null;
  syncing: boolean;
  onSync: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  disabled?: boolean;
}) {
  const profileName =
    (conn?.profile_data as { name?: string } | null)?.name ?? null;
  const profilePicture =
    (conn?.profile_data as { picture?: string } | null)?.picture ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {conn ? (
        <div className="flex flex-wrap items-center gap-4">
          {profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profilePicture}
              alt={profileName ?? ""}
              className="h-14 w-14 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Linkedin className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{profileName ?? "LinkedIn conectado"}</p>
              <Badge variant="brand" className="text-[10px]">conectado</Badge>
            </div>
            {conn.linkedin_url && (
              <a
                href={conn.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {conn.linkedin_url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {conn.last_synced_at ? `Última sync ${formatDate(conn.last_synced_at)}` : "—"}
              {conn.marketing_api_status !== "approved" && (
                <>
                  {" · "}
                  <span className="text-amber-700">
                    métricas de posts pendem Marketing API
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDisconnect}>
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Linkedin className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Conecta seu LinkedIn</p>
            <p className="text-xs text-muted-foreground">
              Sincroniza nome, foto, link e seguidores. Métricas detalhadas precisam da
              app Onfly aprovada em Marketing Developer Platform (LinkedIn).
            </p>
          </div>
          {disabled ? (
            <Button variant="primary" size="sm" disabled title="LinkedIn não configurado no servidor">
              <Linkedin className="h-3.5 w-3.5" /> Conectar LinkedIn
            </Button>
          ) : (
            <Button asChild variant="primary" size="sm">
              <a href="/api/linkedin/auth">
                <Linkedin className="h-3.5 w-3.5" /> Conectar LinkedIn
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-5 text-xs text-muted-foreground">
      <Sparkles className="h-4 w-4 text-brand-500" />
      {text}
    </div>
  );
}

function ManualEntry({
  onSaved,
  onCancel,
}: {
  onSaved: (row: MetricRow) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    linkedin_post_url: "",
    impressions: "",
    likes: "",
    comments: "",
    reposts: "",
    clicks: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          linkedin_post_url: form.linkedin_post_url.trim() || null,
          impressions: Number(form.impressions || 0),
          likes: Number(form.likes || 0),
          comments: Number(form.comments || 0),
          reposts: Number(form.reposts || 0),
          clicks: Number(form.clicks || 0),
          source: "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Erro");
        return;
      }
      onSaved(data.item);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-6">
          <Label className="text-xs">URL do post (opcional)</Label>
          <Input
            value={form.linkedin_post_url}
            onChange={(e) => setForm({ ...form, linkedin_post_url: e.target.value })}
            placeholder="https://www.linkedin.com/posts/..."
            className="mt-1"
          />
        </div>
        <NumberField
          label="Impressões"
          value={form.impressions}
          onChange={(v) => setForm({ ...form, impressions: v })}
        />
        <NumberField
          label="Likes"
          value={form.likes}
          onChange={(v) => setForm({ ...form, likes: v })}
        />
        <NumberField
          label="Comentários"
          value={form.comments}
          onChange={(v) => setForm({ ...form, comments: v })}
        />
        <NumberField
          label="Reposts"
          value={form.reposts}
          onChange={(v) => setForm({ ...form, reposts: v })}
        />
        <NumberField
          label="Clicks"
          value={form.clicks}
          onChange={(v) => setForm({ ...form, clicks: v })}
        />
      </div>
      {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" onClick={save} disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
        min="0"
      />
    </div>
  );
}

// ============================================================
// helpers
// ============================================================

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function computeStats(metrics: MetricRow[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = metrics.filter((m) =>
    m.posted_at ? new Date(m.posted_at).getTime() >= cutoff : true
  );
  const totalImpressions = recent.reduce((sum, m) => sum + m.impressions, 0);
  const totalEngagements = recent.reduce(
    (sum, m) => sum + m.likes + m.comments + m.reposts + m.clicks,
    0
  );
  const avgEngagement =
    totalImpressions > 0 ? totalEngagements / totalImpressions : 0;

  const best = recent.reduce<MetricRow | null>(
    (b, m) => (!b || m.impressions > b.impressions ? m : b),
    null
  );

  // daily array of impressions for sparkline + matching DD/MM labels
  const daily: number[] = new Array(days).fill(0);
  const dailyLabels: string[] = new Array(days).fill("");
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    dailyLabels[i] = `${d.getDate()}/${d.getMonth() + 1}`;
  }
  for (const m of recent) {
    if (!m.posted_at) continue;
    const diff = Math.floor(
      (Date.now() - new Date(m.posted_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diff >= 0 && diff < days) {
      daily[days - 1 - diff] += m.impressions;
    }
  }
  const peakImpressions = Math.max(0, ...daily);

  return {
    totalImpressions,
    totalEngagements,
    avgEngagement,
    postCount: recent.length,
    daily,
    dailyLabels,
    peakImpressions,
    bestPostImpressions: best?.impressions ?? 0,
    bestPostTitle:
      best?.content_draft?.topic ?? best?.title ?? best?.linkedin_post_url ?? null,
  };
}

function computeTopicInsights(metrics: MetricRow[]) {
  const map = new Map<
    string,
    { totalImpressions: number; totalEngagement: number; posts: number }
  >();
  for (const m of metrics) {
    const tags = m.content_draft?.tags ?? [];
    if (!tags.length) continue;
    for (const t of tags) {
      const cur = map.get(t) ?? {
        totalImpressions: 0,
        totalEngagement: 0,
        posts: 0,
      };
      cur.totalImpressions += m.impressions;
      cur.totalEngagement += m.likes + m.comments + m.reposts + m.clicks;
      cur.posts += 1;
      map.set(t, cur);
    }
  }
  return Array.from(map.entries())
    .map(([tag, v]) => ({
      tag,
      totalImpressions: v.totalImpressions,
      posts: v.posts,
      avgEngagement:
        v.totalImpressions > 0 ? v.totalEngagement / v.totalImpressions : 0,
    }))
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, 8);
}
