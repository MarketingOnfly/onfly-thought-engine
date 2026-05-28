"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
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

const PRESET_INSTRUCTIONS: Record<string, string> = {
  ousado:
    "Mantém a tese mas torna o texto mais ousado e provocador. Hook mais ácido. Fechamento que aposta numa visão de futuro. Cortar qualquer floreio que sobrar.",
  sobrio:
    "Mantém a tese mas torna o texto mais sóbrio e analítico. Cortar adjetivos fortes. Mais dado, menos opinião. Linguagem de operador, sem provocação direta.",
  refazer:
    "Refaz o texto do zero, mantendo apenas o tema e a tese central. Estrutura, hook, exemplo e fechamento todos diferentes, outro caminho narrativo.",
};

interface RefinePanelProps {
  draftId: string;
  /**
   * Callback do parent (editor) — recebe o draft atualizado após revisão.
   */
  onRevised?: (draft: ContentDraft) => void;
}

/**
 * Painel UNIFICADO de feedback + ajuste.
 *
 * Antes: 2 cards separados no aside (Pedir ajuste + Feedback). A reclamação
 * que virava ajuste era quase sempre A MESMA coisa que ia no feedback.
 * Líder digitava duas vezes.
 *
 * Agora: 1 card só com fluxo que combina:
 * - Avaliação: estrelas + comentário (vira aprendizado pro perfil)
 * - Refino: atalhos rápidos (+Ousado, +Sóbrio, ↻Refazer) + textarea livre
 * - CTA inteligente baseado no estado:
 *   - Rating 1-3 + comentário → "Salvar e refazer aplicando"
 *   - Rating 4-5 → "Salvar feedback" (não força refazer, foi bom)
 *   - Sem rating, com instrução de ajuste → "Aplicar ajuste"
 *   - Sem rating, sem instrução → CTA desabilitado
 */
