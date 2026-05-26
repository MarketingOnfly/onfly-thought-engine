"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewIssue, ReviewResult } from "@/lib/anthropic/review";

const KIND_LABELS: Record<string, string> = {
  ai_trope: "Soa como IA",
  em_dash: "Travessão demais",
  passive_voice: "Voz passiva",
  weak_hook: "Abertura fraca",
  vague_number: "Número genérico",
  missing_opinion: "Falta opinião",
  off_voice: "Não soa como você",
  long_sentence: "Frase longa",
  filler: "Encheção de linguiça",
  off_audience: "Fora do tom da sua audiência",
};

const SEVERITY_LABEL: Record<string, string> = {
  error: "crítico",
  warn: "atenção",
  info: "observação",
};

const SEVERITY_ICON: Record<
  ReviewIssue["severity"],
  { icon: typeof Info; cls: string }
> = {
  info: { icon: Info, cls: "text-slate-500" },
  warn: { icon: AlertTriangle, cls: "text-amber-600" },
  error: { icon: AlertCircle, cls: "text-destructive" },
};

const DEBOUNCE_MS = 2500;
const MIN_LENGTH = 80;

export function ReviewPanel({
  text,
  format,
  enabled = true,
}: {
  text: string;
  format: "linkedin_post" | "article";
  enabled?: boolean;
}) {
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTextRef, setLastTextRef] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // run a review (manual or debounced)
  async function run(target: string) {
    if (target.trim().length < MIN_LENGTH) {
      setReview(null);
      setError(null);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: target, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro na revisão");
        return;
      }
      const data = await res.json();
      setReview(data.review);
      setLastTextRef(target);
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Erro");
      }
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }

  // debounced trigger when text changes
  useEffect(() => {
    if (!enabled) return;
    if (text === lastTextRef) return;
    if (text.trim().length < MIN_LENGTH) {
      setReview(null);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void run(text);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);

  const hasReview = !!review;
  const score = review?.voice_match_score ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" />
          Revisão em tempo real
        </h3>
        <button
          type="button"
          onClick={() => void run(text)}
          disabled={loading || text.trim().length < MIN_LENGTH}
          className="text-xs text-brand-700 hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> analisando…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> reanalisar
            </span>
          )}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {text.trim().length < MIN_LENGTH
          ? `Escreve pelo menos ${MIN_LENGTH} caracteres pra eu começar a revisar.`
          : "Atualiza sozinho a cada 2-3s depois que você para de digitar."}
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {hasReview && (
        <>
          {/* Voice match */}
          <div className="mt-4 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Soa como você?
              </p>
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  score >= 85
                    ? "text-emerald-600"
                    : score >= 65
                      ? "text-brand-700"
                      : "text-amber-600"
                )}
              >
                {score}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full transition-all",
                  score >= 85
                    ? "bg-emerald-500"
                    : score >= 65
                      ? "bg-brand-500"
                      : "bg-amber-500"
                )}
                style={{ width: `${score}%` }}
              />
            </div>
            {review.voice_notes && (
              <p className="mt-2 text-xs text-muted-foreground">
                {review.voice_notes}
              </p>
            )}
          </div>

          {/* Issues */}
          {review.issues.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {review.issues.map((it, i) => {
                const { icon: Icon, cls } = SEVERITY_ICON[it.severity];
                return (
                  <li
                    key={i}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cls)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-medium">
                            {KIND_LABELS[it.kind] ?? it.kind}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              it.severity === "error"
                                ? "bg-destructive/10 text-destructive"
                                : it.severity === "warn"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-secondary text-foreground"
                            )}
                          >
                            {SEVERITY_LABEL[it.severity] ?? it.severity}
                          </span>
                        </div>
                        <p className="mt-1.5 rounded-md bg-secondary/40 p-2 font-mono text-[11px] leading-snug text-foreground/80">
                          “{it.excerpt}”
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {it.message}
                        </p>
                        {it.suggestion && (
                          <p className="mt-1.5 rounded-md border border-brand-200 bg-brand-50/50 p-2 text-xs text-brand-900">
                            <span className="font-medium">Sugestão:</span>{" "}
                            {it.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Limpo. Pode publicar.
            </div>
          )}
        </>
      )}
    </div>
  );
}
