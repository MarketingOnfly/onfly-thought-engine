"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Plus, FileText, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ContentDraft,
  LeaderDocument,
  ReferenceLink,
  ReferenceProfile,
} from "@/lib/db/types";
import { formatDate, truncate } from "@/lib/utils";

const LINK_KINDS = [
  { value: "substack", label: "Substack" },
  { value: "newsletter", label: "Newsletter" },
  { value: "blog", label: "Blog" },
  { value: "portal", label: "Portal" },
  { value: "podcast", label: "Podcast" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Outro" },
];

export default function LibraryTabs(props: {
  initialDrafts: ContentDraft[];
  initialProfiles: ReferenceProfile[];
  initialLinks: ReferenceLink[];
  initialDocs: LeaderDocument[];
}) {
  const [drafts, setDrafts] = useState(props.initialDrafts);
  const [profiles, setProfiles] = useState(props.initialProfiles);
  const [links, setLinks] = useState(props.initialLinks);
  const [docs, setDocs] = useState(props.initialDocs);

  return (
    <Tabs defaultValue="drafts" className="mt-8">
      <TabsList>
        <TabsTrigger value="drafts">Conteúdos ({drafts.length})</TabsTrigger>
        <TabsTrigger value="profiles">Perfis ({profiles.length})</TabsTrigger>
        <TabsTrigger value="links">Fontes ({links.length})</TabsTrigger>
        <TabsTrigger value="docs">Documentos ({docs.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="drafts">
        <DraftsList drafts={drafts} onChange={setDrafts} />
      </TabsContent>
      <TabsContent value="profiles">
        <ProfilesPanel items={profiles} onChange={setProfiles} />
      </TabsContent>
      <TabsContent value="links">
        <LinksPanel items={links} onChange={setLinks} />
      </TabsContent>
      <TabsContent value="docs">
        <DocsPanel items={docs} onChange={setDocs} />
      </TabsContent>
    </Tabs>
  );
}

function DraftsList({
  drafts,
  onChange,
}: {
  drafts: ContentDraft[];
  onChange: (next: ContentDraft[]) => void;
}) {
  async function remove(id: string) {
    if (!confirm("Apagar este conteúdo?")) return;
    const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
    if (res.ok) onChange(drafts.filter((d) => d.id !== id));
  }

  if (!drafts.length)
    return (
      <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
        Sem conteúdos ainda.
      </p>
    );

  return (
    <ul className="space-y-3">
      {drafts.map((d) => (
        <li
          key={d.id}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={d.format === "linkedin_post" ? "brand" : "soft"}>
              {d.format === "linkedin_post" ? "Post" : "Artigo"}
            </Badge>
            <Badge variant="outline" className="capitalize">{d.status}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatDate(d.updated_at)}
            </span>
          </div>
          <Link
            href={`/dashboard/content/${d.id}`}
            className="mt-2 block text-lg font-medium hover:text-brand-700"
          >
            {d.topic}
          </Link>
          {d.draft_markdown && (
            <p className="mt-2 text-sm text-muted-foreground">
              {truncate(d.draft_markdown, 240)}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/content/${d.id}`}>Abrir</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProfilesPanel({
  items,
  onChange,
}: {
  items: ReferenceProfile[];
  onChange: (next: ReferenceProfile[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", url: "", why_relevant: "", hook_examples: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/references/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        onChange([...items, data.item]);
        setDraft({ name: "", url: "", why_relevant: "", hook_examples: "" });
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover?")) return;
    await fetch(`/api/references/profiles/${id}`, { method: "DELETE" });
    onChange(items.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar perfil
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label>Por que importa</Label>
            <Textarea
              value={draft.why_relevant}
              onChange={(e) => setDraft({ ...draft, why_relevant: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="mt-3">
            <Label>Exemplos de hooks</Label>
            <Textarea
              value={draft.hook_examples}
              onChange={(e) => setDraft({ ...draft, hook_examples: e.target.value })}
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={add} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{it.name}</span>
                  <a
                    href={it.url}
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {it.why_relevant && (
                  <p className="mt-1 text-xs text-muted-foreground">{it.why_relevant}</p>
                )}
                {it.hook_examples && (
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
                    {it.hook_examples}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Sem perfis cadastrados.
        </p>
      )}
    </div>
  );
}

function LinksPanel({
  items,
  onChange,
}: {
  items: ReferenceLink[];
  onChange: (next: ReferenceLink[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    url: string;
    kind: ReferenceLink["kind"];
    notes: string;
  }>({ title: "", url: "", kind: "blog", notes: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/references/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        onChange([...items, data.item]);
        setDraft({ title: "", url: "", kind: "blog", notes: "" });
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover?")) return;
    await fetch(`/api/references/links/${id}`, { method: "DELETE" });
    onChange(items.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar fonte
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <Label>Título</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) =>
                  setDraft({ ...draft, kind: v as ReferenceLink["kind"] })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label>URL</Label>
            <Input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="mt-3">
            <Label>Notas</Label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={add} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{it.title}</span>
                  <Badge variant="brand" className="text-[10px] capitalize">
                    {it.kind}
                  </Badge>
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
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Sem fontes cadastradas.
        </p>
      )}
    </div>
  );
}

function DocsPanel({
  items,
  onChange,
}: {
  items: LeaderDocument[];
  onChange: (next: LeaderDocument[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", content: "", kind: "background" });
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        onChange([...items, data.item]);
        setDraft({ name: "", content: "", kind: "background" });
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    onChange(items.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar documento
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
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
              <Input
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label>Conteúdo</Label>
            <Textarea
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              rows={10}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={add} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{it.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {it.kind}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {truncate(it.content, 280)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Sem documentos.
        </p>
      )}
    </div>
  );
}
