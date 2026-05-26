"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  FileText,
  Linkedin,
  Sliders,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-fetch";
import { CardSingleSelect, ChipMultiSelect } from "@/components/preset-picker";
import {
  CONTENT_LENGTHS,
  CONTENT_TYPES,
  HOOK_STYLES,
  OBJECTIVES,
  TONE_TRAITS,
} from "@/lib/style-presets";
import type { ContentDraft } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type Format = "linkedin_post" | "article";
type LengthKey = "short" | "medium" | "long";

export default function CreateForm({
  leaderName,
  prefillTopic,
  prefillBrief,
  prefillFormat,
  defaultObjective,
  defaultHookStyle,
  defaultContentType,
  defaultTone,
}: {
  leaderName: string;
  prefillTopic?: string;
  prefillBrief?: string;
  prefillFormat?: Format;
  defaultObjective: string | null;
  defaultHookStyle: string | null;
  defaultContentType: string | null;
  defaultTone: string[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>(prefillFormat ?? "linkedin_post");
  const [idea, setIdea] = useState(prefillTopic ?? prefillBrief ?? "");
  const [length, setLength] = useState<LengthKey>("short"); // default Curto — direto ao usuário "esse conteúdo está longo"
  const [objective, setObjective] = useState<string | null>(defaultObjective);
  const [hookStyle, setHookStyle] = useState<string | null>(defaultHookStyle);
  const [contentType, setContentType] = useState<string | null>(defaultContentType);
  const [toneOverride, setToneOverride] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [calibrating, setCalibrating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ideaReady = idea.trim().length >= 8;

  async function submit() {
    if (!ideaReady) return;
    setBusy(true);
    setError(null);
    const text = idea.trim();
    let topic = text;
    let brief: string | null = null;
    const firstBreak = text.indexOf("\n");
    if (firstBreak > 0) {
      topic = text.slice(0, firstBreak).trim();
      brief = text.slice(firstBreak + 1).trim() || null;
    } else if (text.length > 100) {
      topic = text.slice(0, 80).trim();
      brief = text.slice(80).trim() || null;
    }

    const res = await apiFetch<{ draft: ContentDraft }>("/api/content/generate", {
      method: "POST",
      body: JSON.stringify({
        format,
        topic,
        brief,
        extra_instructions: extra.trim() || null,
        hook_style: hookStyle,
        objective,
        content_type: contentType,
        length,
        tone_override: toneOverride.length ? toneOverride : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/dashboard/content/${res.data.draft.id}`);
  }

  const calibrationCount = useMemo(() => {
    let n = 0;
    if (objective) n++;
    if (hookStyle) n++;
    if (contentType) n++;
    if (toneOverride.length) n++;
    if (extra.trim()) n++;
    return n;
  }, [objective, hookStyle, contentType, toneOverride, extra]);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        {/* TEMA */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Label htmlFor="idea" className="text-base font-medium">
            Sobre o que você quer escrever?
          </Label>
          <Textarea
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={`Pode ser tema (uma frase) ou ângulo completo.\n\nEx: "Por que viagem corporativa virou métrica de CFO."`}
            rows={5}
            className="mt-3 text-base"
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground">
            A primeira linha vira o tema. O resto serve de briefing.
          </p>
        </section>

        {/* FORMATO + TAMANHO — sempre visível, o que mais importa */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Formato
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <FormatChip
                  active={format === "linkedin_post"}
                  onClick={() => setFormat("linkedin_post")}
                  icon={Linkedin}
                  title="Post"
                />
                <FormatChip
                  active={format === "article"}
                  onClick={() => setFormat("article")}
                  icon={FileText}
                  title="Artigo"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tamanho
              </Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {CONTENT_LENGTHS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLength(l.key as LengthKey)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-center text-xs font-medium transition",
                      length === l.key
                        ? "border-brand-500 bg-brand-50/60 text-brand-700"
                        : "border-border bg-background text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {CONTENT_LENGTHS.find((l) => l.key === length)?.description}
              </p>
            </div>
          </div>
        </section>

        {/* CALIBRAR — colapsado por default. Reduz pressão de decidir tudo. */}
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setCalibrating((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-secondary/30"
            aria-expanded={calibrating}
          >
            <div className="flex items-center gap-3">
              <Sliders className="h-4 w-4 text-brand-600" />
              <div>
                <p className="text-sm font-medium">Calibrar (opcional)</p>
                <p className="text-xs text-muted-foreground">
                  Objetivo, abertura, tom específico, instruções extras.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {calibrationCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[10px] font-medium text-brand-700">
                  {calibrationCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  calibrating && "rotate-180"
                )}
              />
            </div>
          </button>

          {calibrating && (
            <div className="space-y-6 border-t border-border px-6 py-5">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pra que serve
                </Label>
                <div className="mt-2">
                  <CardSingleSelect
                    options={[...OBJECTIVES]}
                    selected={objective}
                    onChange={setObjective}
                    cols={2}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Como abrir o texto
                </Label>
                <div className="mt-2">
                  <CardSingleSelect
                    options={[...HOOK_STYLES]}
                    selected={hookStyle}
                    onChange={setHookStyle}
                    cols={2}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tipo de conteúdo
                </Label>
                <div className="mt-2">
                  <CardSingleSelect
                    options={[...CONTENT_TYPES]}
                    selected={contentType}
                    onChange={setContentType}
                    cols={2}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Tom específico deste post (substitui o seu tom padrão)
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Padrão:{" "}
                  {defaultTone.length
                    ? defaultTone
                        .map(
                          (t) => TONE_TRAITS.find((x) => x.key === t)?.label ?? t
                        )
                        .join(" · ")
                    : "—"}
                </p>
                <div className="mt-2">
                  <ChipMultiSelect
                    options={[...TONE_TRAITS]}
                    selected={toneOverride}
                    onChange={setToneOverride}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Instruções extras
                </Label>
                <Textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={`Ex: "Abre com um número. Não cite a Onfly diretamente. Termina com pergunta."`}
                  rows={3}
                  className="mt-2 text-sm"
                />
              </div>
            </div>
          )}
        </section>

        {/* ERRO + AÇÃO */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
          <p className="text-xs text-muted-foreground">
            {ideaReady
              ? `Tudo pronto — vai gerar como ${leaderName.split(" ")[0]}.`
              : "Escreve pelo menos uma frase pra gerar."}
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={submit}
            disabled={busy || !ideaReady}
          >
            {busy ? (
              <>
                <span className="shimmer h-2 w-2 rounded-full" /> Gerando…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Gerar draft
              </>
            )}
          </Button>
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-brand-600" /> Como o motor pensa
          </div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>1. Lê seu estilo (objetivos, tom, formatos, aberturas).</li>
            <li>2. Aplica as orientações de marketing da Onfly.</li>
            <li>3. Cruza com seus documentos e referências.</li>
            <li>4. Escreve uma primeira versão no seu jeito.</li>
            <li>5. Você pede ajustes em português comum depois.</li>
          </ul>
        </div>

        {/* Resumo do que vai gerar */}
        <div className="rounded-2xl border border-border bg-secondary/40 p-5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Resumo
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={format === "linkedin_post" ? "brand" : "soft"}>
              {format === "linkedin_post" ? "Post" : "Artigo"}
            </Badge>
            <Badge variant="outline">
              {CONTENT_LENGTHS.find((l) => l.key === length)?.label}
            </Badge>
            {objective && (
              <Badge variant="outline">
                {OBJECTIVES.find((o) => o.key === objective)?.label}
              </Badge>
            )}
            {hookStyle && (
              <Badge variant="outline">
                abertura:{" "}
                {HOOK_STYLES.find((h) => h.key === hookStyle)?.label.toLowerCase()}
              </Badge>
            )}
            {contentType && (
              <Badge variant="outline">
                {CONTENT_TYPES.find((c) => c.key === contentType)?.label}
              </Badge>
            )}
            {toneOverride.length > 0 && (
              <Badge variant="outline">
                tom: {toneOverride.length} traço{toneOverride.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sem ideia?
          </p>
          <p className="mt-2 text-sm">
            Roda o discovery — varremos suas fontes e devolvemos ângulos autorais.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href="/dashboard/discover">Descobrir pautas</a>
          </Button>
        </div>
      </aside>
    </div>
  );
}

function FormatChip({
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
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-50/60 text-brand-700"
          : "border-border bg-background text-muted-foreground hover:bg-secondary"
      )}
    >
      <Icon className="h-4 w-4" />
      {title}
    </button>
  );
}
