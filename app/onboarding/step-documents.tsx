"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { truncate } from "@/lib/utils";
import type { LeaderDocument } from "@/lib/db/types";

const DOC_KINDS = ["background", "case", "dado", "opinião"];

export default function StepDocuments() {
  const [items, setItems] = useState<LeaderDocument[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", content: "", kind: "background" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setDraft({ name: "", content: "", kind: "background" });
        setOpen(false);
        void load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-3xl tracking-tight">Documentos de base</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cole textos que servem de matéria-prima: cases, dados internos, slides, manifestos.
          O motor tem precedência por esses documentos sobre fontes externas.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-base">Seus documentos</Label>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <Label htmlFor="d_name">Nome do documento</Label>
              <Input
                id="d_name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Tese sobre travel-as-data"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="d_kind">Tipo</Label>
              <select
                id="d_kind"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className="mt-1 flex h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DOC_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="d_content">Conteúdo</Label>
            <Textarea
              id="d_content"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder="Cole o texto integral aqui. Pode ser longo — o motor lê tudo."
              rows={10}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={add}
              disabled={busy || !draft.name || draft.content.length < 20}
            >
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-background p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{it.name}</span>
                  <Badge variant="outline" className="text-[10px]">{it.kind}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {truncate(it.content, 240)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
          Nenhum documento ainda. Você pode pular esse passo e adicionar depois.
        </p>
      )}
    </div>
  );
}
