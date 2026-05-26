"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ChevronRight,
  ExternalLink,
  Loader2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { initials, formatCompact } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { LeaderOverview } from "@/lib/db/types";

type SortKey =
  | "name"
  | "drafts"
  | "campaigns"
  | "impressions"
  | "followers"
  | "topics";

export default function ComparePanel() {
  const [leaders, setLeaders] = useState<LeaderOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("impressions");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/leaders");
      if (res.ok) {
        const data = await res.json();
        setLeaders(data.leaders ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const sorted = useMemo(() => {
    const active = leaders.filter((l) => l.onboarding_completed);
    return [...active].sort((a, b) => {
      const dir = direction === "asc" ? 1 : -1;
      switch (sort) {
        case "name":
          return a.full_name.localeCompare(b.full_name) * dir;
        case "drafts":
          return (a.drafts_count - b.drafts_count) * dir;
        case "campaigns":
          return (a.campaigns_received - b.campaigns_received) * dir;
        case "impressions":
          return (a.total_impressions - b.total_impressions) * dir;
        case "followers":
          return ((a.followers_count ?? 0) - (b.followers_count ?? 0)) * dir;
        case "topics":
          return (
            ((a.topics_covered?.length ?? 0) - (b.topics_covered?.length ?? 0)) *
            dir
          );
      }
    });
  }, [leaders, sort, direction]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setDirection(key === "name" ? "asc" : "desc");
    }
  }

  // Identifica outliers — top 1 e bottom 1 em impressões
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-xl tracking-tight">
            Comparativo do time
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sorted.length} líder{sorted.length === 1 ? "" : "es"} ativo
          {sorted.length === 1 ? "" : "s"}. Clica em qualquer coluna pra
          ordenar.
        </p>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : sorted.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
            Nenhum líder ativo ainda.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <SortHead
                    label="Líder"
                    active={sort === "name"}
                    direction={direction}
                    onClick={() => toggleSort("name")}
                  />
                  <SortHead
                    label="Drafts"
                    active={sort === "drafts"}
                    direction={direction}
                    onClick={() => toggleSort("drafts")}
                    align="right"
                  />
                  <SortHead
                    label="Campanhas"
                    active={sort === "campaigns"}
                    direction={direction}
                    onClick={() => toggleSort("campaigns")}
                    align="right"
                  />
                  <SortHead
                    label="Impressões"
                    active={sort === "impressions"}
                    direction={direction}
                    onClick={() => toggleSort("impressions")}
                    align="right"
                  />
                  <SortHead
                    label="Followers"
                    active={sort === "followers"}
                    direction={direction}
                    onClick={() => toggleSort("followers")}
                    align="right"
                  />
                  <SortHead
                    label="Pilares"
                    active={sort === "topics"}
                    direction={direction}
                    onClick={() => toggleSort("topics")}
                    align="right"
                  />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((l) => {
                  const isTop = l.user_id === top?.user_id && top.total_impressions > 0;
                  const isBottom =
                    sorted.length > 1 &&
                    l.user_id === bottom?.user_id &&
                    bottom.total_impressions < (top?.total_impressions ?? 0);
                  return (
                    <tr
                      key={l.user_id}
                      className="group border-b border-border/60 transition-colors hover:bg-secondary/30"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          href={`/admin/leaders/${l.user_id}`}
                          className="flex items-center gap-2"
                        >
                          {l.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={l.avatar_url}
                              alt={l.full_name}
                              className="h-8 w-8 rounded-full border border-border object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-medium text-white">
                              {initials(l.full_name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium group-hover:text-brand-700">
                              {l.full_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {l.role} · {l.area}
                            </p>
                          </div>
                          {isTop && (
                            <Badge variant="brand" className="ml-1 text-[9px]">
                              top
                            </Badge>
                          )}
                          {isBottom && (
                            <Badge
                              variant="outline"
                              className="ml-1 border-amber-300 text-[9px] text-amber-700"
                            >
                              atrás
                            </Badge>
                          )}
                        </Link>
                      </td>
                      <NumCell value={l.drafts_count} />
                      <NumCell value={l.campaigns_received} />
                      <NumCell value={l.total_impressions} />
                      <NumCell value={l.followers_count} />
                      <NumCell value={l.topics_covered?.length ?? 0} />
                      <td className="py-3 pl-2">
                        <Link
                          href={`/admin/leaders/${l.user_id}`}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SortHead({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "py-2 font-medium cursor-pointer select-none",
        align === "right" ? "text-right" : "text-left"
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1",
          active && "text-brand-700"
        )}
      >
        {label}
        {active && (
          <ArrowDownUp
            className={cn(
              "h-2.5 w-2.5 transition-transform",
              direction === "asc" && "rotate-180"
            )}
          />
        )}
      </span>
    </th>
  );
}

function NumCell({ value }: { value: number | null | undefined }) {
  return (
    <td className="py-3 text-right font-mono text-xs">
      {value === null || value === undefined ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        formatCompact(value)
      )}
    </td>
  );
}
