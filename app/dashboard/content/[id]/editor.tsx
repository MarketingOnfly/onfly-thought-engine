"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  GitBranch,
  Grid3x3,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Linkedin,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Markdown, PlainPost } from "@/components/markdown";
import { InfographicRenderer } from "@/components/visual-renderer";
import { ReviewPanel } from "@/components/review-panel";
import { FeedbackPanel } from "@/components/feedback-panel";
import {
  StyleScoreChip,
  StyleScoreDetails,
  useStyleScore,
} from "@/components/style-score-card";
import { LinkedInPreview } from "@/components/linkedin-preview";
import { VariationsTabs } from "@/components/variations-tabs";
import { VersionsHistory } from "@/components/versions-history";
import type {
  AltVersion,
  ContentDraft,
  ContentVisual,
  StyleScore,
} from "@/lib/db/types";
import { cn, formatDate, slugify } from "@/lib/utils";
import { apiFetch } from "@/lib/client-fetch";
import { useConfirm } from "@/components/confirm";

type Archetype =
  | "stats_grid"
  | "process_flow"
  | "comparison"
  | "timeline"
  | "key_insight";

const ARCHETYPES: {
  key: Archetype;
  label: string;
  description: string;
  icon: typeof Grid3x3;
}[] = [
  {
    key: "key_insight",
    label: "Número ou ideia central",
    description: "Um número gigante + uma frase forte.",
    icon: Target,
  },
  {
    key: "stats_grid",
    label: "Grid de KPIs",
    description: "3-6 números chave em cards.",
    icon: Grid3x3,
  },
  {
    key: "process_flow",
    label: "Fluxo / etapas",
    description: "3-5 passos em sequência.",
    icon: GitBranch,
  },
  {
    key: "comparison",
    label: "Antes vs depois",
    description: "Dois lados (mito × realidade).",
    icon: ArrowLeftRight,
  },
  {
    key: "timeline",
    label: "Linha do tempo",
    description: "3-6 marcos em ordem.",
    icon: TrendingUp,
  },
];

type PageTab = "content" | "versions" | "visuals" | "asks";

interface ReviewMeta {
  voice_match_score?: number;
  voice_notes?: string;
}

