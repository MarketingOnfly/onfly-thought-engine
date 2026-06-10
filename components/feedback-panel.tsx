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

/**
 * Chips de problemas comuns — viram tags estruturadas no feedback.
 * Sinal MUITO mais acionável pro aprendizado que comentário livre:
 * "jargao" marcado 3x = padrão claro; "achei meio técnico" no texto
 * livre = ambíguo.
 */
const FEEDBACK_TAGS: { key: string; label: string }[] = [
  { key: "cara_de_ia", label: "Cara de IA" },
  { key: "inventou_fato", label: "Inventou fato" },
  { key: "ignorou_material", label: "Ignorou material" },
  { key: "jargao", label: "Jargão demais" },
  { key: "sem_historia", label: "Sem história" },
  { key: "hook_fraco", label: "Hook fraco" },
  { key: "tom_errado", label: "Tom não é meu" },
  { key: "muito_longo", label: "Muito longo" },
  { key: "muito_curto", label: "Muito curto" },
  { key: "generico", label: "Genérico" },
];

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
  onRevised?: (draft: ContentDraft) => void;
}

/**
 * Painel UNIFICADO de feedback + refino — versão 2 (colapsada).
 *
 * Antes: 2 textareas separadas (comentário do feedback + texto livre do
 * refino). Faziam a MESMA coisa funcional — descrever o que mudar. Vini
 * pediu pra unificar.
 *
 * Agora: 1 só textarea. A nota (estrelas) é opcional acima.
 * Atalhos (+Ousado/+Sóbrio/↻Refazer) sempre visíveis como alternativa.
 *
 * CTA principal adapta baseado no estado de (rating, texto):
 *   - Só rating, sem texto: "Salvar feedback"
 *   - Só texto: "Aplicar ajuste"
 *   - Rating 1-3 + texto: "Salvar e refazer aplicando" (combina os 2)
 *   - Rating 4-5 + texto: "Salvar feedback" (positivo, não força refazer)
 */
