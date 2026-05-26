"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client-fetch";
import type { ContentFeedback } from "@/lib/db/types";

const RATING_LABELS: Record<number, string> = {
  1: "Ficou ruim",
  2: "Precisa muito trabalho",
  3: "Ok, mas dá pra melhorar",
  4: "Ficou bom",
  5: "Ficou exatamente como queria",
};

export function FeedbackPanel({ draftId }: { draftId: string }) {
  const [existing, setExisting] = useState<ContentFeedback | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(res.error);
    }
  }

  const display = hover ?? rating ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-medium">Como ficou esse texto?</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Sua nota e comentário viram aprendizado pro motor — ele lembra disso na
        próxima geração.
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

          {saved && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              Salvo. O motor está reaprendendo seu padrão em background. As
              próximas gerações já consideram esse feedback.
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
