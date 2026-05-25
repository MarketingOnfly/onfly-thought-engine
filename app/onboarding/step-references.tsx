"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ReferenceLink, ReferenceProfile } from "@/lib/db/types";

const LINK_KINDS = [
  { value: "substack", label: "Substack" },
  { value: "newsletter", label: "Newsletter" },
  { value: "blog", label: "Blog" },
  { value: "portal", label: "Portal" },
  { value: "podcast", label: "Podcast" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Outro" },
];

export default function StepReferences() {
  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="font-display text-3xl tracking-tight">Referências</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Perfis que você admira (estilo, hook, ritmo) e fontes que você acompanha (matéria-prima
          de pauta). O motor estuda os dois.
        </p>
      </div>
      <ReferenceProfilesBlock />
      <ReferenceLinksBlock />
    </div>
  );
}

function ReferenceProfilesBlock() {
  const [items, setItems] = useState<ReferenceProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", url: "", why_relevant: "", hook_examples: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/references/profiles");
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/references/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setDraft({ name: "", url: "", why_relevant: "", hook_examples: "" });
        setOpen(false);
        void load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/references/profiles/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Perfis de referência</Label>
          <p className="text-xs text-muted-foreground">
            Pessoas cujo estilo de escrita inspira você. (Não copiamos opinião, só padrão.)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="rp_name">Nome</Label>
              <Input
                id="rp_name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Lara Acrich"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rp_url">LinkedIn (ou perfil)</Label>
              <Input
                id="rp_url"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://www.linkedin.com/in/..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="rp_why">Por que você gosta do estilo dele(a)?</Label>
            <Textarea
              id="rp_why"
              value={draft.why_relevant}
              onChange={(e) => setDraft({ ...draft, why_relevant: e.target.value })}
              placeholder="Ex: Abre sempre com número específico, frases curtas, opinião forte logo no primeiro parágrafo."
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="mt-3">
            <Label htmlFor="rp_hooks">Exemplos de hooks que funcionam pra essa pessoa</Label>
            <Textarea
              id="rp_hooks"
              value={draft.hook_examples}
              onChange={(e) => setDraft({ ...draft, hook_examples: e.target.value })}
              placeholder="Cole 2-3 primeiros parágrafos de posts dela que você acha geniais."
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={add}
              disabled={busy || !draft.name || !draft.url}
            >
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-background p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{it.name}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {new URL(it.url).hostname.replace("www.", "")}
                  </Badge>
                </div>
                {it.why_relevant && (
                  <p className="mt-1 text-xs text-muted-foreground">{it.why_relevant}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReferenceLinksBlock() {
  const [items, setItems] = useState<ReferenceLink[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    url: string;
    kind: ReferenceLink["kind"];
    notes: string;
  }>({ title: "", url: "", kind: "blog", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/references/links");
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/references/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setDraft({ title: "", url: "", kind: "blog", notes: "" });
        setOpen(false);
        void load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/references/links/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Fontes que você acompanha</Label>
          <p className="text-xs text-muted-foreground">
            Substacks, newsletters, blogs e portais. O motor lê para sugerir pauta e usar como
            referência.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <Label htmlFor="rl_title">Título</Label>
              <Input
                id="rl_title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ex: Stratechery"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rl_kind">Tipo</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft({ ...draft, kind: v as ReferenceLink["kind"] })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="rl_url">URL</Label>
            <Input
              id="rl_url"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://stratechery.com"
              className="mt-1"
            />
          </div>
          <div className="mt-3">
            <Label htmlFor="rl_notes">Por que vale acompanhar (opcional)</Label>
            <Textarea
              id="rl_notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Ex: Análise de tech business com lente de estratégia, melhor pra entender posicionamento."
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={add}
              disabled={busy || !draft.title || !draft.url}
            >
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-background p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{it.title}</span>
                  <Badge variant="brand" className="text-[10px] capitalize">{it.kind}</Badge>
                </div>
                <a
                  href={it.url}
                  target="_blank"
                  className="mt-1 block truncate text-xs text-muted-foreground hover:underline"
                  rel="noreferrer"
                >
                  {it.url}
                </a>
                {it.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{it.notes}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