export function FeedbackPanel({ draftId, onRevised }: RefinePanelProps) {
  // Estado do feedback (avaliação)
  const [existing, setExisting] = useState<ContentFeedback | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  // Estado do refino (ajuste livre)
  const [refineText, setRefineText] = useState("");

  // Estado de operações
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [refining, setRefining] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [refinedDone, setRefinedDone] = useState(false);
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

  /**
   * Salva o feedback no banco e devolve o feedback recém-salvo
   * (pra poder usar logo em seguida no refine).
   */
  async function saveFeedback(): Promise<ContentFeedback | null> {
    if (!rating) return null;
    setSavingFeedback(true);
    setError(null);
    setFeedbackSaved(false);
    const res = await apiFetch<{ feedback: ContentFeedback }>(
      `/api/content/${draftId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      }
    );
    setSavingFeedback(false);
    if (res.ok) {
      setExisting(res.data.feedback);
      setFeedbackSaved(true);
      setTimeout(() => setFeedbackSaved(false), 3000);
      return res.data.feedback;
    } else {
      setError(res.error);
      return null;
    }
  }

  /**
   * Dispara a revisão do texto. Aceita instruções de:
   * - preset (atalho clicado)
   * - feedback negativo (rating <= 3 + comment) — usa o comentário
   * - texto livre (refineText)
   */
  async function applyRefine(opts: {
    instructions: string;
    contextLabel?: string;
  }) {
    if (!onRevised) return;
    setRefining(true);
    setError(null);
    const res = await apiFetch<{ draft: ContentDraft }>(
      "/api/content/revise",
      {
        method: "POST",
        body: JSON.stringify({
          draft_id: draftId,
          instructions: opts.instructions,
        }),
      }
    );
    setRefining(false);
    if (res.ok) {
      onRevised(res.data.draft);
      setRefinedDone(true);
      setRefineText("");
      setTimeout(() => setRefinedDone(false), 4500);
    } else {
      setError(res.error);
    }
  }

  /**
   * Salva feedback + refaz aplicando o comentário negativo.
   * Combina os 2 fluxos num só clique pra rating 1-3 com comentário.
   */
  async function saveFeedbackAndRefine() {
    const saved = await saveFeedback();
    if (!saved || !saved.comment || !saved.rating || !onRevised) return;
    await applyRefine({
      instructions: `Apliquei esse feedback (nota ${saved.rating}/5): "${saved.comment}". Reescreve o texto inteiro corrigindo esses pontos. Mantém o tema e o tamanho aproximado.`,
      contextLabel: "feedback",
    });
  }

  async function clickPreset(key: keyof typeof PRESET_INSTRUCTIONS) {
    await applyRefine({
      instructions: PRESET_INSTRUCTIONS[key],
      contextLabel: key,
    });
  }

  async function clickApplyFreeText() {
    if (refineText.trim().length < 5) return;
    await applyRefine({ instructions: refineText.trim() });
  }

  const display = hover ?? rating ?? 0;
  const hasFeedback = !!existing;
  const isNegativeWithComment =
    rating !== null && rating <= 3 && comment.trim().length >= 8;
  const isPositive = rating !== null && rating >= 4;
  const hasFreeText = refineText.trim().length >= 5;
  const busy = savingFeedback || refining;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm transition-colors",
        hasFeedback
          ? "border-brand-200"
          : "border-amber-300 bg-amber-50/30"
      )}
    >
      {/* HEADER */}
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
            <Star className={cn("h-4 w-4", hasFeedback && "fill-current")} />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Avaliar e refinar</h3>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {hasFeedback ? "Feedback enviado" : "1 minuto · vira aprendizado"}
            </p>
          </div>
        </div>
        {hasFeedback && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Nota + comentário viram aprendizado pro motor. Se a nota for baixa,
        dá pra refazer com esse feedback aplicado no mesmo botão.
      </p>

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {/* ESTRELAS */}
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

          {/* COMENTÁRIO (aparece ao escolher rating) */}
          {rating !== null && (
            <div className="mt-4 animate-fade-up">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {rating <= 3
                  ? "O que mudou? (vira instrução de refazer)"
                  : "O que funcionou? (opcional, vira aprendizado)"}
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  rating >= 4
                    ? "Ex: 'gostei do hook com o número', 'mantém parágrafos curtos'"
                    : "Ex: 'sem pergunta retórica no final', 'mais bastidor menos análise'"
                }
                rows={3}
                className="mt-2"
              />

              {/* CTA principal — adaptativo */}
              <div className="mt-3 flex flex-col gap-2">
                {isNegativeWithComment && onRevised ? (
                  // Caminho negativo: 1 botão faz feedback + refaz
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveFeedbackAndRefine}
                      disabled={busy}
                      className="w-full"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {refining ? "Refazendo…" : "Salvando…"}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Salvar e refazer aplicando
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await saveFeedback();
                      }}
                      disabled={busy}
                      className="w-full"
                    >
                      Apenas salvar feedback (sem refazer)
                    </Button>
                  </>
                ) : (
                  // Caminho positivo ou sem comentário: só salva feedback
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveFeedback}
                    disabled={busy || !rating}
                    className="w-full"
                  >
                    {savingFeedback ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Salvando…
                      </>
                    ) : feedbackSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Salvo
                      </>
                    ) : existing ? (
                      "Atualizar feedback"
                    ) : (
                      "Salvar feedback"
                    )}
                  </Button>
                )}
                {isPositive && comment.trim().length >= 8 && (
                  <p className="text-[10px] text-muted-foreground">
                    Nota alta + comentário positivo vira reforço de padrão.
                    Sem refazer.
                  </p>
                )}
              </div>
            </div>
          )}

          {feedbackSaved && !refinedDone && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              Salvo. O motor está reaprendendo seu padrão em background.
            </div>
          )}

          {refinedDone && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              <strong>Texto reescrito.</strong> Sobe pro topo e olha como
              ficou. Pode dar novo feedback se ainda tiver ajuste.
            </div>
          )}

          {/* SEPARADOR */}
          {onRevised && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Refino rápido (sem precisar dar nota)
              </p>

              {/* ATALHOS */}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => clickPreset("ousado")}
                  disabled={busy}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition hover:border-brand-400 hover:bg-secondary disabled:opacity-50"
                  title="Hook mais ácido, aposta mais forte"
                >
                  + Ousado
                </button>
                <button
                  type="button"
                  onClick={() => clickPreset("sobrio")}
                  disabled={busy}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition hover:border-brand-400 hover:bg-secondary disabled:opacity-50"
                  title="Mais analítico e contido"
                >
                  + Sóbrio
                </button>
                <button
                  type="button"
                  onClick={() => clickPreset("refazer")}
                  disabled={busy}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition hover:border-brand-400 hover:bg-secondary disabled:opacity-50"
                  title="Mesma tese, outro caminho"
                >
                  ↻ Refazer
                </button>
              </div>

              {/* TEXTAREA LIVRE */}
              <div className="mt-3">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Ou diga o que mudar (texto livre)
                </label>
                <Textarea
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  placeholder="Ex: hook mais ácido. tira a citação do fim. quero um número no 2º parágrafo."
                  rows={3}
                  className="mt-2"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={clickApplyFreeText}
                  disabled={busy || !hasFreeText}
                  className="mt-2 w-full"
                >
                  {refining ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Aplicando…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      Aplicar ajuste
                    </>
                  )}
                </Button>
              </div>
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
