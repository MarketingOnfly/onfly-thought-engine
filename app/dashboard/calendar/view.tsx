"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, truncate } from "@/lib/utils";
import type { ContentDraft } from "@/lib/db/types";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function CalendarView({
  year,
  month,
  scheduled,
  unscheduled,
}: {
  year: number;
  month: number; // 0-indexed
  scheduled: ContentDraft[];
  unscheduled: ContentDraft[];
}) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // build month grid (always 6 weeks for stable layout)
  const grid = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    // align to Monday = 0
    const dayOfWeek = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - dayOfWeek);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return days;
  }, [year, month]);

  const draftsByDay = useMemo(() => {
    const map = new Map<string, ContentDraft[]>();
    for (const d of scheduled) {
      if (!d.scheduled_at) continue;
      const key = isoDayKey(new Date(d.scheduled_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [scheduled]);

  const todayKey = isoDayKey(new Date());

  async function scheduleDraft(draftId: string, day: Date) {
    // Schedule for 10am on the chosen day
    const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0, 0);
    const res = await fetch(`/api/content/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduled_at: when.toISOString() }),
    });
    if (res.ok) router.refresh();
  }

  async function unschedule(draftId: string) {
    const res = await fetch(`/api/content/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduled_at: null }),
    });
    if (res.ok) router.refresh();
  }

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    router.push(`/dashboard/calendar?month=${monthQuery(d)}`);
  }
  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    router.push(`/dashboard/calendar?month=${monthQuery(d)}`);
  }
  function goToday() {
    const d = new Date();
    router.push(`/dashboard/calendar?month=${monthQuery(d)}`);
  }

  return (
    <div className="mt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Calendário editorial</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">
            {MONTHS_PT[month]} <span className="text-muted-foreground">{year}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* GRID */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-7 gap-px text-xs font-medium text-muted-foreground">
            {WEEKDAYS_PT.map((w) => (
              <div key={w} className="px-2 pb-2 text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-border">
            {grid.map((day) => {
              const inMonth = day.getMonth() === month;
              const key = isoDayKey(day);
              const dayDrafts = draftsByDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    if (draggingId) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/draft-id");
                    if (id) void scheduleDraft(id, day);
                    setDraggingId(null);
                  }}
                  className={cn(
                    "min-h-[110px] bg-card p-2 transition-colors",
                    !inMonth && "bg-muted/40 text-muted-foreground/60",
                    draggingId && inMonth && "hover:bg-brand-50/60"
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full",
                        isToday && "bg-brand-500 font-medium text-white"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {dayDrafts.map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/dashboard/content/${d.id}`}
                          className={cn(
                            "block truncate rounded-md px-1.5 py-1 text-[11px] transition-colors",
                            d.format === "linkedin_post"
                              ? "bg-brand-100 text-brand-900 hover:bg-brand-200"
                              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          )}
                          title={d.topic}
                        >
                          {truncate(d.topic, 40)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* INBOX of unscheduled drafts */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-brand-600" />
              <h3 className="font-display text-lg tracking-tight">Sem data</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Arraste pra um dia do calendário pra agendar.
            </p>

            {unscheduled.length ? (
              <ul className="mt-4 space-y-2">
                {unscheduled.map((d) => (
                  <li
                    key={d.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/draft-id", d.id);
                      setDraggingId(d.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className="cursor-grab rounded-xl border border-border bg-background p-3 text-xs transition-shadow hover:shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={d.format === "linkedin_post" ? "brand" : "soft"}>
                        {d.format === "linkedin_post" ? "Post" : "Artigo"}
                      </Badge>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {d.status}
                      </Badge>
                    </div>
                    <Link
                      href={`/dashboard/content/${d.id}`}
                      className="mt-2 block font-medium hover:text-brand-700"
                    >
                      {truncate(d.topic, 60)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
                Tudo agendado ou nenhum draft pendente.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4 text-brand-600" />
              Agendados em {MONTHS_PT[month]}
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              {scheduled.length ? (
                scheduled.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {d.scheduled_at
                        ? new Date(d.scheduled_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </span>
                    <Link
                      href={`/dashboard/content/${d.id}`}
                      className="min-w-0 flex-1 truncate hover:text-brand-700"
                    >
                      {d.topic}
                    </Link>
                    <button
                      type="button"
                      onClick={() => unschedule(d.id)}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      tirar
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">Nada agendado este mês.</li>
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function isoDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthQuery(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
