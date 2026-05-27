"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReferenceLink, TopicSuggestion } from "@/lib/db/types";
import { apiFetch } from "@/lib/client-fetch";
import { NewsFeed } from "@/components/news-feed";

const STAGES = [
  { until: 10, label: "Lendo as fontes da sua biblioteca…" },
  { until: 30, label: "Buscando notícias frescas na web…" },
  { until: 70, label: "Cruzando com seu posicionamento e evitando repetir ideias antigas…" },
  { until: 120, label: "Forçando diversidade de ângulo e formato…" },
  { until: 999, label: "Quase lá — sintetizando as melhores…" },
];

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
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  // Paginação + filtros
  const [filter, setFilter] = useState<"all" | "new" | "saved">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  // tick a 1s timer while running
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      startedAt.current = null;
      return;
    }
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (startedAt.current) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const stageLabel =
    STAGES.find((s) => elapsed < s.until)?.label ?? STAGES[STAGES.length - 1].label;

  async function run() {
    setRunning(true);
    setError(null);
    const res = await apiFetch<{ ideas: TopicSuggestion[] }>("/api/discover", {
      method: "POST",
    });
    setRunning(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setIdeas([...(res.data.ideas ?? []), ...ideas]);
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
    if (idea.why_now) params.set("why_now", idea.why_now);
    if (idea.source_url) params.set("source_url", idea.source_url);
    if (idea.source_title) params.set("source_title", idea.source_title);
    router.push(`/dashboard/create?${params.toString()}`);
  }

  const filtered = useMemo(() => {
    if (filter === "all") return ideas;
    if (filter === "saved") return ideas.filter((i) => i.status === "saved");
    return ideas.filter((i) => i.status === "new");
  }, [ideas, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Volta pra primeira página quando filter ou conjunto muda muito
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const counts = {
    all: ideas.length,
    new: ideas.filter((i) => i.status === "new").length,
    saved: ideas.filter((i) => i.status === "saved").length,
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {/* News feed: visualização rápida de notícias do dia */}
        <NewsFeed />

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl tracking-tight">Rodar descoberta</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {sources.length} fontes na sua biblioteca. O motor processa as 5 mais recentes
                por rodada.
              </p>
            </div>
            <Button variant="primary" onClick={run} disabled={running || !sources.length}>
              {running ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> {elapsed}s
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4" /> Gerar ideias
                </>
              )}
            </Button>
          </div>
          {running && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <div className="flex items-center gap-3 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-brand-600" />
                <span className="font-medium text-brand-800">{stageLabel}</span>
                <span className="ml-auto font-mono text-xs text-brand-700">{elapsed}s</span>
              </div>
              <p className="mt-2 text-xs text-brand-700">
                Demora 1-2 min. O motor faz buscas reais na web, lê suas fontes
                e cruza com suas ideias antigas pra não repetir.
              </p>
            </div>
          )}
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
          <>
            {/* Filtros + contador */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex gap-1">
                {(
                  [
                    { key: "all", label: "Todas" },
                    { key: "new", label: "Novas" },
                    { key: "saved", label: "Salvas" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      filter === f.key
                        ? "bg-brand-50 text-brand-700"
                        : "text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {f.label}{" "}
                    <span className="ml-1 opacity-70">({counts[f.key]})</span>
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <p className="text-xs text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </p>
              )}
            </div>

            <ul className="space-y-3">
              {pageItems.map((idea) => (
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
                      <h3 className="mt-2 font-display text-xl tracking-tight">
                        {idea.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {idea.angle}
                      </p>
                      {idea.why_now && (
                        <p className="mt-2 text-xs text-brand-700">
                          <span className="font-medium">Por que agora:</span>{" "}
                          {idea.why_now}
                        </p>
                      )}
                      {idea.source_url ? (
                        <a
                          href={idea.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Abrir artigo <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-60">
                          Fonte sem URL específica
                        </p>
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
                      onClick={() =>
                        update(idea.id, idea.status === "saved" ? "new" : "saved")
                      }
                    >
                      <Bookmark className="h-3.5 w-3.5" />{" "}
                      {idea.status === "saved" ? "Tirar" : "Salvar"}
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

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        "h-8 w-8 rounded-md text-xs font-medium transition",
                        n === currentPage
                          ? "bg-brand-50 text-brand-700"
                          : "text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Filtro retornou vazio */}
            {filtered.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
                Nenhuma ideia nesse filtro. Tenta outro acima.
              </p>
            )}
          </>
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
