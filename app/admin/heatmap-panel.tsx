"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DraftRow {
  user_id: string;
  user_name: string;
  created_at: string;
}

const WEEKS_BACK = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function HeatmapPanel() {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/drafts-heatmap");
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { weeks, leaders, byCell, maxCount } = useMemo(() => {
    // Bucket por (week_start_iso, user_id) = count
    const now = new Date();
    // Domingo da semana atual
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const dow = todayStart.getDay();
    const sunday = new Date(todayStart.getTime() - dow * DAY_MS);

    const weekKeys: string[] = [];
    for (let i = WEEKS_BACK - 1; i >= 0; i--) {
      const d = new Date(sunday.getTime() - i * 7 * DAY_MS);
      weekKeys.push(d.toISOString().slice(0, 10));
    }

    const leaderMap = new Map<string, string>();
    const cellMap = new Map<string, number>(); // key: weekKey|userId
    let max = 0;
    for (const r of rows) {
      leaderMap.set(r.user_id, r.user_name);
      const date = new Date(r.created_at);
      const ddow = date.getDay();
      const wkStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() - ddow
      );
      const wkKey = wkStart.toISOString().slice(0, 10);
      if (!weekKeys.includes(wkKey)) continue;
      const cellKey = `${wkKey}|${r.user_id}`;
      const c = (cellMap.get(cellKey) ?? 0) + 1;
      cellMap.set(cellKey, c);
      if (c > max) max = c;
    }

    const leaderList = Array.from(leaderMap.entries())
      .map(([user_id, user_name]) => ({ user_id, user_name }))
      .sort((a, b) => a.user_name.localeCompare(b.user_name));

    return { weeks: weekKeys, leaders: leaderList, byCell: cellMap, maxCount: max };
  }, [rows]);

  function shadeClass(count: number): string {
    if (count === 0) return "bg-secondary/40";
    const pct = count / Math.max(1, maxCount);
    if (pct >= 0.75) return "bg-brand-700";
    if (pct >= 0.5) return "bg-brand-500";
    if (pct >= 0.25) return "bg-brand-400";
    return "bg-brand-300";
  }

  function shortLabel(weekKey: string) {
    const d = new Date(weekKey);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-xl tracking-tight">
            Heatmap editorial
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Últimas {WEEKS_BACK} semanas. Cada quadrado é um líder × uma semana —
          intensidade pela quantidade de drafts criados.
        </p>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : leaders.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
            Nenhum draft no período. Quando o time começar a publicar, o calor
            aparece aqui.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-44 bg-card pr-3 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Líder
                  </th>
                  {weeks.map((w) => (
                    <th
                      key={w}
                      className="w-6 px-0.5 text-[9px] font-normal text-muted-foreground"
                      title={`Semana de ${w}`}
                    >
                      {shortLabel(w)}
                    </th>
                  ))}
                  <th className="pl-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((l) => {
                  let totalRow = 0;
                  return (
                    <tr key={l.user_id} className="group">
                      <td className="sticky left-0 z-10 bg-card py-1 pr-3 text-xs">
                        <span className="truncate">{l.user_name}</span>
                      </td>
                      {weeks.map((w) => {
                        const c = byCell.get(`${w}|${l.user_id}`) ?? 0;
                        totalRow += c;
                        return (
                          <td key={`${w}-${l.user_id}`} className="p-0.5">
                            <div
                              className={cn(
                                "h-5 w-5 rounded-sm transition-transform group-hover:opacity-90",
                                shadeClass(c)
                              )}
                              title={`${l.user_name} · ${w}: ${c} draft${c === 1 ? "" : "s"}`}
                            />
                          </td>
                        );
                      })}
                      <td className="pl-3 font-mono text-xs">
                        {totalRow > 0 ? (
                          <Badge variant="brand" className="text-[10px]">
                            {totalRow}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Legenda */}
            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>menos</span>
              {["bg-secondary/40", "bg-brand-300", "bg-brand-400", "bg-brand-500", "bg-brand-700"].map(
                (cls, i) => (
                  <span key={i} className={cn("h-3 w-3 rounded-sm", cls)} />
                )
              )}
              <span>mais</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
