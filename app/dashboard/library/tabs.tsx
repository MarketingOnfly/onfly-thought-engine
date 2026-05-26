"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ContentDraft,
  LeaderDocument,
  ReferenceLink,
  ReferenceProfile,
} from "@/lib/db/types";
import { formatDate, truncate, initials, cn } from "@/lib/utils";
import { Dropzone } from "@/components/dropzone";
import { useConfirm } from "@/components/confirm";

const LINK_KINDS = [
  { value: "substack", label: "Substack" },
  { value: "newsletter", label: "Newsletter" },
  { value: "blog", label: "Blog" },
  { value: "portal", label: "Portal" },
  { value: "podcast", label: "Podcast" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Outro" },
];

export default function LibraryTabs(props: {
  initialDrafts: ContentDraft[];
  initialProfiles: ReferenceProfile[];
  initialLinks: ReferenceLink[];
  initialDocs: LeaderDocument[];
}) {
  const [drafts, setDrafts] = useState(props.initialDrafts);
  const [profiles, setProfiles] = useState(props.initialProfiles);
  const [links, setLinks] = useState(props.initialLinks);
  const [docs, setDocs] = useState(props.initialDocs);

  const referenceCount = profiles.length + links.length + docs.length;

  return (
    <Tabs defaultValue="content" className="mt-8">
      <TabsList>
        <TabsTrigger value="content">
          Conteúdos <span className="ml-1 opacity-70">({drafts.length})</span>
        </TabsTrigger>
        <TabsTrigger value="references">
          Referências <span className="ml-1 opacity-70">({referenceCount})</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="content">
        <DraftsList drafts={drafts} onChange={setDrafts} />
      </TabsContent>

      <TabsContent value="references">
        <ReferencesView
          profiles={profiles}
          links={links}
          docs={docs}
          onProfilesChange={setProfiles}
          onLinksChange={setLinks}
          onDocsChange={setDocs}
        />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================
// REFERENCES — agrupa Perfis + Fontes + Documentos numa view só
// ============================================================

function ReferencesView({
  profiles,
  links,
  docs,
  onProfilesChange,
  onLinksChange,
  onDocsChange,
}: {
  profiles: ReferenceProfile[];
  links: ReferenceLink[];
  docs: LeaderDocument[];
  onProfilesChange: (next: ReferenceProfile[]) => void;
  onLinksChange: (next: ReferenceLink[]) => void;
  onDocsChange: (next: LeaderDocument[]) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Tudo que o motor lê pra calibrar seu jeito de escrever. Pessoas que você admira,
        veículos que você acompanha, documentos que carregam seu repertório.
      </p>

      <SectionCard
        icon={Users}
        title="Pessoas de referência"
        sub="O motor lê o conteúdo público e extrai os hooks e padrões de estilo."
        count={profiles.length}
        defaultOpen
      >
        <ProfilesPanel items={profiles} onChange={onProfilesChange} />
      </SectionCard>

      <SectionCard
        icon={ExternalLink}
        title="Fontes que você acompanha"
        sub="Substacks, newsletters, portais. Material bruto pra rodar discovery de pauta."
        count={links.length}
      >
        <LinksPanel items={links} onChange={onLinksChange} />
      </SectionCard>

      <SectionCard
        icon={FileText}
        title="Seus documentos"
        sub="Cases internos, dados, manifestos. Entram no contexto da geração."
        count={docs.length}
      >
        <DocsPanel items={docs} onChange={onDocsChange} />
      </SectionCard>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  sub,
  count,
  defaultOpen = false,
  children,
}: {
  icon: typeof Users;
  title: string;
  sub: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-secondary/30"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">
              {title}{" "}
              <span className="ml-1 font-normal text-muted-foreground">({count})</span>
            </h3>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="border-t border-border p-6">{children}</div>}
    </section>
  );
}

// ============================================================
// DRAFTS
// ============================================================

function DraftsList({
  drafts,
  onChange,
}: {
  drafts: ContentDraft[];
  onChange: (next: ContentDraft[]) => void;
}) {
  const confirm = useConfirm();
  async function remove(id: string) {
    const ok = await confirm({
      title: "Apagar este conteúdo?",
      description: "Ele sai da biblioteca e do calendário. Não dá pra voltar atrás.",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
    if (res.ok) onChange(drafts.filter((d) => d.id !== id));
  }

  if (!drafts.length)
    return (
      <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
        Sem conteúdos ainda. Vai em "Criar conteúdo" pra começar.
      </p>
    );

  return (
    <ul className="space-y-3">
      {drafts.map((d) => (
        <li
          key={d.id}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link href={`/dashboard/content/${d.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={d.format === "linkedin_post" ? "brand" : "soft"}>
                  {d.format === "linkedin_post" ? "Post" : "Artigo"}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {d.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(d.updated_at)}
                </span>
              </div>
              <h3 className="mt-2 font-display text-lg tracking-tight">{d.topic}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {truncate(d.draft_markdown ?? d.brief ?? "", 200)}
              </p>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// PROFILES (perfis de referência) — visual rico
// ============================================================

function ProfilesPanel({
  items,
  onChange,
}: {
  items: ReferenceProfile[];
  onChange: (next: ReferenceProfile[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", url: "", why_relevant: "" });
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sampleFor, setSampleFor] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const confirm = useConfirm();

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/references/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, hook_examples: null }),
      });
      if (res.ok) {
        const data = await res.json();
        const newItem: ReferenceProfile = data.item;
        // pega itens mais recentes pra evitar stale closure
        const nextItems = [...items, newItem];
        onChange(nextItems);
        setExpanded((m) => ({ ...m, [newItem.id]: true }));
        setDraft({ name: "", url: "", why_relevant: "" });
        setOpen(false);
        // fire-and-forget, passa nextItems pro update
        void analyze(newItem.id, undefined, nextItems);
      }
    } finally {
      setBusy(false);
    }
  }

  async function analyze(
    id: string,
    sample?: string,
    baseItems?: ReferenceProfile[]
  ) {
    setAnalyzing((m) => ({ ...m, [id]: true }));
    setErrors((m) => ({ ...m, [id]: null }));
    try {
      const res = await fetch(`/api/references/profiles/${id}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample: sample ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      const source = baseItems ?? items;
      if (res.ok && data.item) {
        onChange(source.map((x) => (x.id === id ? data.item : x)));
      } else {
        setErrors((m) => ({
          ...m,
          [id]: data.error ?? "Falha desconhecida na análise.",
        }));
      }
    } catch (err) {
      setErrors((m) => ({
        ...m,
        [id]: err instanceof Error ? err.message : "Erro de rede.",
      }));
    } finally {
      setAnalyzing((m) => ({ ...m, [id]: false }));
      setSampleFor(null);
      setSampleText("");
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Remover este perfil?",
      description: "O motor para de usar como referência de estilo.",
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    await fetch(`/api/references/profiles/${id}`, { method: "DELETE" });
    onChange(items.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Cada perfil tem padrões extraídos automaticamente — hooks, ritmo, vocabulário.
        </p>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar perfil
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Lara Acrich"
                className="mt-1"
              />
            </div>
            <div>
              <Label>URL (Substack, blog, LinkedIn…)</Label>
              <Input
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label>Por que importa (opcional)</Label>
            <Textarea
              value={draft.why_relevant}
              onChange={(e) => setDraft({ ...draft, why_relevant: e.target.value })}
              placeholder="Ex: abre sempre com número específico, frases curtas, opinião forte no 1º parágrafo"
              rows={2}
              className="mt-1"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hooks e estilo são extraídos automaticamente assim que você salvar.
            Pra LinkedIn, vamos te pedir 2-3 exemplos colados (eles bloqueiam scraping).
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={add}
              disabled={busy || !draft.name || !draft.url}
            >
              {busy ? "Salvando…" : "Salvar e analisar"}
            </Button>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((it) => (
            <ProfileCard
              key={it.id}
              profile={it}
              isAnalyzing={!!analyzing[it.id]}
              error={errors[it.id] ?? it.analysis_error}
              isExpanded={!!expanded[it.id]}
              onToggleExpand={() =>
                setExpanded((m) => ({ ...m, [it.id]: !m[it.id] }))
              }
              onAnalyze={() => analyze(it.id)}
              onRemove={() => remove(it.id)}
              onOpenSample={() => {
                setSampleFor(it.id);
                setSampleText(it.hook_examples ?? "");
              }}
              sampleOpen={sampleFor === it.id}
              sampleText={sampleText}
              onSampleChange={setSampleText}
              onSampleCancel={() => setSampleFor(null)}
              onSampleSubmit={() => analyze(it.id, sampleText)}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
          <User className="mx-auto h-6 w-6 text-brand-500" />
          <p className="mt-3 text-sm font-medium">Sem perfis de referência ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adiciona o LinkedIn ou Substack de alguém que escreve no jeito que você admira.
          </p>
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  isAnalyzing,
  error,
  isExpanded,
  onToggleExpand,
  onAnalyze,
  onRemove,
  onOpenSample,
  sampleOpen,
  sampleText,
  onSampleChange,
  onSampleCancel,
  onSampleSubmit,
}: {
  profile: ReferenceProfile;
  isAnalyzing: boolean;
  error: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAnalyze: () => void;
  onRemove: () => void;
  onOpenSample: () => void;
  sampleOpen: boolean;
  sampleText: string;
  onSampleChange: (v: string) => void;
  onSampleCancel: () => void;
  onSampleSubmit: () => void;
}) {
  const hooks = useMemo(() => parseHooks(profile.hook_examples), [profile.hook_examples]);
  const styleBullets = useMemo(
    () => parseStyleNotes(profile.style_notes),
    [profile.style_notes]
  );
  const toneSignals = profile.tone_signals ?? [];
  const topics = profile.topics_recurring ?? [];

  const status = analysisStatus(profile, isAnalyzing);
  const hasAnalysis =
    hooks.length > 0 ||
    styleBullets.length > 0 ||
    toneSignals.length > 0 ||
    topics.length > 0 ||
    !!profile.positioning;

  return (
    <li className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-medium text-white">
            {initials(profile.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{profile.name}</p>
              <a
                href={profile.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title="Abrir perfil em nova aba"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <StatusPill status={status} />
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            title="Re-analisar perfil"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} title="Remover">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {profile.why_relevant && (
        <p className="mt-3 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Por que importa: </span>
          {profile.why_relevant}
        </p>
      )}

      {/* Status — quando ainda não tem análise */}
      {!hasAnalysis && !isAnalyzing && (
        <div className="mt-3 space-y-2">
          {profile.analysis_status === "unfetchable" ? (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {profile.style_notes ||
                    "Esse perfil precisa de exemplos colados pra o motor analisar."}
                </span>
              </div>
              {!sampleOpen && (
                <Button variant="outline" size="sm" onClick={onOpenSample}>
                  Colar 2-3 posts pra análise
                </Button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              <span>
                Aguardando análise. Clica no ícone de refresh acima pra rodar agora.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sample input modal-like inline */}
      {sampleOpen && (
        <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
          <Label className="text-xs">
            Cola 2-3 posts dessa pessoa (LinkedIn, Substack, etc.)
          </Label>
          <Textarea
            value={sampleText}
            onChange={(e) => onSampleChange(e.target.value)}
            rows={6}
            placeholder="Posts inteiros, separados por linhas em branco."
            className="mt-1 text-xs"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onSampleCancel}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={sampleText.trim().length < 200 || isAnalyzing}
              onClick={onSampleSubmit}
            >
              Analisar
            </Button>
          </div>
        </div>
      )}

      {/* Análise em progresso */}
      {isAnalyzing && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Lendo o conteúdo e extraindo padrões. Demora 5-15 segundos.</span>
        </div>
      )}

      {/* Erro da última análise */}
      {!isAnalyzing && error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Análise falhou</p>
            <p className="mt-0.5 break-words">{error}</p>
            <button
              type="button"
              onClick={onAnalyze}
              className="mt-1 underline-offset-2 hover:underline"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      {/* Análise — todos os campos */}
      {hasAnalysis && (
        <div className="mt-3 space-y-3">
          {/* Posicionamento */}
          {profile.positioning && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Posicionamento
              </p>
              <p className="mt-1 rounded-lg bg-brand-50/60 p-3 text-xs font-medium text-brand-900">
                {profile.positioning}
              </p>
            </div>
          )}

          {/* Tom */}
          {toneSignals.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tom
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {toneSignals.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50/60 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Temas */}
          {topics.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Temas recorrentes
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {topics.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hooks */}
          {hooks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Hooks extraídos ({hooks.length})
              </p>
              <ul className="mt-2 space-y-2">
                {hooks.slice(0, isExpanded ? undefined : 2).map((h, i) => (
                  <li
                    key={i}
                    className="rounded-lg border-l-2 border-brand-500 bg-brand-50/40 px-3 py-2 text-xs italic text-brand-900"
                  >
                    &ldquo;{h}&rdquo;
                  </li>
                ))}
              </ul>
              {hooks.length > 2 && !isExpanded && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="mt-1 text-[10px] text-brand-700 hover:underline"
                >
                  ver mais {hooks.length - 2}
                </button>
              )}
            </div>
          )}

          {/* Padrões de estilo */}
          {styleBullets.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Padrões de escrita
              </p>
              <ul className="mt-2 space-y-1.5">
                {styleBullets.slice(0, isExpanded ? undefined : 3).map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-foreground/80"
                  >
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {styleBullets.length > 3 && !isExpanded && (
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className="mt-1 text-[10px] text-brand-700 hover:underline"
                >
                  ver mais {styleBullets.length - 3}
                </button>
              )}
            </div>
          )}

          {/* Vocabulário */}
          {profile.vocab_notes && isExpanded && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Vocabulário característico
              </p>
              <p className="mt-1 text-xs text-foreground/80">{profile.vocab_notes}</p>
            </div>
          )}

          {/* Toggle expand/recolher */}
          {(hooks.length > 2 || styleBullets.length > 3 || profile.vocab_notes) && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? "recolher" : "ver tudo"}
            </button>
          )}

          {profile.analyzed_at && (
            <p className="text-[10px] text-muted-foreground">
              Analisado {formatDate(profile.analyzed_at)}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

type StatusKind =
  | "analyzing"
  | "ok"
  | "ok_sample"
  | "needs_sample"
  | "pending";

function analysisStatus(p: ReferenceProfile, isAnalyzing: boolean): StatusKind {
  if (isAnalyzing) return "analyzing";
  if (p.analysis_status === "ok") return "ok";
  if (p.analysis_status === "analyzed_with_sample") return "ok_sample";
  if (p.analysis_status === "unfetchable") return "needs_sample";
  return "pending";
}

const STATUS_META: Record<
  StatusKind,
  { label: string; tooltip: string; variant: "brand" | "soft" | "outline" | "neutral"; className?: string }
> = {
  analyzing: {
    label: "Analisando…",
    tooltip: "O motor está lendo o conteúdo público e extraindo padrões.",
    variant: "brand",
  },
  ok: {
    label: "Padrões extraídos",
    tooltip: "Lemos o conteúdo público e extraímos hooks + estilo.",
    variant: "brand",
  },
  ok_sample: {
    label: "Padrões (via exemplos)",
    tooltip: "Análise feita a partir dos posts que você colou.",
    variant: "soft",
  },
  needs_sample: {
    label: "Precisa de exemplos",
    tooltip:
      "LinkedIn bloqueia leitura pública. Cole 2-3 posts dessa pessoa pra o motor estudar.",
    variant: "outline",
    className: "border-amber-400 text-amber-700",
  },
  pending: {
    label: "Aguardando análise",
    tooltip: "Recém-adicionado. Vamos analisar — pode levar alguns segundos.",
    variant: "outline",
  },
};

function StatusPill({ status }: { status: StatusKind }) {
  const meta = STATUS_META[status];
  return (
    <span title={meta.tooltip}>
      <Badge
        variant={
          meta.variant === "neutral"
            ? "outline"
            : (meta.variant as "brand" | "soft" | "outline")
        }
        className={cn("mt-1 inline-flex items-center gap-1 text-[10px]", meta.className)}
      >
        {status === "analyzing" && <Loader2 className="h-3 w-3 animate-spin" />}
        {meta.label}
      </Badge>
    </span>
  );
}

/** Hook examples vêm como string com hooks separados por linha em branco. */
function parseHooks(raw: string | null): string[] {
  if (!raw) return [];
  // tenta separar por blank line primeiro (formato esperado do prompt)
  let parts = raw
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  // se ficou só 1 bloco grande, tenta quebrar por linha simples
  if (parts.length <= 1 && raw.split("\n").length > 2) {
    parts = raw
      .split("\n")
      .map((s) =>
        s
          .replace(/^[-•*]\s+/, "")
          .replace(/^\d+[.)]\s+/, "")
          .trim()
      )
      .filter((s) => s.length > 10);
  }
  // Strip aspas que o modelo às vezes inclui
  return parts.map((p) => p.replace(/^["“'']+|["”'']+$/g, "").trim());
}

/** Style notes vêm como string com bullets. Parseamos cada linha. */
function parseStyleNotes(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((s) => s.replace(/^[-•*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter((s) => s.length > 4);
}

// ============================================================
// LINKS (fontes acompanhadas)
// ============================================================

function LinksPanel({
  items,
  onChange,
}: {
  items: ReferenceLink[];
  onChange: (next: ReferenceLink[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    url: string;
    kind: ReferenceLink["kind"];
    notes: string;
  }>({ title: "", url: "", kind: "blog", notes: "" });
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/references/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        onChange([...items, data.item]);
        setDraft({ title: "", url: "", kind: "blog", notes: "" });
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Remover esta fonte?",
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    await fetch(`/api/references/links/${id}`, { method: "DELETE" });
    onChange(items.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Adicionar fonte
        </Button>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <Label>Título</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) =>
                  setDraft({ ...draft, kind: v as ReferenceLink["kind"] })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label>URL</Label>
            <Input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="mt-3">
            <Label>Notas</Label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={add} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{it.title}</span>
                  <Badge variant="brand" className="text-[10px] capitalize">
                    {it.kind}
                  </Badge>
                </div>
                <a
                  href={it.url}
                  target="_blank"
                  className="mt-1 block truncate text-xs text-muted-foreground hover:underline"
                  rel="noreferrer"
                >
                  {it.url}
                </a>
                {it.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{it.notes}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Sem fontes cadastradas. Adiciona blogs, newsletters e portais que você acompanha.
        </p>
      )}
    </div>
  );
}

// ============================================================
// DOCS (documentos do líder)
// ============================================================

function DocsPanel({
  items,
  onChange,
}: {
  items: LeaderDocument[];
  onChange: (next: LeaderDocument[]) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", content: "", kind: "background" });
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const data = await res.json();
        onChange([...items, data.item]);
        setDraft({ name: "", content: "", kind: "background" });
        setPasteOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Remover este documento?",
      description: "O motor para de usar o conteúdo dele nas próximas gerações.",
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    onChange(items.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <Dropzone onUploaded={(uploaded) => onChange([...items, ...uploaded])} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {pasteOpen ? "← Voltar ao upload" : "ou colar texto direto →"}
        </button>
      </div>

      {pasteOpen && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <div className="grid gap-3">
            <div>
              <Label>Nome do documento</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Manifesto da empresa, dados Q1 2025"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                rows={6}
                placeholder="Cole o texto aqui."
                className="mt-1 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPasteOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={add}
                disabled={busy || draft.name.length < 2 || draft.content.length < 20}
              >
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{it.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {truncate(it.content, 140)}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {formatDate(it.created_at)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Sem documentos ainda. Arraste arquivos no campo acima.
        </p>
      )}
    </div>
  );
}
