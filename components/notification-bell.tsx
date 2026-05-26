"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  ExternalLink,
  Megaphone,
  Sparkles,
  Lightbulb,
  Bookmark,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification, NotificationKind } from "@/lib/db/types";

const ICONS: Record<NotificationKind, typeof Bell> = {
  campaign_ready: Sparkles,
  campaign_failed: Activity,
  admin_broadcast: Megaphone,
  release: Sparkles,
  best_practice: Lightbulb,
  reminder: Bookmark,
  metric_alert: Activity,
};

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60000); // poll every 60s
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (!unreadIds.length) return;
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    });
    setItems(
      items.map((n) =>
        unreadIds.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
    setUnread(0);
  }

  async function markOneRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems(
      items.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
    setUnread((c) => Math.max(0, c - 1));
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-secondary",
          unread > 0 && "border-brand-300"
        )}
        aria-label="Notificações"
      >
        {unread > 0 ? (
          <BellRing className="h-4 w-4 text-brand-600" />
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" />
        )}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 origin-top-right rounded-2xl border border-border bg-card shadow-xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Avisos do marketing</p>
              <p className="text-xs text-muted-foreground">
                {unread > 0 ? `${unread} não lidos` : "Sem novidades"}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-brand-700 hover:underline"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nada por aqui. Quando o marketing soltar release ou seu campaign draft
                ficar pronto, aparece aqui.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const Icon = ICONS[n.kind] ?? Bell;
                  const isUnread = !n.read_at;
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors",
                        isUnread && "bg-brand-50/40"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          isUnread
                            ? "bg-brand-100 text-brand-700"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm",
                            isUnread ? "font-medium" : "font-normal text-muted-foreground"
                          )}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {relativeTime(n.created_at)}
                          </span>
                          {n.link && (
                            <a
                              href={n.link}
                              className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                              onClick={() => void markOneRead(n.id)}
                            >
                              Abrir <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => void markOneRead(n.id)}
                              className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <Check className="h-3 w-3" /> marcar como lido
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