export default function ContentEditor({
  initial,
  authorName,
  authorRole,
  authorAvatar,
  linkedinReady,
}: {
  initial: ContentDraft;
  authorName: string;
  authorRole: string | null;
  authorAvatar: string | null;
  linkedinReady: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ContentDraft>(initial);
  const [revising, setRevising] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(initial.draft_markdown ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visuals, setVisuals] = useState<ContentVisual[]>([]);
  const [generatingArchetype, setGeneratingArchetype] =
    useState<Archetype | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState(
    initial.scheduled_at ? toLocalInputValue(initial.scheduled_at) : ""
  );
  const [activeVariation, setActiveVariation] = useState(0);
  const [viewMode, setViewMode] = useState<"preview" | "raw">(
    initial.format === "linkedin_post" ? "preview" : "raw"
  );
  const [focusMode, setFocusMode] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("content");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const confirm = useConfirm();

  const isPost = draft.format === "linkedin_post";
  const alts = (draft.alt_versions as AltVersion[] | undefined) ?? [];
  const styleScore = (draft.style_score as StyleScore | null) ?? null;
  const meta = (draft.meta ?? {}) as Record<string, unknown>;
  const reviewMeta = (meta.review ?? null) as ReviewMeta | null;
  const wasSelfRepaired = !!meta.self_repaired;
  const revisions =
    (meta.revisions as { at: string; instructions: string }[] | undefined) ?? [];
  const infographics = visuals.filter((v) => v.kind === "infographic");

  const variationText =
    activeVariation === 0
      ? draft.draft_markdown ?? ""
      : alts[activeVariation - 1]?.body ?? draft.draft_markdown ?? "";
  const display = variationText;

  // Hook compartilhado entre chip (aside) e details (main column).
  // Avalia em tempo real quando muda variação ou texto.
  const styleScoreState = useStyleScore({
    draftId: draft.id,
    initial: activeVariation === 0 ? styleScore : null,
    body: activeVariation === 0 ? null : variationText,
    primaryBody: draft.draft_markdown ?? null,
  });
  const versionLabel =
    alts.length > 0
      ? `Versão ${String.fromCharCode(65 + activeVariation)}`
      : undefined;

  useEffect(() => {
    void loadVisuals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadVisuals() {
    const res = await fetch(`/api/visuals?draft_id=${draft.id}`);
    if (res.ok) {
      const data = await res.json();
      setVisuals(data.items ?? []);
    }
  }

  async function promoteVariation(versionId: string) {
    const res = await apiFetch<{ draft: ContentDraft }>(
      `/api/content/${draft.id}/use-variation`,
      {
        method: "POST",
        body: JSON.stringify({ version_id: versionId }),
      }
    );
    if (res.ok) {
      setDraft(res.data.draft);
      setLocalText(res.data.draft.draft_markdown ?? "");
      setActiveVariation(0);
    }
  }

  async function generateInfographic(archetype: Archetype) {
    setGeneratingArchetype(archetype);
    setError(null);
    const res = await apiFetch<{ visual: ContentVisual }>("/api/visuals", {
      method: "POST",
      body: JSON.stringify({
        draft_id: draft.id,
        topic: draft.topic,
        brief: draft.brief ?? draft.draft_markdown?.slice(0, 600) ?? null,
        kind: "infographic",
        archetype,
      }),
    });
    setGeneratingArchetype(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setVisuals([res.data.visual, ...visuals]);
  }

  async function deleteVisual(id: string) {
    const res = await fetch(`/api/visuals/${id}`, { method: "DELETE" });
    if (res.ok) setVisuals(visuals.filter((v) => v.id !== id));
  }

  async function saveSchedule() {
    const iso = scheduleDraft ? new Date(scheduleDraft).toISOString() : null;
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduled_at: iso }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
    }
  }

  async function clearSchedule() {
    setScheduleDraft("");
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scheduled_at: null }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
    }
  }

  async function revise(presetInstructions?: string) {
    const instructions = presetInstructions ?? revisionPrompt;
    if (instructions.trim().length < 5) return;
    setRevising(true);
    setError(null);
    const res = await apiFetch<{ draft: ContentDraft }>("/api/content/revise", {
      method: "POST",
      body: JSON.stringify({
        draft_id: draft.id,
        instructions,
      }),
    });
    setRevising(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDraft(res.data.draft);
    setLocalText(res.data.draft.draft_markdown ?? "");
    if (!presetInstructions) setRevisionPrompt("");
    // Pra presets, rola pro topo pra o líder ver o texto novo
    if (presetInstructions) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function approve() {
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "approved",
        final_markdown: draft.draft_markdown,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
    }
  }

  async function publish() {
    const text = (draft.draft_markdown ?? "").trim();
    if (!text) return;
    const ok = await confirm({
      title: "Publicar no LinkedIn agora?",
      description: `O texto vai pro seu perfil agora, visível pra todos. ${text.length} caracteres. Tem certeza?`,
      confirmText: "Publicar",
    });
    if (!ok) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/content/${draft.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.error ?? "Falha ao publicar");
        return;
      }
      if (data.draft) {
        setDraft(data.draft);
      } else if (data.url) {
        // edge case: publicou mas não atualizou local
        setDraft((d) => ({
          ...d,
          published_at: new Date().toISOString(),
          linkedin_post_url: data.url,
          linkedin_post_urn: data.urn ?? null,
        }));
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Erro");
    } finally {
      setPublishing(false);
    }
  }

  async function unapprove() {
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
    }
  }

  async function saveManualEdit() {
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ final_markdown: localText }),
    });
    if (res.ok) {
      const data = await res.json();
      setDraft({ ...data.draft, draft_markdown: localText });
      setEditing(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Apagar este conteúdo?",
      description:
        "Some da biblioteca e do calendário. Os infográficos vinculados também somem.",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/content/${draft.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/library");
      router.refresh();
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const isApproved = draft.status === "approved";

  return (
    <div className="mt-4">
      {/* ============================================================
          TOP STRIP — status + ações principais (Aprovar / Apagar)
         ============================================================ */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isPost ? "brand" : "soft"}>
          {isPost ? "Post de LinkedIn" : "Artigo"}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {draft.status}
        </Badge>
        {wasSelfRepaired && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
            title="O motor rodou a auto-revisão e ajustou trechos fracos antes de te mostrar."
          >
            <ShieldCheck className="h-3 w-3" /> Auto-revisado
          </span>
        )}
        {draft.published_at && draft.linkedin_post_url && (
          <a
            href={draft.linkedin_post_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 hover:bg-brand-100"
            title={`Publicado em ${formatDate(draft.published_at)}`}
          >
            <Linkedin className="h-3 w-3" /> Publicado
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        )}
        {draft.published_at && !draft.linkedin_post_url && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
            title="LinkedIn aceitou mas não devolveu URL do post — confere direto no seu perfil"
          >
            <Linkedin className="h-3 w-3" /> Publicado (sem link)
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Atualizado {formatDate(draft.updated_at)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Publicar no LinkedIn — só pra posts, e quando ainda não publicou.
              Se LinkedIn não tá conectado, troca pra link de conexão
              em vez de botão cinza com tooltip escondido. */}
          {isPost && !draft.published_at && linkedinReady && (
            <Button
              variant="primary"
              size="sm"
              onClick={publish}
              disabled={publishing}
              title="Publica direto no seu perfil LinkedIn"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Publicando…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> Publicar
                </>
              )}
            </Button>
          )}
          {isPost && !draft.published_at && !linkedinReady && (
            <Button asChild variant="outline" size="sm">
              <a
                href="/dashboard/analytics"
                title="Conecta o LinkedIn pra liberar publicação"
              >
                <Linkedin className="h-3.5 w-3.5" /> Conectar pra publicar
              </a>
            </Button>
          )}
          {isApproved ? (
            <Button variant="ghost" size="sm" onClick={unapprove}>
              Voltar pra rascunho
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={approve}>
              <Check className="h-3.5 w-3.5" /> Aprovar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={remove}
            title="Apagar"
            aria-label="Apagar"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>

      {publishError && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <Linkedin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Falha ao publicar no LinkedIn</p>
            <p className="mt-0.5">{publishError}</p>
          </div>
          <button
            type="button"
            onClick={() => setPublishError(null)}
            className="text-destructive/70 hover:text-destructive"
          >
            ×
          </button>
        </div>
      )}

      <h1 className="mt-4 font-display text-3xl tracking-tight md:text-4xl">
        {draft.topic}
      </h1>
      {draft.brief && (
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          {draft.brief}
        </p>
      )}

      {/* TAB STRIP — navegação primária da página */}
      {display && !editing && !focusMode && (
        <div className="mt-6 border-b border-border">
          <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto">
            {(
              [
                { key: "content", label: "Conteúdo", icon: FileText },
                {
                  key: "versions",
                  label: "Versões",
                  icon: History,
                  count: undefined,
                },
                {
                  key: "visuals",
                  label: "Infográfico",
                  icon: ImageIcon,
                  count: infographics.length || undefined,
                },
                {
                  key: "asks",
                  label: "Pedidos",
                  icon: LayoutGrid,
                  count: revisions.length || undefined,
                },
              ] as const
            ).map((tab) => {
              const TabIcon = tab.icon;
              const active = pageTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPageTab(tab.key as PageTab)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-brand-500 text-brand-700"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {tab.label}
                  {"count" in tab && tab.count != null && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                        active
                          ? "bg-brand-100 text-brand-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <div
        className={cn(
          "mt-6 grid gap-6",
          focusMode ? "grid-cols-1" : "lg:grid-cols-[1fr_340px]",
          pageTab !== "content" && !editing && !focusMode && "hidden"
        )}
      >
        {/* ============================================================
            MAIN — content card
           ============================================================ */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          {alts.length > 0 && !editing && (
            <VariationsTabs
              primary={draft.draft_markdown ?? ""}
              alternates={alts}
              activeIndex={activeVariation}
              onPick={setActiveVariation}
              onPromote={promoteVariation}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-6 py-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {editing ? "Editando manualmente" : "Rascunho"}
            </h2>
            <div className="flex flex-wrap items-center gap-1">
              {editing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveManualEdit}
                  >
                    Salvar edição
                  </Button>
                </>
              ) : (
                <>
                  {isPost && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setViewMode(viewMode === "preview" ? "raw" : "preview")
                      }
                      title="Trocar visualização"
                    >
                      {viewMode === "preview" ? (
                        <>
                          <FileCode className="h-3.5 w-3.5" /> Texto cru
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Preview LinkedIn
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    Editar texto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copy}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFocusMode((v) => !v)}
                    title={focusMode ? "Sair do modo foco" : "Modo foco"}
                    aria-label={
                      focusMode ? "Sair do modo foco" : "Modo foco"
                    }
                  >
                    {focusMode ? (
                      <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Maximize2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="p-6">
            {display ? (
              editing ? (
                <Textarea
                  value={localText}
                  onChange={(e) => setLocalText(e.target.value)}
                  rows={isPost ? 18 : 28}
                  className="font-mono text-sm"
                />
              ) : isPost && viewMode === "preview" ? (
                <LinkedInPreview
                  text={display}
                  authorName={authorName}
                  authorRole={authorRole}
                  authorAvatar={authorAvatar}
                />
              ) : isPost ? (
                <PlainPost source={display} />
              ) : (
                <Markdown source={display} />
              )
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-6 text-sm">
                <Sparkles className="h-4 w-4 animate-pulse text-brand-600" />
                Aguardando primeira geração.
              </div>
            )}
          </div>

          {/* Sugestões de aderência — aparecem abaixo do conteúdo,
              full-width no main column, aproveitando o espaço vertical
              que sobrava quando o draft é curto. Mantém o slot quando
              tá recalculando (busy && !score) pra evitar layout shift. */}
          {display &&
            !editing &&
            (styleScoreState.score?.matches.length ||
              styleScoreState.score?.gaps.length ||
              styleScoreState.busy) && (
              <div className="border-t border-border p-6">
                <StyleScoreDetails
                  score={styleScoreState.score}
                  busy={styleScoreState.busy}
                />
              </div>
            )}
        </div>

        {/* ============================================================
            ASIDE — 3 cards primários + tabs secundárias
           ============================================================ */}
        <aside className={cn("space-y-4", focusMode && "hidden")}>
          {/* MODO EDIÇÃO: revisão em tempo real toma o lugar dos cards */}
          {editing ? (
            <>
              <ReviewPanel
                text={localText}
                format={isPost ? "linkedin_post" : "article"}
                enabled
              />
              <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
                Saindo da edição manual sem salvar descarta as mudanças
                locais. Os outros painéis voltam quando você fechar a
                edição.
              </div>
            </>
          ) : (
            <>
              {/* CARD 0 — Score chip compacto (acima de tudo, visual rápido) */}
              {display && (
                <>
                  {/* Chip de auto-revisão — só na versão primária */}
                  {activeVariation === 0 &&
                    reviewMeta?.voice_match_score != null && (
                      <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-muted-foreground">
                            Auto-revisão na geração:
                          </span>
                          <span
                            className={cn(
                              "ml-auto font-mono font-semibold",
                              reviewMeta.voice_match_score >= 85
                                ? "text-emerald-600"
                                : reviewMeta.voice_match_score >= 70
                                  ? "text-brand-700"
                                  : "text-amber-600"
                            )}
                          >
                            {reviewMeta.voice_match_score}/100
                          </span>
                        </div>
                        {reviewMeta.voice_notes && (
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {reviewMeta.voice_notes}
                          </p>
                        )}
                      </div>
                    )}
                  <StyleScoreChip
                    score={styleScoreState.score}
                    busy={styleScoreState.busy}
                    error={styleScoreState.error}
                    versionLabel={versionLabel}
                    onRefresh={() => void styleScoreState.refetch()}
                  />
                </>
              )}

              {/* CARD 1 — Pedir ajuste (primary action) */}
              {display && (
                <div className="rounded-2xl border border-brand-200 bg-card p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Wand2 className="h-3.5 w-3.5 text-brand-600" />
                    Pedir ajuste em pt-BR
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Diga o que mudar. Mantém sua voz.
                  </p>
                  <Textarea
                    value={revisionPrompt}
                    onChange={(e) => setRevisionPrompt(e.target.value)}
                    placeholder={
                      isPost
                        ? "Ex: hook mais ácido. tira a citação do fim. quero um número no 2º parágrafo."
                        : "Ex: seção 3 precisa de mais bastidor. conclusão muito polida — quero uma aposta forte."
                    }
                    rows={4}
                    className="mt-3"
                  />
                  {error && (
                    <p className="mt-2 text-xs text-destructive">{error}</p>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => revise()}
                    disabled={revising || revisionPrompt.trim().length < 5}
                  >
                    {revising ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />{" "}
                        Revisando…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" /> Aplicar
                      </>
                    )}
                  </Button>

                  {/* Atalhos de revisão 1-clique — vão direto sem digitar */}
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Atalhos
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          revise(
                            "Mantém a tese mas torna o texto mais ousado e provocador. Hook mais ácido. Fechamento que aposta numa visão de futuro. Cortar qualquer floreio que sobrar."
                          )
                        }
                        disabled={revising}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition hover:border-brand-400 hover:bg-secondary disabled:opacity-50"
                        title="Hook mais ácido, aposta mais forte"
                      >
                        + Ousado
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          revise(
                            "Mantém a tese mas torna o texto mais sóbrio e analítico. Cortar adjetivos fortes. Mais dado, menos opinião. Linguagem de operador, sem provocação direta."
                          )
                        }
                        disabled={revising}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition hover:border-brand-400 hover:bg-secondary disabled:opacity-50"
                        title="Mais analítico e contido"
                      >
                        + Sóbrio
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          revise(
                            "Refaz o texto do zero, mantendo apenas o tema e a tese central. Estrutura, hook, exemplo e fechamento todos diferentes — outro caminho narrativo."
                          )
                        }
                        disabled={revising}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-[11px] font-medium text-foreground transition hover:border-brand-400 hover:bg-secondary disabled:opacity-50"
                        title="Mesma tese, outro caminho"
                      >
                        ↻ Refazer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD 3 — Agendar */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
                  Agendar publicação
                </h3>
                <Input
                  type="datetime-local"
                  value={scheduleDraft}
                  onChange={(e) => setScheduleDraft(e.target.value)}
                  className="mt-2"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={saveSchedule}
                    disabled={!scheduleDraft}
                  >
                    Salvar data
                  </Button>
                  {draft.scheduled_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSchedule}
                    >
                      Tirar
                    </Button>
                  )}
                </div>
                {draft.scheduled_at && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Agendado pra{" "}
                    <span className="font-mono">
                      {new Date(draft.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                )}
              </div>

              {/* CARD 4 — Feedback (sempre visível, retroalimenta o motor) */}
              {display && (
                <FeedbackPanel
                  draftId={draft.id}
                  onRevised={(d) => {
                    setDraft(d);
                    setLocalText(d.draft_markdown ?? "");
                    setActiveVariation(0);
                    // rola pra cima pra o líder ver o texto novo
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
            </>
          )}
        </aside>
      </div>

      {/* ============================================================
          OUTRAS TABS — renderizadas full-width quando ativas
         ============================================================ */}
      {display && !editing && !focusMode && pageTab === "versions" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <VersionsHistory
            draftId={draft.id}
            onRestored={(body) => {
              setDraft((d) => ({ ...d, draft_markdown: body }));
              setLocalText(body);
              setActiveVariation(0);
              setPageTab("content");
            }}
          />
        </section>
      )}

      {display && !editing && !focusMode && pageTab === "visuals" && (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4 text-brand-600" />
              Gerar infográfico
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha um modelo. O motor desenha no padrão Onfly.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ARCHETYPES.map((a) => {
                const isGen = generatingArchetype === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => generateInfographic(a.key)}
                    disabled={generatingArchetype !== null}
                    className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 text-left transition hover:border-brand-300 hover:bg-secondary disabled:opacity-50"
                  >
                    {isGen ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand-600" />
                    ) : (
                      <a.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight">
                        {a.label}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {display && !editing && !focusMode && pageTab === "asks" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm max-w-2xl">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <LayoutGrid className="h-4 w-4 text-brand-600" />
            O que você já pediu pra mudar
          </h4>
          {revisions.length > 0 ? (
            <ul className="mt-4 space-y-2 text-xs">
              {revisions
                .slice()
                .reverse()
                .map((r, i) => (
                  <li key={i} className="rounded-lg bg-secondary/50 p-3">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {formatDate(r.at)}
                    </p>
                    <p className="mt-1 leading-snug">{r.instructions}</p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Nada pedido ainda. Volta na tab <strong>Conteúdo</strong> e
              usa o card <em>Pedir ajuste</em>.
            </p>
          )}
        </section>
      )}

      {/* Infográficos renderizados embaixo (só na tab Infográfico) */}
      {pageTab === "visuals" && infographics.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">Infográficos</h2>
          <div className="mt-4 space-y-6">
            {infographics.map((v) => (
              <div key={v.id}>
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="soft">Infográfico</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteVisual(v.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                </div>
                <InfographicRenderer
                  html={v.payload}
                  filename={slugify(draft.topic)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
