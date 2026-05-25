"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Compass, ExternalLink, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReferenceLink, TopicSuggestion } from "@/lib/db/types";

export default function DiscoverPanel({
  initialIdeas,
  sources,
}: {
  initialIdeas: TopicSuggestion[];
  sources: ReferenceLink[];
}) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(initialIdeas);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setIdeas([...(data.ideas ?? []), ...ideas]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setRunning(false);
    }
  }

  async function update(id: string, status: TopicSuggestion["status"]) {
    const res = await fetch(`/api/discover/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      if (status === "dismissed") {
        setIdeas(ideas.filter((x) => x.id !== id));
      } else {
        setIdeas(ideas.map((x) => (x.id === id ? { ...x, status } : x)));
      }
    }
  }

  function turnIntoContent(idea: TopicSuggestion, format: "linkedin_post" | "article") {
    const params = new URLSearchParams({
      topic: idea.title,
      angle: idea.angle,
      format,
    });
    router.push(`/dashboard/create?${params.toString()}`);
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="font-display text-xl tracking-tight">Rodar descoberta</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {sources.length} fontes na sua biblioteca. O motor lê até 8 por rodada.
            </p>
          </div>
          <Button variant="primary" onClick={run} disabled={running || !sources.length}>
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Lendo fontes...
              </>
            ) : (
              <>
                <Compass className="h-4 w-4" /> Gerar ideias
              </>
            )}
          </Button>
        </div>

        {!sources.length && (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-6 text-sm">
            Você ainda não tem fontes. Vá em{" "}
            <a href="/dashboard/library" className="underline">
              Biblioteca → Fontes
            </a>{" "}
            e adicione substacks, newsletters ou portais que você acompanha.
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {ideas.length ? (
          <ul className="space-y-3">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand">{idea.relevance_score}</Badge>
                      {idea.status === "saved" && (
                        <Badge variant="soft">salvo</Badge>
                      )}
                      {idea.source_title && (
                        <Badge variant="outline" className="text-[10px]">
                          {idea.source_title}
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2 font-display text-xl tracking-tight">{idea.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{idea.angle}</p>
                    {idea.why_now && (
                      <p className="mt-2 text-xs text-brand-700">
                        <span className="font-medium">Por que agora:</span> {idea.why_now}
                      </p>
                    )}
                    {idea.source_url && (
                      <a
                        href={idea.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Fonte <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => turnIntoContent(idea, "linkedin_post")}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Gerar post
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => turnIntoContent(idea, "article")}
                  >
                    Gerar artigo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update(idea.id, idea.status === "saved" ? "new" : "saved")}
                  >
                    <Bookmark className="h-3.5 w-3.5" /> {idea.status === "saved" ? "Tirar" : "Salvar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground"
                    onClick={() => update(idea.id, "dismissed")}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Descartar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !running && (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-center">
              <Compass className="mx-auto h-6 w-6 text-brand-500" />
              <p className="mt-3 text-sm font-medium">Sem ideias por aqui ainda.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clica em "Gerar ideias" e o motor vai ler suas fontes.
              </p>
            </div>
          )
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-medium">Suas fontes ativas</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {sources.length ? (
              sources.slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {s.kind}
                  </Badge>
                  <span className="truncate">{s.title}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">Nenhuma cadastrada.</li>
            )}
          </ul>
          <Button asChild variant="ghost" size="sm" className="mt-3 w-full">
            <a href="/dashboard/library">Gerenciar fontes</a>
          </Button>
        </div>
      </aside>
    </div>
  );
}
