"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, Star, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client-fetch";
import type { ContentDraft, ContentFeedback } from "@/lib/db/types";

const RATING_LABELS: Record<number, string> = {
  1: "Ficou ruim",
  2: "Precisa muito trabalho",
  3: "Ok, mas dá pra melhorar",
  4: "Ficou bom",
  5: "Ficou exatamente como queria",
};

interface FeedbackPanelProps {
  draftId: string;
  /**
   * Callback opcional — quando o líder clica em "Refazer aplicando o
   * aprendizado" (gatilho ativo de feedback negativo), o editor recebe
   * o draft revisado pra atualizar o estado local.
   */
  onRevised?: (draft: ContentDraft) => void;
}

export function FeedbackPanel({ draftId, onRevised }: FeedbackPanelProps) {
  const [existing, setExisting] = useState<ContentFeedback | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Estado do "refazer aplicando o aprendizado"
  const [showRetry, setShowRetry] = useState(false);
  const [revising, setRevising] = useState(false);
  const [retriedDone, setRetriedDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/content/${draftId}/feedback`);
        if (res.ok) {
          const data = await res.json();
          if (data.feedback) {
            setExisting(data.feedback);
            setRating(data.feedback.rating);
            setComment(data.feedback.comment ?? "");
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId]);

  async function submit() {
    if (!rating) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setRetriedDone(false);
    const res = await apiFetch<{ feedback: ContentFeedback }>(
      `/api/content/${draftId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      }
    );
    setBusy(false);
    if (res.ok) {
      setExisting(res.data.feedback);
      setSaved(true);
      // Gatilho ativo: feedback negativo (1-3) + comentário >= 8 chars
      // → mostra CTA pra refazer aplicando o que foi dito
      if (rating <= 3 && comment.trim().length >= 8) {
        setShowRetry(true);
      } else {
        setShowRetry(false);
      }
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(res.error);
    }
  }

  async function retryWithFeedback() {
    // Usa o comentário SALVO (existing.comment) em vez do estado local
    // — se o líder editou o textarea entre o submit e o clique, o retry
    // ainda usa o que foi gravado no feedback.
    const savedComment = (existing?.comment ?? comment).trim();
    const savedRating = existing?.rating ?? rating;
    if (!savedComment || !onRevised || !savedRating) return;
    setRevising(true);
    setError(null);
    const res = await apiFetch<{ draft: ContentDraft }>(
      "/api/content/revise",
      {
        method: "POST",
        body: JSON.stringify({
          draft_id: draftId,
          instructions: `Apliquei esse feedback (nota ${savedRating}/5): "${savedComment}". Reescreve o texto inteiro corrigindo esses pontos. Mantém o tema e o tamanho aproximado.`,
        }),
      }
    );
    setRevising(false);
    if (res.ok) {
      onRevised(res.data.draft);
      setShowRetry(false);
      setRetriedDone(true);
      setTimeout(() => setRetriedDone(false), 4500);
    } else {
      setError(res.error);
    }
  }

  const display = hover ?? rating ?? 0;
  const hasFeedback = !!existing;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm transition-colors",
        // sem feedback ainda → destaca em amber pra pedir atenção;
        // já tem feedback → volta pra brand-200 (info, não-call-to-action)
        hasFeedback
          ? "border-brand-200"
          : "border-amber-300 bg-amber-50/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-xl",
              hasFeedback
                ? "bg-brand-50 text-brand-700"
                : "bg-amber-100 text-amber-700"
            )}
          >
            <Star
              className={cn(
                "h-4 w-4",
                hasFeedback && "fill-current"
              )}
            />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Como ficou esse texto?</h3>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {hasFeedback ? "Feedback enviado" : "1 minuto · vira aprendizado"}
            </p>
          </div>
        </div>
        {hasFeedback && (
          <Check className="h-4 w-4 shrink-0 text-brand-600" />
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Sua nota vira aprendizado pro motor — ele lembra disso na próxima
        geração.
      </p>

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {/* Estrelas */}
          <div className="mt-4 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setRating(n)}
                className="rounded-md p-1 transition-transform hover:scale-110"
                aria-label={`${n} estrela${n === 1 ? "" : "s"}`}
              >
                <Star
                  className={cn(
                    "h-7 w-7 transition-colors",
                    n <= display
                      ? "fill-brand-500 text-brand-500"
                      : "text-muted-foreground/40"
                  )}
                />
              </button>
            ))}
            {display > 0 && (
              <span className="ml-3 text-xs font-medium text-muted-foreground">
                {RATING_LABELS[display]}
              </span>
            )}
          </div>

          {/* Comentário opcional */}
          {rating !== null && (
            <div className="mt-4 animate-fade-up">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Comentário (opcional, mas ajuda muito)
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  rating >= 4
                    ? "O que funcionou? Ex: 'gostei do hook com o número', 'mantém parágrafos curtos'"
                    : "O que mudou? Ex: 'sem pergunta retórica no final', 'mais bastidor menos análise'"
                }
                rows={3}
                className="mt-2"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[10px] text-muted-foreground">
                  {existing
                    ? "Editando feedback. Salvar atualiza."
                    : "1 feedback por conteúdo. Edite quando quiser."}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  disabled={busy || !rating}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
                    </>
                  ) : saved ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Salvo
                    </>
                  ) : existing ? (
                    "Atualizar feedback"
                  ) : (
                    "Enviar feedback"
                  )}
                </Button>
              </div>
            </div>
          )}

          {saved && !showRetry && !retriedDone && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              Salvo. O motor está reaprendendo seu padrão em background. As
              próximas gerações já consideram esse feedback.
            </div>
          )}

          {/* GATILHO ATIVO — aparece após feedback negativo com comentário */}
          {showRetry && onRevised && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Wand2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    Quer que eu refaça aplicando esse feedback?
                  </p>
                  <p className="mt-1 text-xs leading-snug text-amber-900/80">
                    Vou reescrever o texto inteiro corrigindo o que você
                    apontou no comentário. Mantém o tema e o tamanho.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={retryWithFeedback}
                      disabled={revising}
                    >
                      {revising ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Refazendo…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Refazer aplicando
                        </>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowRetry(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Agora não
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {retriedDone && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              <strong>Texto reescrito.</strong> Sobe pro topo e olha como
              ficou. Se ainda tiver coisa pra ajustar, dá novo feedback ou
              usa o "Pedir ajuste" do aside.
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
