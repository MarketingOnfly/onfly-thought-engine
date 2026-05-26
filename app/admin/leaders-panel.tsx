"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Hash,
  Linkedin,
  Megaphone,
  RefreshCw,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCompact } from "@/components/charts";
import { initials, truncate } from "@/lib/utils";
import type { LeaderOverview } from "@/lib/db/types";

export default function LeadersPanel() {
  const [leaders, setLeaders] = useState<LeaderOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leaders");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro");
        return;
      }
      setLeaders(data.leaders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return leaders;
    const q = search.toLowerCase();
    return leaders.filter(
      (l) =>
        l.full_name?.toLowerCase().includes(q) ||
        l.role?.toLowerCase().includes(q) ||
        l.area?.toLowerCase().includes(q) ||
        l.topics_covered?.some((t) => t.toLowerCase().includes(q))
    );
  }, [leaders, search]);

  const totals = useMemo(() => {
    const active = leaders.filter((l) => l.onboarding_completed);
    const totalFollowers = active.reduce(
      (sum, l) => sum + (l.followers_count ?? 0),
      0
    );
    const totalImpressions = active.reduce((sum, l) => sum + l.total_impressions, 0);
    const totalDrafts = active.reduce((sum, l) => sum + l.drafts_count, 0);
    return {
      active: active.length,
      totalFollowers,
      totalImpressions,
      totalDrafts,
    };
  }, [leaders]);

  const allTopics = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leaders) {
      for (const t of l.topics_covered ?? []) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [leaders]);

  return (
    <div className="mt-6 space-y-6">
      {/* Top totals */}
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          icon={Users}
          label="Líderes ativos"
          value={totals.active.toString()}
          hint={`${leaders.length - totals.active} em onboarding`}
        />
        <Stat
          icon={Linkedin}
          label="Alcance estimado"
          value={formatCompact(totals.totalFollowers)}
          hint="soma de followers"
        />
        <Stat
          icon={RefreshCw}
          label="Impressões medidas"
          value={formatCompact(totals.totalImpressions)}
          hint="todos os posts importados"
        />
        <Stat
          icon={Megaphone}
          label="Drafts criados"
          value={totals.totalDrafts.toString()}
          hint="incluindo campanhas"
        />
      </div>

      {/* Topics coverage */}
      {allTopics.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-xl tracking-tight">Cobertura de temas</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tópicos abordados pelo time (com quantos líderes cobrem cada um).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {allTopics.map((t) => (
              <span
                key={t.tag}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs"
              >
                <span>{t.tag}</span>
                <span className="font-mono text-[10px] text-brand-700">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search + list */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-tight">Líderes cadastrados</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {leaders.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cargo, área ou tema…"
              className="w-72"
            />
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {filtered.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
            {loading ? "Carregando…" : "Nenhum líder."}
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {filtered.map((l) => (
              <li key={l.user_id}>
                <Link
                  href={`/admin/leaders/${l.user_id}`}
                  className="group block rounded-2xl border border-border bg-background p-4 transition-all hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-4">
                    {l.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.avatar_url}
                        alt={l.full_name}
                        className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-medium text-white">
                        {initials(l.full_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium group-hover:text-brand-700">
                          {l.full_name}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {l.role}
                        </Badge>
                        <Badge variant="soft" className="text-[10px]">
                          {l.area}
                        </Badge>
                        {l.onboarding_completed ? (
                          <Badge variant="brand" className="text-[10px]">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            em onboarding
                          </Badge>
                        )}
                      </div>
                      {l.bio ? (
                        <p className="mt-1 text-xs text-muted-foreground">{truncate(l.bio, 140)}</p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {truncate(l.target_audience ?? "", 140)}
                        </p>
                      )}
                      {l.topics_covered.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {l.topics_covered.slice(0, 8).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground"
                            >
                              {t}
                            </span>
                          ))}
                          {l.topics_covered.length > 8 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{l.topics_covered.length - 8}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="grid grid-cols-3 gap-3 text-right md:gap-5">
                        <Mini label="Followers" value={l.followers_count} />
                        <Mini label="Impressões" value={l.total_impressions} />
                        <Mini label="Drafts" value={l.drafts_count} />
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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

function Mini({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-medium">
        {value === null || value === undefined ? "—" : formatCompact(value)}
      </p>
    </div>
  );
}
