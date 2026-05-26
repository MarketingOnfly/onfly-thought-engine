"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  Lightbulb,
  Megaphone,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client-fetch";
import type { Notification, NotificationKind } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/confirm";

type Kind = Extract<
  NotificationKind,
  "admin_broadcast" | "release" | "best_practice" | "reminder"
>;

const KIND_OPTIONS: { kind: Kind; label: string; icon: typeof Bell; description: string }[] =
  [
    {
      kind: "admin_broadcast",
      label: "Aviso geral",
      icon: Megaphone,
      description: "Comunicado padrão do time de marketing.",
    },
    {
      kind: "release",
      label: "Release / Novidade",
      icon: Sparkles,
      description: "Anúncio sobre algo que a empresa lançou.",
    },
    {
      kind: "best_practice",
      label: "Boa prática",
      icon: Lightbulb,
      description: "Dica de conteúdo, formato ou tom.",
    },
    {
      kind: "reminder",
      label: "Lembrete",
      icon: Bookmark,
      description: "Lembrar líderes de publicar/agendar.",
    },
  ];

export default function BroadcastsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    body: string;
    link: string;
    kind: Kind;
  }>({ title: "", body: "", link: "", kind: "admin_broadcast" });
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function load() {
    const res = await fetch("/api/admin/notifications");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setBusy(true);
    try {
      const res = await apiFetch<{ item: Notification }>("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          body: draft.body || null,
          link: draft.link || null,
          kind: draft.kind,
        }),
      });
      if (res.ok) {
        setItems([res.data.item, ...items]);
        setDraft({ title: "", body: "", link: "", kind: "admin_broadcast" });
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Apagar este aviso?",
      description: "Ele some do sininho de todos os líderes.",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((x) => x.id !== id));
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-600" />
              <h2 className="font-display text-xl tracking-tight">Avisos pro time</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Avisos chegam no sininho de todo líder. Use para releases, boas práticas e
              lembretes.
            </p>
          </div>
          <Button variant="primary" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> Novo aviso
          </Button>
        </div>

        {open && (
          <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {KIND_OPTIONS.map((opt) => {
                  const active = draft.kind === opt.kind;
                  return (
                    <button
                      key={opt.kind}
                      type="button"
                      onClick={() => setDraft({ ...draft, kind: opt.kind })}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-brand-500 bg-brand-50/50"
                          : "border-border bg-background hover:bg-secondary/50"
                      }`}
                    >
                      <opt.icon className="mt-0.5 h-4 w-4 text-brand-600" />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <Label>Título</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ex: Nova feature de relatórios no produto"
                className="mt-1"
              />
            </div>
            <div className="mt-3">
              <Label>Mensagem (opcional)</Label>
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="O que os líderes precisam saber? Use frase curta — eles veem no sininho."
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="mt-3">
              <Label>Link (opcional)</Label>
              <Input
                value={draft.link}
                onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={create}
                disabled={busy || draft.title.length < 2}
              >
                {busy ? "Enviando…" : "Enviar pro time"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <Badge variant="outline" className="text-[10px]">
                {KIND_OPTIONS.find((k) => k.kind === n.kind)?.label ?? n.kind.replace("_", " ")}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && (
                  <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                )}
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Enviado {formatDate(n.created_at)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
