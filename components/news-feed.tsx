"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/db/types";

interface State {
  items: NewsItem[];
  fetched_at: string | null;
  cached: boolean;
  error: string | null;
  loading: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function NewsFeed() {
  const [state, setState] = useState<State>({
    items: [],
    fetched_at: null,
    cached: false,
    error: null,
    loading: true,
  });

  async function load(forceRefresh = false) {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(
        `/api/discover/news${forceRefresh ? "?refresh=1" : ""}`
      );
      const data = await res.json();
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: data.error ?? "Falha ao buscar notícias.",
        }));
        return;
      }
      setState({
        items: data.items ?? [],
        fetched_at: data.fetched_at ?? null,
        cached: !!data.cached,
        error: null,
        loading: false,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Erro de rede.",
      }));
    }
  }

  useEffect(() => {
    void load(false);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-xl tracking-tight">
              Notícias do dia
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Buscadas em tempo real com base nos seus temas. Inspiração rápida
            antes de virar pauta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state.fetched_at && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {state.cached ? "do cache" : "agora"}:{" "}
              {timeAgo(state.fetched_at)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={state.loading}
            title="Buscar de novo (ignora cache)"
          >
            {state.loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" /> Atualizar
              </>
            )}
          </Button>
        </div>
      </div>

      {state.error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state.loading && state.items.length === 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border bg-secondary/40 p-4"
            >
              <div className="h-3 w-20 rounded bg-secondary" />
              <div className="mt-3 h-4 w-full rounded bg-secondary" />
              <div className="mt-2 h-3 w-3/4 rounded bg-secondary" />
            </div>
          ))}
        </div>
      ) : state.items.length > 0 ? (
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {state.items.map((n, i) => (
            <li
              key={`${n.url}-${i}`}
              className="group rounded-xl border border-border bg-background p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {n.source || "fonte"}
                </Badge>
                {n.published_at && (
                  <span className="text-[10px] text-muted-foreground">
                    {n.published_at}
                  </span>
                )}
              </div>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-sm font-medium leading-snug hover:text-brand-700"
              >
                {n.title}
                <ExternalLink className="ml-1 inline h-3 w-3 align-baseline opacity-60" />
              </a>
              {n.summary && (
                <p className="mt-2 text-xs text-muted-foreground leading-snug">
                  {n.summary}
                </p>
              )}
              <div className="mt-3">
                <a
                  href={`/dashboard/create?topic=${encodeURIComponent(
                    n.title
                  )}&angle=${encodeURIComponent(n.summary ?? "")}`}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-medium",
                    "text-brand-700 hover:underline"
                  )}
                >
                  <Wand2 className="h-3 w-3" /> Virar conteúdo
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !state.loading && (
          <p className="mt-4 text-sm text-muted-foreground">
            Sem notícias por enquanto. Clica em "Atualizar" pra buscar.
          </p>
        )
      )}
    </div>
  );
}
