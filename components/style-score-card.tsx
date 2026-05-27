"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StyleScore } from "@/lib/db/types";

interface UseStyleScoreOpts {
  draftId: string;
  initial: StyleScore | null;
  body?: string | null;
  primaryBody?: string | null;
}

/**
 * Hook que faz fetch da nota e atualiza em tempo real quando o body muda
 * (mudança de variação A/B/C ou revisão).
 */
export function useStyleScore(opts: UseStyleScoreOpts) {
  const { draftId, initial, body, primaryBody } = opts;
  const [score, setScore] = useState<StyleScore | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScoredText = useRef<string | null>(
    initial ? primaryBody ?? null : null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const target = (body ?? primaryBody ?? "").trim();
    if (!target) return;
    if (target === lastScoredText.current) return;

    // Limpa o score atual pra que a UI mostre "recalculando" em vez
    // de manter dados da variação anterior. Sem isso a percepção é de
    // que a nota "não atualiza" — mesmo quando ela tá pra atualizar
    // em < 1s.
    setScore(null);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runScore(target);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, primaryBody]);

  async function runScore(targetText?: string) {
    setBusy(true);
    setError(null);
    try {
      const text = targetText ?? body ?? primaryBody ?? null;
      const isOverride = !!body && body !== primaryBody;
      // Quando não tem override, manda POST sem body algum (estava
      // mandando body: "" que funcionava por acidente — sem header
      // content-length em alguns runtimes, sem JSON parsável)
      const init: RequestInit = {
        method: "POST",
        cache: "no-store",
      };
      if (isOverride) {
        init.headers = { "content-type": "application/json" };
        init.body = JSON.stringify({ body: text });
      }
      const res = await fetch(`/api/content/${draftId}/score`, init);
      if (res.ok) {
        const data = await res.json();
        setScore(data.score);
        lastScoredText.current = text ?? null;
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao avaliar.");
      }
    } finally {
      setBusy(false);
    }
  }

  return { score, busy, error, refetch: runScore };
}

function paletteFor(overall: number) {
  const ringColor =
    overall >= 85
      ? "stroke-brand-600"
      : overall >= 60
        ? "stroke-amber-500"
        : "stroke-destructive";
  const labelColor =
    overall >= 85
      ? "text-brand-700"
      : overall >= 60
        ? "text-amber-700"
        : "text-destructive";
  const verdict =
    overall >= 85
      ? "Colado no seu estilo"
      : overall >= 60
        ? "Ok, mas tem ajuste"
        : "Saiu fora do seu padrão";
  return { ringColor, labelColor, verdict };
}

/**
 * Chip compacto da nota — só anel + verdict. Vai no aside.
 */
export function StyleScoreChip({
  score,
  busy,
  error,
  versionLabel,
  onRefresh,
}: {
  score: StyleScore | null;
  busy: boolean;
  error: string | null;
  versionLabel?: string;
  onRefresh: () => void;
}) {
  const overall = score?.overall ?? 0;
  const { ringColor, labelColor, verdict } = paletteFor(overall);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-600" />
          <h3 className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Aderência ao seu estilo
          </h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          title="Reavaliar"
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {busy && !score && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Comparando…
        </div>
      )}

      {error && !score && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {score && (
        <div className="mt-3 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.915"
                className="fill-none stroke-secondary"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.915"
                className={cn("fill-none transition-all", ringColor)}
                strokeWidth="3"
                strokeDasharray={`${overall}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={cn("font-display text-base font-semibold", labelColor)}
              >
                {overall}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-medium leading-tight", labelColor)}>
              {verdict}
            </p>
            {versionLabel && (
              <span className="mt-1 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                {versionLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Detalhes da nota — listas de "o que casou" e "o que escapou".
 * Vai no main column embaixo do conteúdo. Aproveita espaço horizontal.
 */
export function StyleScoreDetails({
  score,
  busy,
}: {
  score: StyleScore | null;
  busy: boolean;
}) {
  // Estado "recalculando" — sem score mas trabalhando. Mostra placeholder
  // pra deixar claro que tá atualizando (após troca de variação).
  if (!score && busy) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-medium">
            Recalculando aderência…
          </h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Avaliando o texto desta versão contra seu estilo.
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="h-2 w-24 rounded bg-secondary" />
            <div className="h-2 w-full rounded bg-secondary" />
            <div className="h-2 w-5/6 rounded bg-secondary" />
            <div className="h-2 w-4/6 rounded bg-secondary" />
          </div>
          <div className="space-y-2">
            <div className="h-2 w-24 rounded bg-secondary" />
            <div className="h-2 w-full rounded bg-secondary" />
            <div className="h-2 w-3/4 rounded bg-secondary" />
          </div>
        </div>
      </div>
    );
  }
  if (!score) return null;
  const { matches, gaps } = score;
  if (matches.length === 0 && gaps.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-medium">
          Sugestões de aderência ao seu estilo
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Análise contra seu tom, padrões aprendidos e regras de NUNCA escreveria.
      </p>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {matches.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-brand-700">
              <CheckCircle2 className="h-3 w-3" />
              O que casou ({matches.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {matches.map((m, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-snug text-foreground/85"
                >
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {gaps.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-destructive">
              <XCircle className="h-3 w-3" />
              O que escapou ({gaps.length})
            </p>
            <ul className="mt-2 space-y-1.5">
              {gaps.map((g, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs leading-snug text-foreground/85"
                >
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