export function FeedbackPanel({ draftId, onRevised }: RefinePanelProps) {
  const [existing, setExisting] = useState<ContentFeedback | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);

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
            setText(data.feedback.comment ?? "");
            setTags(
              Array.isArray(data.feedback.tags) ? data.feedback.tags : []
            );
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId]);

  async function saveFeedback(): Promise<ContentFeedback | null> {
    if (!rating) return null;
    setSavingFeedback(true);
    setError(null);
    setFeedbackSaved(false);
    const res = await apiFetch<{ feedback: ContentFeedback }>(
      `/api/content/${draftId}/feedback`,
      {
        method: "POST",
        body: JSON.stringify({ rating, comment: text.trim() || null, tags }),
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

  async function applyRefine(instructions: string) {
    if (!onRevised) return;
    setRefining(true);
    setError(null);
    const res = await apiFetch<{ draft: ContentDraft }>(
      "/api/content/revise",
      {
        method: "POST",
        body: JSON.stringify({
          draft_id: draftId,
          instructions,
        }),
      }
    );
    setRefining(false);
    if (res.ok) {
      onRevised(res.data.draft);
      setRefinedDone(true);
      setText("");
      setTimeout(() => setRefinedDone(false), 4500);
    } else {
      setError(res.error);
    }
  }

  /**
   * Ação principal — adaptativa baseada em estado (rating, text).
   * 4 caminhos:
   *  - rating + texto + nota baixa (1-3): salva feedback + refaz com texto
   *  - rating + texto + nota alta (4-5): salva feedback (não refaz)
   *  - só rating: salva feedback
   *  - só texto (sem rating): aplica ajuste
   */
  async function handleMainAction() {
    const hasText = text.trim().length >= 5;
    const hasTags = tags.length > 0;
    const hasRating = rating !== null;

    // Tags marcadas viram instrução legível pro refazer
    const tagInstructions = tags
      .map((t) => FEEDBACK_TAGS.find((f) => f.key === t)?.label ?? t)
      .join("; ");

    if (hasRating && (hasText || hasTags) && rating! <= 3 && onRevised) {
      // Combina: salva feedback (com tags) + refaz com texto + tags
      const saved = await saveFeedback();
      if (!saved) return;
      const parts = [
        `Apliquei esse feedback (nota ${saved.rating}/5)`,
        hasTags ? `Problemas marcados: ${tagInstructions}.` : "",
        hasText ? `Comentário: "${text.trim()}".` : "",
        "Reescreve o texto inteiro corrigindo esses pontos. Mantém o tema e o tamanho aproximado.",
      ].filter(Boolean);
      await applyRefine(parts.join(" "));
    } else if (hasRating) {
      // Só salva feedback (com ou sem texto positivo)
      await saveFeedback();
    } else if ((hasText || hasTags) && onRevised) {
      // Só refina (sem nota)
      const parts = [
        hasTags ? `Corrige estes problemas: ${tagInstructions}.` : "",
        text.trim(),
      ].filter(Boolean);
      await applyRefine(parts.join(" "));
    }
  }

  async function clickPreset(key: keyof typeof PRESET_INSTRUCTIONS) {
    await applyRefine(PRESET_INSTRUCTIONS[key]);
  }

  const display = hover ?? rating ?? 0;
  const hasFeedback = !!existing;
  // "Sinal" de ajuste = texto livre OU chips marcados. Os dois alimentam
  // a instrução de refazer.
  const hasText = text.trim().length >= 5 || tags.length > 0;
  const hasRating = rating !== null;
  const busy = savingFeedback || refining;

  // Determina o CTA principal baseado no estado
  const mainCta: {
    label: string;
    icon: typeof Sparkles;
    enabled: boolean;
    variant: "primary" | "ghost";
  } = (() => {
    if (hasRating && hasText && rating! <= 3 && onRevised) {
      return {
        label: refining ? "Refazendo…" : savingFeedback ? "Salvando…" : "Salvar e refazer aplicando",
        icon: Sparkles,
        enabled: !busy,
        variant: "primary",
      };
    }
    if (hasRating) {
      return {
        label: savingFeedback ? "Salvando…" : feedbackSaved ? "Salvo" : existing ? "Atualizar feedback" : "Salvar feedback",
        icon: feedbackSaved ? Check : Star,
        enabled: !busy,
        variant: "primary",
      };
    }
    if (hasText && onRevised) {
      return {
        label: refining ? "Aplicando…" : "Aplicar ajuste",
        icon: Wand2,
        enabled: !busy,
        variant: "primary",
      };
    }
    return {
      label: "Dê uma nota ou descreva o que mudar",
      icon: Star,
      enabled: false,
      variant: "ghost",
    };
  })();

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm transition-colors",
        hasFeedback ? "border-brand-200" : "border-amber-300 bg-amber-50/30"
      )}
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-xl",
              hasFeedback ? "bg-brand-50 text-brand-700" : "bg-amber-100 text-amber-700"
            )}
          >
            <Star className={cn("h-4 w-4", hasFeedback && "fill-current")} />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Avaliar e refinar</h3>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {hasFeedback ? "Feedback enviado" : "Nota + texto vira aprendizado"}
            </p>
          </div>
        </div>
        {hasFeedback && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Dê uma nota e/ou descreva o que mudar. Se a nota for baixa e o texto
        explicar o ajuste, um clique faz as duas coisas.
      </p>

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {/* ESTRELAS (opcionais) */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Nota (opcional)
            </p>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="rounded-md p-1 transition-transform hover:scale-110"
                  aria-label={`${n} estrela${n === 1 ? "" : "s"}`}
                >
                  <Star
                    className={cn(
                      "h-6 w-6 transition-colors",
                      n <= display
                        ? "fill-brand-500 text-brand-500"
                        : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
              {display > 0 && (
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  {RATING_LABELS[display]}
                </span>
              )}
            </div>
          </div>

          {/* CHIPS DE PROBLEMAS — viram tags estruturadas pro aprendizado */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              O que pegou? (marca os que se aplicam — vira aprendizado direto)
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FEEDBACK_TAGS.map((t) => {
                const active = tags.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() =>
                      setTags((prev) =>
                        active
                          ? prev.filter((x) => x !== t.key)
                          : [...prev, t.key]
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border bg-background text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TEXTAREA ÚNICO */}
          <div className="mt-4">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {hasRating
                ? rating! >= 4
                  ? "O que funcionou? (vira aprendizado)"
                  : "O que mudar? (vira instrução de refazer)"
                : "O que mudar / o que funcionou?"}
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                hasRating && rating! >= 4
                  ? "Ex: 'gostei do hook com número', 'mantém parágrafos curtos'"
                  : "Ex: 'hook mais ácido', 'sem pergunta retórica no fim', 'mais bastidor menos análise'"
              }
              rows={3}
              className="mt-2"
            />
          </div>

          {/* CTA PRINCIPAL */}
          <Button
            variant={mainCta.variant}
            size="sm"
            onClick={handleMainAction}
            disabled={!mainCta.enabled}
            className="mt-3 w-full"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <mainCta.icon className="h-3.5 w-3.5" />
            )}
            {mainCta.label}
          </Button>

          {/* Opção secundária: salvar feedback sem refazer (só aparece no caso negativo + texto) */}
          {hasRating && hasText && rating! <= 3 && onRevised && (
            <button
              type="button"
              onClick={async () => {
                await saveFeedback();
              }}
              disabled={busy}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Apenas salvar feedback (sem refazer)
            </button>
          )}

          {feedbackSaved && !refinedDone && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              Salvo. O motor está reaprendendo seu padrão em background.
            </div>
          )}

          {refinedDone && (
            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
              <strong>Texto reescrito.</strong> Sobe pro topo e olha como
              ficou.
            </div>
          )}

          {/* ATALHOS — sempre visíveis abaixo, separador sutil */}
          {onRevised && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Atalhos de refino (1 clique, sem precisar escrever)
              </p>
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
            </div>
          )}

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
