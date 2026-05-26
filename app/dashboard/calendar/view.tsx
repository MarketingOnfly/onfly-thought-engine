"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Inbox,
  Clock,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, truncate } from "@/lib/utils";
import type { ContentDraft, ContentFormat } from "@/lib/db/types";

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

// Paleta estável de pilares — cor derivada do hash da primeira tag.
const PILLAR_COLORS = [
  { bg: "bg-brand-100", text: "text-brand-900", hover: "hover:bg-brand-200" },
  { bg: "bg-emerald-100", text: "text-emerald-900", hover: "hover:bg-emerald-200" },
  { bg: "bg-amber-100", text: "text-amber-900", hover: "hover:bg-amber-200" },
  { bg: "bg-violet-100", text: "text-violet-900", hover: "hover:bg-violet-200" },
  { bg: "bg-rose-100", text: "text-rose-900", hover: "hover:bg-rose-200" },
  { bg: "bg-sky-100", text: "text-sky-900", hover: "hover:bg-sky-200" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-900", hover: "hover:bg-fuchsia-200" },
];

function pillarColor(tag: string | null, format: ContentFormat) {
  if (!tag) {
    return format === "linkedin_post"
      ? PILLAR_COLORS[0]
      : {
          bg: "bg-secondary",
          text: "text-secondary-foreground",
          hover: "hover:bg-secondary/80",
        };
  }
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return PILLAR_COLORS[h % PILLAR_COLORS.length];
}

type ViewMode = "month" | "week";
type FilterMode = "all" | "linkedin_post" | "article";

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
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [popover, setPopover] = useState<{
    draftId: string;
    currentISO: string | null;
    defaultDay: Date;
  } | null>(null);

  const filteredScheduled = useMemo(
    () =>
      filter === "all"
        ? scheduled
        : scheduled.filter((d) => d.format === filter),
    [scheduled, filter]
  );
  const filteredUnscheduled = useMemo(
    () =>
      filter === "all"
        ? unscheduled
        : unscheduled.filter((d) => d.format === filter),
    [unscheduled, filter]
  );

  const draftsByDay = useMemo(() => {
    const map = new Map<string, ContentDraft[]>();
    for (const d of filteredScheduled) {
      if (!d.scheduled_at) continue;
      const key = isoDayKey(new Date(d.scheduled_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // ordena cada dia por horário
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.scheduled_at!).getTime() -
          new Date(b.scheduled_at!).getTime()
      );
    }
    return map;
  }, [filteredScheduled]);

  // grade do mês — sempre 6 semanas para layout estável
  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - dayOfWeek);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      );
    }
    return days;
  }, [year, month]);

  // âncora da semana — se mês exibido = mês atual usa hoje, senão usa dia 15
  const weekAnchor = useMemo(() => {
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month) return today;
    return new Date(year, month, 15);
  }, [year, month]);

  const weekGrid = useMemo(() => {
    const dow = (weekAnchor.getDay() + 6) % 7;
    const start = new Date(
      weekAnchor.getFullYear(),
      weekAnchor.getMonth(),
      weekAnchor.getDate() - dow
    );
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      );
    }
    return days;
  }, [weekAnchor]);

  // cobertura da semana corrente — quantas publicações agendadas
  const weekCoverage = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const startOfWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - dow
    );
    const endOfWeek = new Date(
      startOfWeek.getFullYear(),
      startOfWeek.getMonth(),
      startOfWeek.getDate() + 7
    );
    const count = scheduled.filter((d) => {
      if (!d.scheduled_at) return false;
      const t = new Date(d.scheduled_at).getTime();
      return t >= startOfWeek.getTime() && t < endOfWeek.getTime();
    }).length;
    return { count, target: 2 };
  }, [scheduled]);

  const todayKey = isoDayKey(new Date());

  async function scheduleDraft(
    draftId: string,
    day: Date,
    hour = 10,
    minute = 0
  ) {
    const when = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hour,
      minute,
      0
    );
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
    if (res.ok) {
      setPopover(null);
      router.refresh();
    }
  }

  async function saveSchedule(draftId: string, isoLocal: string) {
    // isoLocal vem do <input type="datetime-local"> no formato "YYYY-MM-DDTHH:MM"
    const local = new Date(isoLocal);
    if (Number.isNaN(local.getTime())) return;
    const res = await fetch(`/api/content/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduled_at: local.toISOString() }),
    });
    if (res.ok) {
      setPopover(null);
      router.refresh();
    }
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

  function renderItem(d: ContentDraft, opts?: { compact?: boolean }) {
    const tag = d.tags?.[0] ?? null;
    const c = pillarColor(tag, d.format);
    const time = d.scheduled_at
      ? new Date(d.scheduled_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/draft-id", d.id);
          setDraggingId(d.id);
        }}
        onDragEnd={() => setDraggingId(null)}
        className={cn(
          "group flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-[11px] transition-colors",
          c.bg,
          c.text,
          c.hover,
          "cursor-grab active:cursor-grabbing"
        )}
        title={`${time ? time + " · " : ""}${d.topic}`}
      >
        {time && (
          <span className="shrink-0 font-mono text-[10px] opacity-70">{time}</span>
        )}
        <Link
          href={`/dashboard/content/${d.id}`}
          className="min-w-0 flex-1 truncate"
        >
          {truncate(d.topic, opts?.compact ? 28 : 60)}
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPopover({
              draftId: d.id,
              currentISO: d.scheduled_at,
              defaultDay: d.scheduled_at ? new Date(d.scheduled_at) : new Date(),
            });
          }}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-70 hover:opacity-100"
          aria-label="Trocar hora"
        >
          <Clock className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Calendário editorial</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">
            {MONTHS_PT[month]}{" "}
            <span className="text-muted-foreground">{year}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Esta semana:{" "}
              <strong className="text-foreground">
                {weekCoverage.count}/{weekCoverage.target}
              </strong>{" "}
              publicações
            </span>
            <div className="flex gap-0.5">
              {Array.from({
                length: Math.max(weekCoverage.target, weekCoverage.count),
              }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full",
                    i < weekCoverage.count ? "bg-brand-500" : "bg-border"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                viewMode === "month"
                  ? "bg-brand-100 text-brand-900"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                viewMode === "week"
                  ? "bg-brand-100 text-brand-900"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semana
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "linkedin_post", "article"] as FilterMode[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f
                ? "border-brand-500 bg-brand-50 text-brand-900"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "all" ? "Tudo" : f === "linkedin_post" ? "Posts" : "Artigos"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* GRID — mês ou semana */}
        {viewMode === "month" ? (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-7 gap-px text-xs font-medium text-muted-foreground">
              {WEEKDAYS_PT.map((w) => (
                <div key={w} className="px-2 pb-2 text-center">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-border">
              {monthGrid.map((day) => {
                const inMonth = day.getMonth() === month;
                const key = isoDayKey(day);
                const dayDrafts = draftsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                const isFuture = key >= todayKey;
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
                      "group min-h-[110px] bg-card p-2 transition-colors",
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
                      {inMonth && isFuture && dayDrafts.length === 0 && (
                        <Link
                          href={`/dashboard/create?schedule_for=${key}`}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Criar para esse dia"
                          title="Criar conteúdo para esse dia"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground hover:text-brand-600" />
                        </Link>
                      )}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {dayDrafts.map((d) => (
                        <li key={d.id}>{renderItem(d, { compact: true })}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <WeekView
            days={weekGrid}
            draftsByDay={draftsByDay}
            todayKey={todayKey}
            draggingId={draggingId}
            onDrop={scheduleDraft}
            onResetDragging={() => setDraggingId(null)}
            renderItem={renderItem}
          />
        )}

        {/* Aside */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-brand-600" />
              <h3 className="font-display text-lg tracking-tight">Sem data</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Arraste pra um dia do calendário pra agendar.
            </p>

            {filteredUnscheduled.length ? (
              <ul className="mt-4 space-y-2">
                {filteredUnscheduled.map((d) => (
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
                      <Badge
                        variant={d.format === "linkedin_post" ? "brand" : "soft"}
                      >
                        {d.format === "linkedin_post" ? "Post" : "Artigo"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="capitalize text-[10px]"
                      >
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
                {filter === "all"
                  ? "Tudo agendado ou nenhum draft pendente."
                  : "Nenhum draft desse formato sem data."}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4 text-brand-600" />
              Agendados em {MONTHS_PT[month]}
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              {filteredScheduled.length ? (
                filteredScheduled.map((d) => (
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
                      onClick={() =>
                        setPopover({
                          draftId: d.id,
                          currentISO: d.scheduled_at,
                          defaultDay: d.scheduled_at
                            ? new Date(d.scheduled_at)
                            : new Date(),
                        })
                      }
                      className="text-[10px] text-muted-foreground hover:text-brand-700"
                      aria-label="Trocar hora"
                    >
                      ajustar
                    </button>
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
                <li className="text-muted-foreground">
                  {filter === "all"
                    ? "Nada agendado este mês."
                    : "Nenhum draft desse formato agendado este mês."}
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      {/* Popover de agendamento */}
      {popover && (
        <SchedulePopover
          draftId={popover.draftId}
          defaultDay={popover.defaultDay}
          hasSchedule={!!popover.currentISO}
          onClose={() => setPopover(null)}
          onSave={saveSchedule}
          onUnschedule={unschedule}
        />
      )}
    </div>
  );
}

function WeekView({
  days,
  draftsByDay,
  todayKey,
  draggingId,
  onDrop,
  onResetDragging,
  renderItem,
}: {
  days: Date[];
  draftsByDay: Map<string, ContentDraft[]>;
  todayKey: string;
  draggingId: string | null;
  onDrop: (draftId: string, day: Date) => Promise<void>;
  onResetDragging: () => void;
  renderItem: (
    d: ContentDraft,
    opts?: { compact?: boolean }
  ) => React.ReactElement;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = isoDayKey(day);
          const dayDrafts = draftsByDay.get(key) ?? [];
          const isToday = key === todayKey;
          const dow = (day.getDay() + 6) % 7;
          return (
            <div
              key={key}
              onDragOver={(e) => {
                if (draggingId) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/draft-id");
                if (id) void onDrop(id, day);
                onResetDragging();
              }}
              className={cn(
                "min-h-[300px] rounded-xl border border-border p-2 transition-colors",
                isToday && "border-brand-300 bg-brand-50/30",
                draggingId && "hover:bg-brand-50/60"
              )}
            >
              <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {WEEKDAYS_PT[dow]}
                </span>
                <span
                  className={cn(
                    "font-display text-lg",
                    isToday ? "text-brand-700" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              {dayDrafts.length ? (
                <ul className="space-y-1.5">
                  {dayDrafts.map((d) => (
                    <li key={d.id}>{renderItem(d)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-8 text-center text-[10px] italic text-muted-foreground/60">
                  livre
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchedulePopover({
  draftId,
  defaultDay,
  hasSchedule,
  onClose,
  onSave,
  onUnschedule,
}: {
  draftId: string;
  defaultDay: Date;
  hasSchedule: boolean;
  onClose: () => void;
  onSave: (draftId: string, isoLocal: string) => Promise<void>;
  onUnschedule: (draftId: string) => Promise<void>;
}) {
  const [value, setValue] = useState(toLocalInputValue(defaultDay));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draftId, value);
    } finally {
      setSaving(false);
    }
  }
  async function handleUnschedule() {
    setSaving(true);
    try {
      await onUnschedule(draftId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg tracking-tight">
            Agendar publicação
          </h3>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Escolha o dia e a hora exata. Quando você arrasta, o padrão é 10:00.
        </p>
        <div className="mt-4">
          <label className="text-xs font-medium text-muted-foreground">
            Data e hora
          </label>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          {hasSchedule ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnschedule}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              Tirar do calendário
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function isoDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthQuery(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
