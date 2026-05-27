"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Brain,
  ChevronDown,
  Loader2,
  MessageSquareWarning,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate, initials, truncate } from "@/lib/utils";

interface LeaderSummary {
  user_id: string;
  full_name: string;
  role: string | null;
  area: string | null;
  avatar_url: string | null;
  learned_preferences: string | null;
  feedback_count: number;
  avg_rating: number | null;
  positive_count: number;
  negative_count: number;
  recent_examples: {
    feedback_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    draft_id: string;
    draft_topic: string | null;
    draft_format: string | null;
    draft_excerpt: string | null;
  }[];
}

interface NegativeFeedback {
  feedback_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  leader_name: string;
  leader_user_id: string;
  draft_id: string;
  draft_topic: string | null;
}

interface Summary {
  global: {
    total_feedbacks: number;
    avg_rating: number | null;
    positive_rate: number;
    negative_rate: number;
    active_leaders: number;
    leaders_with_feedback: number;
  };
  leaders: LeaderSummary[];
  recent_negatives: NegativeFeedback[];
}

export default function LearningPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/learning-summary");
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Falha ao carregar");
          return;
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando aprendizado…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="mr-2 inline h-4 w-4" /> {error ?? "Sem dados"}
      </div>
    );
  }

  const { global: g, leaders, recent_negatives } = data;
  const avgRatingDisplay =
    g.avg_rating != null ? g.avg_rating.toFixed(2) : "—";

  return (
    <div className="mt-6 space-y-6">
      {/* GLOBAL — visão de cima */}
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl tracking-tight">
          <Sparkles className="h-4 w-4 text-brand-600" />
          Visão global do aprendizado
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Compilado de todos os feedbacks dos líderes ativos.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <StatCard
            label="Feedbacks totais"
            value={String(g.total_feedbacks)}
            icon={MessageSquareWarning}
            hint={`${g.leaders_with_feedback}/${g.active_leaders} líderes engajados`}
          />
          <StatCard
            label="Nota média global"
            value={avgRatingDisplay}
            icon={Star}
            hint={
              g.avg_rating == null
                ? "sem dados"
                : g.avg_rating >= 4
                  ? "Boa"
                  : g.avg_rating >= 3
                    ? "Razoável"
                    : "Ruim"
            }
          />
          <StatCard
            label="% positivos (4-5)"
            value={`${Math.round(g.positive_rate * 100)}%`}
            icon={TrendingUp}
            hint="quanto mais alto, melhor"
            tone={g.positive_rate >= 0.6 ? "positive" : "neutral"}
          />
          <StatCard
            label="% negativos (1-2)"
            value={`${Math.round(g.negative_rate * 100)}%`}
            icon={TrendingDown}
            hint="quanto mais baixo, melhor"
            tone={g.negative_rate >= 0.2 ? "negative" : "neutral"}
          />
        </div>
      </section>

      {/* RECENT NEGATIVES — sinal de o que tá atrapalhando agora */}
      {recent_negatives.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/40 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            Últimos feedbacks negativos
            <Badge variant="outline" className="text-[10px]">
              {recent_negatives.length}
            </Badge>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Comentários com nota 1-2 que apontam o que o motor errou.
            Padrões aqui são insumo pra você refinar prompts globais
            (HUMANIZER_RULES, POST_GUIDELINES, etc.).
          </p>
          <ul className="mt-4 space-y-2">
            {recent_negatives.map((n) => (
              <li
                key={n.feedback_id}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-destructive">
                    {Array.from({ length: n.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3 w-3 fill-destructive text-destructive"
                      />
                    ))}
                  </span>
                  <Link
                    href={`/admin/leaders/${n.leader_user_id}`}
                    className="font-medium text-foreground hover:text-brand-700"
                  >
                    {n.leader_name}
                  </Link>
                  {n.draft_topic && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <Link
                        href={`/dashboard/content/${n.draft_id}`}
                        className="truncate text-muted-foreground hover:text-foreground"
                      >
                        {truncate(n.draft_topic, 60)}
                      </Link>
                    </>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {formatDate(n.created_at)}
                  </span>
                </div>
                {n.comment && (
                  <p className="mt-2 rounded-lg bg-secondary/40 p-2 text-xs leading-snug text-foreground/85">
                    &ldquo;{n.comment}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* PER-LEADER — aprendizado individual com exemplos */}
      <section>
        <h2 className="flex items-center gap-2 font-display text-xl tracking-tight">
          <Users className="h-4 w-4 text-brand-600" />
          Aprendizado por líder
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O que o motor capturou sobre cada líder a partir dos feedbacks
          dele. Esse texto entra no system prompt SÓ daquele líder —
          aprendizado é isolado entre contas.
        </p>

        <div className="mt-4 space-y-3">
          {leaders.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
              Nenhum líder com onboarding completo ainda.
            </div>
          )}
          {leaders.map((l) => {
            const isOpen = !!expanded[l.user_id];
            const ratingColor =
              l.avg_rating == null
                ? "text-muted-foreground"
                : l.avg_rating >= 4
                  ? "text-emerald-700"
                  : l.avg_rating >= 3
                    ? "text-amber-700"
                    : "text-destructive";
            return (
              <article
                key={l.user_id}
                className="rounded-2xl border border-border bg-card shadow-sm"
              >
                <header
                  className="flex cursor-pointer items-start gap-3 px-5 py-4 transition hover:bg-secondary/30"
                  onClick={() =>
                    setExpanded((m) => ({ ...m, [l.user_id]: !isOpen }))
                  }
                >
                  {l.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.avatar_url}
                      alt={l.full_name}
                      className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-medium text-white">
                      {initials(l.full_name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium">{l.full_name}</h3>
                      {l.role && (
                        <Badge variant="outline" className="text-[10px]">
                          {l.role}
                        </Badge>
                      )}
                      {l.area && (
                        <Badge variant="soft" className="text-[10px]">
                          {l.area}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="text-foreground">
                          {l.feedback_count}
                        </strong>{" "}
                        feedbacks
                      </span>
                      <span>
                        média{" "}
                        <strong className={cn("font-mono", ratingColor)}>
                          {l.avg_rating == null
                            ? "—"
                            : l.avg_rating.toFixed(1)}
                        </strong>
                      </span>
                      <span className="text-emerald-700">
                        ↑ {l.positive_count}
                      </span>
                      <span className="text-destructive">
                        ↓ {l.negative_count}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </header>

                {isOpen && (
                  <div className="space-y-4 border-t border-border px-5 py-4">
                    {/* Learned preferences */}
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-brand-700">
                        <Brain className="h-3 w-3" />
                        O que o motor aprendeu sobre o estilo dele/dela
                      </p>
                      {l.learned_preferences ? (
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-3 font-sans text-xs leading-relaxed text-foreground/90">
                          {l.learned_preferences}
                        </pre>
                      ) : (
                        <p className="mt-2 rounded-xl border border-dashed border-border bg-secondary/20 p-3 text-xs italic text-muted-foreground">
                          Ainda sem aprendizado registrado. Precisa de pelo
                          menos 2-3 feedbacks com comentário pra o motor
                          sintetizar padrões.
                        </p>
                      )}
                    </div>

                    {/* Exemplos recentes */}
                    {l.recent_examples.length > 0 && (
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <MessageSquareWarning className="h-3 w-3" />
                          Últimos feedbacks ({l.recent_examples.length})
                        </p>
                        <ul className="mt-2 space-y-2">
                          {l.recent_examples.map((ex) => {
                            const tone =
                              ex.rating >= 4
                                ? "border-brand-200 bg-brand-50/40"
                                : ex.rating <= 2
                                  ? "border-amber-300 bg-amber-50/40"
                                  : "border-border bg-secondary/30";
                            return (
                              <li
                                key={ex.feedback_id}
                                className={cn(
                                  "rounded-xl border p-3",
                                  tone
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="inline-flex items-center gap-0.5">
                                    {Array.from({
                                      length: ex.rating,
                                    }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className={cn(
                                          "h-3 w-3 fill-current",
                                          ex.rating >= 4
                                            ? "text-brand-500"
                                            : ex.rating <= 2
                                              ? "text-destructive"
                                              : "text-amber-500"
                                        )}
                                      />
                                    ))}
                                  </span>
                                  {ex.draft_topic && (
                                    <Link
                                      href={`/dashboard/content/${ex.draft_id}`}
                                      className="truncate font-medium hover:text-brand-700"
                                    >
                                      {truncate(ex.draft_topic, 70)}
                                    </Link>
                                  )}
                                  {ex.draft_format && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {ex.draft_format === "linkedin_post"
                                        ? "Post"
                                        : "Artigo"}
                                    </Badge>
                                  )}
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    {formatDate(ex.created_at)}
                                  </span>
                                </div>
                                {ex.comment && (
                                  <p className="mt-2 text-xs leading-snug text-foreground/85">
                                    &ldquo;{ex.comment}&rdquo;
                                  </p>
                                )}
                                {ex.draft_excerpt && (
                                  <p className="mt-2 truncate rounded-lg bg-background/60 p-2 font-mono text-[10px] text-muted-foreground">
                                    {ex.draft_excerpt}…
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {l.recent_examples.length === 0 && (
                      <p className="text-xs italic text-muted-foreground">
                        Nenhum feedback registrado ainda.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Star;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneColor =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={cn("mt-2 font-display text-2xl tracking-tight", toneColor)}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
