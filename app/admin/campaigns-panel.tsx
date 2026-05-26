"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  Megaphone,
  Paperclip,
  Plus,
  Send,
  Sliders,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client-fetch";
import type {
  Campaign,
  CampaignAttachment,
  CampaignAudienceFilter,
  ContentFormat,
} from "@/lib/db/types";
import { formatDate, cn } from "@/lib/utils";
import { useConfirm } from "@/components/confirm";
import type { LeaderLite } from "./tabs";

// Tipos de filtro pra UI (mode === string)
type FilterMode = CampaignAudienceFilter["mode"];

// Staged attachment antes de upload (memo no client + preview)
type StagedFile = {
  id: string; // local UUID
  file: File;
  isImage: boolean;
  previewUrl?: string; // só pra imagens
};

export default function CampaignsPanel({
  initial,
  activeLeaders,
  leaders,
}: {
  initial: Campaign[];
  activeLeaders: number;
  leaders: LeaderLite[];
}) {
  const [items, setItems] = useState<Campaign[]>(initial);
  const [creating, setCreating] = useState(false);
  const [dispatching, setDispatching] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<
    Record<string, { ready: number; failed: number; total: number } | null>
  >({});
  const confirm = useConfirm();

  function audienceCount(filter: CampaignAudienceFilter): number {
    if (filter.mode === "all") return leaders.length;
    if (filter.mode === "specific_users") {
      const set = new Set(filter.user_ids);
      return leaders.filter((l) => set.has(l.user_id)).length;
    }
    if (filter.mode === "by_area") {
      const set = new Set(filter.areas.map((a) => a.toLowerCase()));
      return leaders.filter((l) => set.has(l.area.toLowerCase())).length;
    }
    if (filter.mode === "by_role") {
      const set = new Set(filter.roles.map((r) => r.toLowerCase()));
      return leaders.filter((l) => set.has(l.role.toLowerCase())).length;
    }
    return 0;
  }

  async function dispatch(c: Campaign) {
    const count = audienceCount(c.audience_filter ?? { mode: "all" });
    const ok = await confirm({
      title: "Disparar campanha?",
      description: `Vamos gerar um rascunho personalizado pra ${count} líder${
        count === 1 ? "" : "es"
      } selecionado${count === 1 ? "" : "s"}. Pode levar alguns minutos.`,
      confirmText: "Disparar agora",
    });
    if (!ok) return;
    setDispatching((m) => ({ ...m, [c.id]: true }));
    setItems((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, status: "dispatching" } : x))
    );
    try {
      const res = await apiFetch<{
        ready: number;
        failed: number;
        total: number;
      }>(`/api/admin/campaigns/${c.id}/dispatch`, { method: "POST" });
      if (res.ok) {
        setResults((m) => ({ ...m, [c.id]: { ...res.data } }));
        setItems((prev) =>
          prev.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  status:
                    res.data.failed === res.data.total ? "failed" : "sent",
                  dispatched_at: new Date().toISOString(),
                }
              : x
          )
        );
      } else {
        setResults((m) => ({ ...m, [c.id]: null }));
        alert(`Falha: ${res.error}`);
      }
    } finally {
      setDispatching((m) => ({ ...m, [c.id]: false }));
    }
  }

  async function remove(c: Campaign) {
    const ok = await confirm({
      title: "Apagar campanha?",
      description: "Os drafts já gerados ficam, mas perdem o vínculo.",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: "DELETE" });
    if (res.ok) setItems(items.filter((x) => x.id !== c.id));
  }

  return (
    <div className="mt-6 space-y-6">
      {/* HEADER + AÇÃO */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-brand-600" />
              <h2 className="font-display text-xl tracking-tight">Campanhas</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Tema + briefing + público-alvo. Cada líder selecionado recebe um draft
              calibrado pro perfil dele(a), já agendado pra data alvo.
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-brand-700">
                <Users className="h-3 w-3" /> {activeLeaders} líder
                {activeLeaders === 1 ? "" : "es"} ativo{activeLeaders === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          {!creating && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nova campanha
            </Button>
          )}
        </div>

        {creating && (
          <NewCampaignForm
            leaders={leaders}
            onCancel={() => setCreating(false)}
            onCreated={(c) => {
              setItems([c, ...items]);
              setCreating(false);
            }}
          />
        )}
      </div>

      {/* LISTA EXISTENTE */}
      {items.length ? (
        <ul className="space-y-3">
          {items.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              audienceCount={audienceCount(c.audience_filter ?? { mode: "all" })}
              dispatching={!!dispatching[c.id]}
              result={results[c.id]}
              onDispatch={() => dispatch(c)}
              onRemove={() => remove(c)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Nenhuma campanha ainda. Clica em "Nova campanha" pra começar.
        </p>
      )}
    </div>
  );
}

// ============================================================
// NEW CAMPAIGN FORM — uma tela só, atomic
// ============================================================

function NewCampaignForm({
  leaders,
  onCancel,
  onCreated,
}: {
  leaders: LeaderLite[];
  onCancel: () => void;
  onCreated: (c: Campaign) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    theme: "",
    brief: "",
    format: "linkedin_post" as ContentFormat,
    target_publish_date: "" as string,
  });
  const [audience, setAudience] = useState<CampaignAudienceFilter>({ mode: "all" });
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const targetCount = useMemo(() => {
    if (audience.mode === "all") return leaders.length;
    if (audience.mode === "specific_users") {
      const set = new Set(audience.user_ids);
      return leaders.filter((l) => set.has(l.user_id)).length;
    }
    if (audience.mode === "by_area") {
      const set = new Set(audience.areas.map((a) => a.toLowerCase()));
      return leaders.filter((l) => set.has(l.area.toLowerCase())).length;
    }
    if (audience.mode === "by_role") {
      const set = new Set(audience.roles.map((r) => r.toLowerCase()));
      return leaders.filter((l) => set.has(l.role.toLowerCase())).length;
    }
    return 0;
  }, [audience, leaders]);

  function addStaged(files: FileList | File[]) {
    const next: StagedFile[] = [];
    for (const f of Array.from(files)) {
      const isImage = f.type.startsWith("image/");
      next.push({
        id: crypto.randomUUID(),
        file: f,
        isImage,
        previewUrl: isImage ? URL.createObjectURL(f) : undefined,
      });
    }
    setStaged((prev) => [...prev, ...next]);
  }

  function removeStaged(id: string) {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ item: Campaign }>("/api/admin/campaigns", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          target_publish_date: form.target_publish_date || null,
          audience_filter: audience,
        }),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const campaign = res.data.item;

      // Upload anexos staged
      if (staged.length > 0) {
        const fd = new FormData();
        for (const s of staged) fd.append("files", s.file);
        fd.append("kind", "reference");
        const up = await fetch(
          `/api/admin/campaigns/${campaign.id}/attachments`,
          { method: "POST", body: fd }
        );
        if (!up.ok) {
          setError("Campanha salva, mas alguns anexos falharam.");
        }
      }

      // Limpa previews
      for (const s of staged) {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      }

      onCreated(campaign);
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    form.theme.length >= 10 && form.name.length >= 2 && targetCount > 0;

  return (
    <div className="mt-5 space-y-5 rounded-2xl border border-border bg-background p-5">
      <header>
        <h3 className="font-display text-xl tracking-tight">Nova campanha</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tudo numa tela só. Define o tema, o público, anexa o que precisar, e
          dispara.
        </p>
      </header>

      {/* CONTEÚDO BÁSICO */}
      <section className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Formato
          </Label>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <FormatCard
              active={form.format === "linkedin_post"}
              onClick={() => setForm({ ...form, format: "linkedin_post" })}
              icon={Linkedin}
              title="Post de LinkedIn"
            />
            <FormatCard
              active={form.format === "article"}
              onClick={() => setForm({ ...form, format: "article" })}
              icon={FileText}
              title="Artigo de autoridade"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <div>
            <Label>Tema</Label>
            <Textarea
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
              rows={2}
              placeholder="Ex: Por que travel deveria entrar na previsão de fluxo de caixa"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
              Data alvo (opcional)
            </Label>
            <Input
              type="date"
              min={today}
              value={form.target_publish_date}
              onChange={(e) =>
                setForm({ ...form, target_publish_date: e.target.value })
              }
              className="mt-1"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Drafts são agendados pra 10h SP nessa data.
            </p>
          </div>
        </div>

        <div>
          <Label>Nome interno</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Aparece só pra você na lista de campanhas"
            className="mt-1"
          />
        </div>

        <div>
          <Label>Briefing estratégico (opcional)</Label>
          <Textarea
            value={form.brief}
            onChange={(e) => setForm({ ...form, brief: e.target.value })}
            rows={5}
            placeholder="Contexto da Onfly + tese-mãe + aposta. Cada líder vai trazer o ângulo dele(a)."
            className="mt-1"
          />
        </div>
      </section>

      {/* AUDIÊNCIA */}
      <section className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-600" />
          <Label className="text-sm font-medium">Quem vai receber</Label>
        </div>

        <AudiencePicker
          leaders={leaders}
          value={audience}
          onChange={setAudience}
        />

        <p className="mt-3 text-xs">
          <span className="font-mono font-medium text-brand-700">
            {targetCount}
          </span>{" "}
          líder{targetCount === 1 ? "" : "es"} vão receber draft personalizado.
          {targetCount === 0 && (
            <span className="ml-2 text-destructive">
              Selecione ao menos 1 pra continuar.
            </span>
          )}
        </p>
      </section>

      {/* ANEXOS */}
      <section className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-brand-600" />
          <Label className="text-sm font-medium">
            Material de apoio (opcional)
          </Label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX, TXT, MD entram no contexto do motor. Imagens (PNG, JPG, GIF,
          WEBP) ficam de referência visual pra você — não vão no prompt.
        </p>

        <AttachmentZone
          staged={staged}
          onAdd={addStaged}
          onRemove={removeStaged}
        />
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={busy || !canSave}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Salvar campanha
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AUDIENCE PICKER
// ============================================================

function AudiencePicker({
  leaders,
  value,
  onChange,
}: {
  leaders: LeaderLite[];
  value: CampaignAudienceFilter;
  onChange: (next: CampaignAudienceFilter) => void;
}) {
  const distinctAreas = useMemo(() => {
    return Array.from(
      new Set(leaders.map((l) => l.area).filter((a) => a.length > 0))
    ).sort();
  }, [leaders]);

  const distinctRoles = useMemo(() => {
    return Array.from(
      new Set(leaders.map((l) => l.role).filter((r) => r.length > 0))
    ).sort();
  }, [leaders]);

  function pickMode(m: FilterMode) {
    if (m === "all") onChange({ mode: "all" });
    if (m === "specific_users") onChange({ mode: "specific_users", user_ids: [] });
    if (m === "by_area") onChange({ mode: "by_area", areas: [] });
    if (m === "by_role") onChange({ mode: "by_role", roles: [] });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <ModePill
          active={value.mode === "all"}
          onClick={() => pickMode("all")}
          label="Todos"
          sub={`${leaders.length} líderes`}
        />
        <ModePill
          active={value.mode === "by_area"}
          onClick={() => pickMode("by_area")}
          label="Por área"
          sub={`${distinctAreas.length} áreas`}
        />
        <ModePill
          active={value.mode === "by_role"}
          onClick={() => pickMode("by_role")}
          label="Por cargo"
          sub={`${distinctRoles.length} cargos`}
        />
        <ModePill
          active={value.mode === "specific_users"}
          onClick={() => pickMode("specific_users")}
          label="Líderes específicos"
          sub="escolher um a um"
        />
      </div>

      {value.mode === "by_area" && (
        <ChipPicker
          label="Áreas"
          options={distinctAreas}
          selected={value.areas}
          onChange={(arr) => onChange({ mode: "by_area", areas: arr })}
        />
      )}

      {value.mode === "by_role" && (
        <ChipPicker
          label="Cargos"
          options={distinctRoles}
          selected={value.roles}
          onChange={(arr) => onChange({ mode: "by_role", roles: arr })}
        />
      )}

      {value.mode === "specific_users" && (
        <LeaderMultiPicker
          leaders={leaders}
          selected={value.user_ids}
          onChange={(arr) =>
            onChange({ mode: "specific_users", user_ids: arr })
          }
        />
      )}
    </div>
  );
}

function ModePill({
  active,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-xl border px-3 py-2 text-left transition",
        active
          ? "border-brand-500 bg-brand-50/60"
          : "border-border bg-background hover:bg-secondary/50"
      )}
    >
      <span className={cn("text-sm font-medium", active && "text-brand-700")}>
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </button>
  );
}

function ChipPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((o) => o !== opt));
    else onChange([...selected, opt]);
  }
  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma opção disponível.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-brand-500 bg-brand-50/80 text-brand-700"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeaderMultiPicker({
  leaders,
  selected,
  onChange,
}: {
  leaders: LeaderLite[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leaders;
    return leaders.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        l.role.toLowerCase().includes(q) ||
        l.area.toLowerCase().includes(q)
    );
  }, [leaders, query]);

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Líderes
        </p>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar ({selected.length})
          </button>
        )}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome, cargo ou área"
        className="mt-2"
      />
      <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <li className="p-3 text-center text-xs text-muted-foreground">
            Nenhum líder encontrado.
          </li>
        ) : (
          filtered.map((l) => {
            const active = selected.includes(l.user_id);
            return (
              <li key={l.user_id}>
                <button
                  type="button"
                  onClick={() => toggle(l.user_id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-secondary/60",
                    active && "bg-brand-50/60"
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate font-medium",
                        active && "text-brand-700"
                      )}
                    >
                      {l.full_name}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {[l.role, l.area].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {active && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

// ============================================================
// ATTACHMENT ZONE
// ============================================================

function AttachmentZone({
  staged,
  onAdd,
  onRemove,
}: {
  staged: StagedFile[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mt-3 space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) onAdd(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-background p-5 text-center transition-colors",
          dragging
            ? "border-brand-500 bg-brand-50/60"
            : "border-border hover:border-brand-300"
        )}
      >
        <Upload className="h-5 w-5 text-brand-600" />
        <p className="text-sm font-medium">
          {dragging ? "Solta aqui" : "Arraste arquivos ou clica pra escolher"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          PDF · DOCX · TXT · MD · PNG · JPG · GIF · WEBP — até 15 MB cada
        </p>
      </button>

      {staged.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {staged.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 text-sm"
            >
              {s.isImage && s.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.previewUrl}
                  alt={s.file.name}
                  className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  {s.isImage ? (
                    <ImageIcon className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(s.file.size)} · {s.isImage ? "imagem" : "documento"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================
// CAMPAIGN ROW
// ============================================================

function CampaignRow({
  campaign,
  audienceCount,
  dispatching,
  result,
  onDispatch,
  onRemove,
}: {
  campaign: Campaign;
  audienceCount: number;
  dispatching: boolean;
  result: { ready: number; failed: number; total: number } | null | undefined;
  onDispatch: () => void;
  onRemove: () => void;
}) {
  const filter = campaign.audience_filter ?? { mode: "all" };

  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={campaign.format === "linkedin_post" ? "brand" : "soft"}>
              {campaign.format === "linkedin_post" ? "Post" : "Artigo"}
            </Badge>
            <StatusBadge status={campaign.status} dispatching={dispatching} />
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 text-[10px]"
            >
              <Sliders className="h-3 w-3" />
              {audienceLabel(filter)} ({audienceCount})
            </Badge>
            {campaign.target_publish_date && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                <CalendarDays className="h-3 w-3" />
                {new Date(`${campaign.target_publish_date}T00:00:00`).toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "short" }
                )}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Criada {formatDate(campaign.created_at)}
            </span>
            {campaign.dispatched_at && (
              <span className="text-xs text-muted-foreground">
                · disparada {formatDate(campaign.dispatched_at)}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-xl tracking-tight">
            {campaign.name}
          </h3>
          <p className="mt-1 text-sm">{campaign.theme}</p>
          {campaign.brief && (
            <p className="mt-2 whitespace-pre-line rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
              {campaign.brief.slice(0, 240)}
              {campaign.brief.length > 240 ? "…" : ""}
            </p>
          )}
          {result && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3 text-xs">
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
              <span>
                <strong className="text-brand-700">{result.ready}</strong> de{" "}
                {result.total} drafts gerados
              </span>
              {result.failed > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" /> {result.failed} falharam
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant={campaign.status === "sent" ? "outline" : "primary"}
            size="sm"
            onClick={onDispatch}
            disabled={dispatching}
          >
            {dispatching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {campaign.status === "sent" ? "Reenviar" : "Disparar"}
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>
    </li>
  );
}

function audienceLabel(filter: CampaignAudienceFilter): string {
  if (filter.mode === "all") return "Todos";
  if (filter.mode === "by_area") return `${filter.areas.length} área(s)`;
  if (filter.mode === "by_role") return `${filter.roles.length} cargo(s)`;
  if (filter.mode === "specific_users") return `${filter.user_ids.length} líder(es)`;
  return "—";
}

function StatusBadge({
  status,
  dispatching,
}: {
  status: Campaign["status"];
  dispatching: boolean;
}) {
  if (dispatching) return <Badge variant="brand">disparando…</Badge>;
  if (status === "draft") return <Badge variant="outline">rascunho</Badge>;
  if (status === "queued") return <Badge variant="soft">na fila</Badge>;
  if (status === "dispatching") return <Badge variant="brand">disparando</Badge>;
  if (status === "sent") return <Badge variant="brand">enviada</Badge>;
  return (
    <Badge variant="outline" className="border-destructive text-destructive">
      falhou
    </Badge>
  );
}

// ============================================================
// FORMAT CARD
// ============================================================

function FormatCard({
  active,
  onClick,
  icon: Icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Linkedin;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-brand-500 bg-brand-50/40"
          : "border-border bg-background hover:bg-secondary/50"
      )}
    >
      <Icon className="h-4 w-4 text-brand-600" />
      <span className="text-sm font-medium">{title}</span>
    </button>
  );
}
