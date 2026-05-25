"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Markdown, PlainPost } from "@/components/markdown";
import type { ContentDraft } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";

export default function ContentEditor({ initial }: { initial: ContentDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ContentDraft>(initial);
  const [revising, setRevising] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(initial.draft_markdown ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPost = draft.format === "linkedin_post";
  const display = draft.draft_markdown ?? "";

  async function revise() {
    setRevising(true);
    setError(null);
    try {
      const res = await fetch("/api/content/revise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft_id: draft.id,
          instructions: revisionPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setDraft(data.draft);
      setLocalText(data.draft.draft_markdown ?? "");
      setRevisionPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setRevising(false);
    }
  }

  async function approve() {
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        final_markdown: draft.draft_markdown,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
    }
  }

  async function saveManualEdit() {
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        final_markdown: localText,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft({ ...data.draft, draft_markdown: localText });
      setEditing(false);
    }
  }

  async function remove() {
    if (!confirm("Apagar este conteúdo definitivamente?")) return;
    const res = await fetch(`/api/content/${draft.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/library");
      router.refresh();
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const revisions =
    (draft.meta as { revisions?: { at: string; instructions: string }[] })?.revisions ?? [];

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isPost ? "brand" : "soft"}>
          {isPost ? "Post de LinkedIn" : "Artigo"}
        </Badge>
        <Badge variant="outline" className="capitalize">{draft.status}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          Atualizado {formatDate(draft.updated_at)}
        </span>
      </div>

      <h1 className="mt-4 font-display text-3xl tracking-tight md:text-4xl">
        {draft.topic}
      </h1>
      {draft.brief && (
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{draft.brief}</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {editing ? "Editando manualmente" : "Draft"}
            </h2>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="sm" onClick={saveManualEdit}>
                    Salvar edição
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    Editar texto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copy}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {display ? (
            editing ? (
              <Textarea
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                rows={isPost ? 18 : 28}
                className="mt-4 font-mono text-sm"
              />
            ) : (
              <div className="mt-6">
                {isPost ? <PlainPost source={display} /> : <Markdown source={display} />}
              </div>
            )
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-secondary/40 p-6 text-sm">
              <Sparkles className="h-4 w-4 animate-pulse text-brand-600" />
              Aguardando primeira geração.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium">Revisar em linguagem natural</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Diga o que quer mudar. Mantém sua voz.
            </p>
            <Textarea
              value={revisionPrompt}
              onChange={(e) => setRevisionPrompt(e.target.value)}
              placeholder={`Ex: ${
                isPost
                  ? "Hook mais ácido. Tira a citação do final. Quero um número no segundo parágrafo."
                  : "A seção 3 precisa de mais bastidor. Conclusão muito polida — quero uma aposta forte."
              }`}
              rows={4}
              className="mt-3"
            />
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <Button
              variant="primary"
              size="sm"
              className="mt-3 w-full"
              onClick={revise}
              disabled={revising || revisionPrompt.trim().length < 5}
            >
              {revising ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Revisando...
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" /> Aplicar
                </>
              )}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium">Ações</h3>
            <div className="mt-3 flex flex-col gap-2">
              {draft.status !== "approved" && (
                <Button variant="outline" size="sm" onClick={approve}>
                  <Check className="h-3.5 w-3.5" /> Marcar como aprovado
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </div>

          {revisions.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium">Histórico de revisão</h3>
              <ul className="mt-3 space-y-3 text-xs">
                {revisions
                  .slice()
                  .reverse()
                  .map((r, i) => (
                    <li key={i} className="rounded-lg bg-secondary/50 p-3">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {formatDate(r.at)}
                      </p>
                      <p className="mt-1">{r.instructions}</p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
