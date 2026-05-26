"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  Copy,
  GitBranch,
  Grid3x3,
  LayoutGrid,
  Loader2,
  RefreshCw,
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
import { StyleScoreCard } from "@/components/style-score-card";
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
import { Maximize2, Minimize2, Eye, FileCode } from "lucide-react";

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

export default function ContentEditor({
  initial,
  authorName,
  authorRole,
  authorAvatar,
}: {
  initial: ContentDraft;
  authorName: string;
  authorRole: string | null;
  authorAvatar: string | null;
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
  const [generatingArchetype, setGeneratingArchetype] = useState<Archetype | null>(
    null
  );
  const [scheduleDraft, setScheduleDraft] = useState(
    initial.scheduled_at ? toLocalInputValue(initial.scheduled_at) : ""
  );
  // Variação ativa: 0 = primary (draft_markdown), 1+ = alt_versions[i-1]
  const [activeVariation, setActiveVariation] = useState(0);
  // Modo de exibição: "preview" = mockup LinkedIn, "raw" = texto cru
  const [viewMode, setViewMode] = useState<"preview" | "raw">(
    initial.format === "linkedin_post" ? "preview" : "raw"
  );
  // Modo foco — esconde tudo menos o texto
  const [focusMode, setFocusMode] = useState(false);
  const confirm = useConfirm();

  const isPost = draft.format === "linkedin_post";
  const alts = (draft.alt_versions as AltVersion[] | undefined) ?? [];
  const styleScore = (draft.style_score as StyleScore | null) ?? null;

  // O texto exibido depende da variação ativa
  const variationText =
    activeVariation === 0
      ? draft.draft_markdown ?? ""
      : alts[activeVariation - 1]?.body ?? draft.draft_markdown ?? "";

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

  // isPost vem do bloco de hooks acima. display agora aponta pra variação ativa.
  const display = variationText;

  async function revise() {
    setRevising(true);
    setError(null);
    const res = await apiFetch<{ draft: ContentDraft }>("/api/content/revise", {
      method: "POST",
      body: JSON.stringify({
        draft_id: draft.id,
        instructions: revisionPrompt,
      }),
    });
    setRevising(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDraft(res.data.draft);
    setLocalText(res.data.draft.draft_markdown ?? "");
    setRevisionPrompt("");
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

  async function saveManualEdit() {
    const res = await fetch(`/api/content/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        final_markdown: localText,
      }),
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

  const revisions =
    (draft.meta as { revisions?: { at: string; instructions: string }[] })?.revisions ?? [];

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isPost ? "brand" : "soft"}>
          {isPost ? "Post de LinkedIn" : "Artigo"}
        </Badge>
        <Badge variant="outline" className="capitalize">{draft.status}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          Atualizado {formatDate(draft.updated_at)}
        </span>
      </div>

      <h1 className="mt-4 font-display text-3xl tracking-tight md:text-4xl">
        {draft.topic}
      </h1>
      {draft.brief && (
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{draft.brief}</p>
      )}

      <div
        className={cn(
          "mt-8 grid gap-6",
          focusMode ? "grid-cols-1" : "lg:grid-cols-[1fr_320px]"
        )}
      >
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Tabs de variações (só aparece se houver alts) */}
          {alts.length > 0 && !editing && (
            <div className="-mx-6 -mt-6 mb-4">
              <VariationsTabs
                primary={draft.draft_markdown ?? ""}
                alternates={alts}
                activeIndex={activeVariation}
                onPick={setActiveVariation}
                onPromote={promoteVariation}
              />
            </div>
          )}

          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              {editing ? "Editando manualmente" : "Rascunho"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="sm" onClick={saveManualEdit}>
                    Salvar edição
                  </Button>
                </>
              ) : (
                <>
                  {/* Toggle preview <> raw — só pra posts */}
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
                          <FileCode className="h-3.5 w-3.5" /> Texto
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Preview LinkedIn
                        </>
                      )}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    Editar texto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copy}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFocusMode((v) => !v)}
                    title={focusMode ? "Sair do modo foco" : "Modo foco"}
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

          {display ? (
            editing ? (
              <Textarea
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                rows={isPost ? 18 : 28}
                className="mt-4 font-mono text-sm"
              />
            ) : (
              <div className="mt-6">
                {isPost && viewMode === "preview" ? (
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
                )}
              </div>
            )
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-secondary/40 p-6 text-sm">
              <Sparkles className="h-4 w-4 animate-pulse text-brand-600" />
              Aguardando primeira geração.
            </div>
          )}
        </div>

        <aside className={cn("space-y-4", focusMode && "hidden")}>
          {editing && (
            <ReviewPanel
              text={localText}
              format={isPost ? "linkedin_post" : "article"}
              enabled
            />
          )}

          {/* Score de aderência ao estilo — auto-roda ao abrir */}
          {display && !editing && (
            <StyleScoreCard draftId={draft.id} initial={styleScore} />
          )}

          {/* Feedback: aparece quando já tem rascunho gerado, pra o líder
              avaliar e o motor aprender. */}
          {display && !editing && <FeedbackPanel draftId={draft.id} />}

          {/* Histórico de versões — colapsado por default */}
          {display && !editing && (
            <VersionsHistory
              draftId={draft.id}
              onRestored={(body) => {
                setDraft((d) => ({ ...d, draft_markdown: body }));
                setLocalText(body);
                setActiveVariation(0);
              }}
            />
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium">Pedir ajustes em português</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Diga o que quer mudar. Mantém sua voz.
            </p>
            <Textarea
              value={revisionPrompt}
              onChange={(e) => setRevisionPrompt(e.target.value)}
              placeholder={`Ex: ${
                isPost
                  ? "Hook mais ácido. Tira a citação do final. Quero um número no segundo parágrafo."
                  : "A seção 3 precisa de mais bastidor. Conclusão muito polida — quero uma aposta forte."
              }`}
              rows={4}
              className="mt-3"
            />
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <Button
              variant="primary"
              size="sm"
              className="mt-3 w-full"
              onClick={revise}
              disabled={revising || revisionPrompt.trim().length < 5}
            >
              {revising ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Revisando...
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" /> Aplicar
                </>
              )}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
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
              <Button variant="primary" size="sm" className="flex-1" onClick={saveSchedule}>
                Salvar data
              </Button>
              {draft.scheduled_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setScheduleDraft("");
                    void (async () => {
                      const res = await fetch(`/api/content/${draft.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ scheduled_at: null }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setDraft(data.draft);
                      }
                    })();
                  }}
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

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <LayoutGrid className="h-3.5 w-3.5 text-brand-600" />
              Gerar infográfico
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha um modelo. O motor desenha no padrão Onfly.
            </p>
            <div className="mt-3 space-y-1">
              {ARCHETYPES.map((a) => {
                const isGen = generatingArchetype === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => generateInfographic(a.key)}
                    disabled={generatingArchetype !== null}
                    className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-secondary disabled:opacity-50"
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
                      <p className="text-[10px] leading-tight text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium">Ações</h3>
            <div className="mt-3 flex flex-col gap-2">
              {draft.status !== "approved" && (
                <Button variant="outline" size="sm" onClick={approve}>
                  <Check className="h-3.5 w-3.5" /> Marcar como aprovado
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </div>

          {revisions.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium">O que você já pediu pra mudar</h3>
              <ul className="mt-3 space-y-3 text-xs">
                {revisions
                  .slice()
                  .reverse()
                  .map((r, i) => (
                    <li key={i} className="rounded-lg bg-secondary/50 p-3">
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {formatDate(r.at)}
                      </p>
                      <p className="mt-1">{r.instructions}</p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {visuals.filter((v) => v.kind === "infographic").length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">Infográficos</h2>
          <div className="mt-4 space-y-6">
            {visuals
              .filter((v) => v.kind === "infographic")
              .map((v) => (
                <div key={v.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="soft">Infográfico</Badge>
                    <Button variant="ghost" size="sm" onClick={() => deleteVisual(v.id)}>
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
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
