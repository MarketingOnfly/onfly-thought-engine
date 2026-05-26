"use client";

import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { OrgDocument } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/confirm";

const KINDS: { key: string; label: string }[] = [
  { key: "voice_guidelines", label: "Guia de voz" },
  { key: "forbidden", label: "Proibições" },
  { key: "pillars", label: "Pilares de marca" },
  { key: "onfly_facts", label: "Fatos da Onfly" },
  { key: "tone_examples", label: "Exemplos de tom" },
];

export default function OrgDocsPanel({ initial }: { initial: OrgDocument[] }) {
  const [items, setItems] = useState<OrgDocument[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    id?: string;
    name: string;
    content: string;
    kind: string;
    is_active: boolean;
  }>({
    name: "",
    content: "",
    kind: "voice_guidelines",
    is_active: true,
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  function startNew() {
    setEditingId(null);
    setDraft({ name: "", content: "", kind: "voice_guidelines", is_active: true });
    setOpen(true);
  }

  function startEdit(it: OrgDocument) {
    setEditingId(it.id);
    setDraft({
      id: it.id,
      name: it.name,
      content: it.content,
      kind: it.kind,
      is_active: it.is_active,
    });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/org-docs/${editingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            content: draft.content,
            kind: draft.kind,
            is_active: draft.is_active,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setItems(items.map((x) => (x.id === editingId ? data.item : x)));
          setOpen(false);
        }
      } else {
        const res = await fetch("/api/admin/org-docs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (res.ok) {
          const data = await res.json();
          setItems([...items, data.item]);
          setOpen(false);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Apagar este documento?",
      description:
        "Ele some do contexto que o motor usa pra escrever — vai afetar todas as próximas gerações.",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/org-docs/${id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((x) => x.id !== id));
  }

  async function toggleActive(it: OrgDocument) {
    const res = await fetch(`/api/admin/org-docs/${it.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: !it.is_active }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(items.map((x) => (x.id === it.id ? data.item : x)));
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={startNew}>
          <Plus className="h-4 w-4" /> Novo documento
        </Button>
      </div>

      {open && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-display text-2xl tracking-tight">
            {editingId ? "Editar documento" : "Novo documento"}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div>
              <Label>Nome</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className="mt-1 flex h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Ativo</Label>
              <label className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                <span className="text-sm">{draft.is_active ? "Sim" : "Não"}</span>
              </label>
            </div>
          </div>
          <div className="mt-3">
            <Label>Conteúdo</Label>
            <Textarea
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              rows={14}
              className="mt-1 font-mono text-xs"
              placeholder="Use linguagem direta, como instruções. Pode ter listas e exemplos."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Este texto entra no contexto que o motor lê pra todo líder, em toda geração.
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={busy || !draft.name || draft.content.length < 10}
            >
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{it.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {KINDS.find((k) => k.key === it.kind)?.label ?? it.kind}
                    </Badge>
                    {it.is_active ? (
                      <Badge variant="brand">ativo</Badge>
                    ) : (
                      <Badge variant="secondary">inativo</Badge>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">
                    {it.content}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Atualizado {formatDate(it.updated_at)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive(it)}>
                    {it.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(it)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
          Nenhum documento ainda. Crie o primeiro acima.
        </p>
      )}
    </div>
  );
}
