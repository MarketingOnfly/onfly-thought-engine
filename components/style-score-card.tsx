"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StyleScore } from "@/lib/db/types";

interface Props {
  draftId: string;
  initial: StyleScore | null;
  /**
   * Texto da variação atual. Se vier, a nota é calculada SOBRE esse
   * texto (sem persistir). Se for igual ao texto da versão primária,
   * usa o initial cacheado.
   */
  body?: string | null;
  /** "Versão A" / "B" / "C" — mostrado inline pra deixar claro */
  versionLabel?: string;
  /** Texto da versão primária — quando body === primary usamos cache */
  primaryBody?: string | null;
}

export function StyleScoreCard({
  draftId,
  initial,
  body,
  versionLabel,
  primaryBody,
}: Props) {
  const [score, setScore] = useState<StyleScore | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastScoredText = useRef<string | null>(initial ? primaryBody ?? null : null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atualiza em tempo real quando o body muda (mudança de variação ou
  // revisão). Debounce de 600ms pra não disparar várias chamadas em
  // sequência.
  useEffect(() => {
    const target = (body ?? primaryBody ?? "").trim();
    if (!target) return;
    if (target === lastScoredText.current) return; // já scoreado

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runScore(target);
    }, 600);
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
      const res = await fetch(`/api/content/${draftId}/score`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: isOverride ? JSON.stringify({ body: text }) : "",
      });
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

  const overall = score?.overall ?? 0;
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
          <h3 className="truncate text-sm font-medium">
            Aderência ao seu estilo
          </h3>
          {versionLabel && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
              {versionLabel}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void runScore()}
          disabled={busy}
          title="Reavaliar"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {busy && !score && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Comparando com seu perfil…
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {score && (
        <div className="mt-4 space-y-4">
          {/* Anel + nota */}
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
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
                <span className={cn("font-display text-xl font-semibold", labelColor)}>
                  {overall}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium text-sm", labelColor)}>{verdict}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Comparado com seu tom, padrões aprendidos e regras de NUNCA
                escreveria.
              </p>
            </div>
          </div>

          {/* Matches */}
          {score.matches.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                O que casou ({score.matches.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {score.matches.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-foreground/80"
                  >
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {score.gaps.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                O que escapou ({score.gaps.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {score.gaps.map((g, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-foreground/80"
                  >
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
