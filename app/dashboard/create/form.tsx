"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  FileText,
  Linkedin,
  Paperclip,
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
  ContextAttachments,
  attachmentsToPromptBlock,
  type Attachment,
  type AngleSuggestion,
} from "@/components/context-attachments";
import {
  CONTENT_LENGTHS,
  CONTENT_TYPES,
  HOOK_STYLES,
  MOOD_VARIATIONS,
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
  prefillSource,
  defaultObjective,
  defaultHookStyle,
  defaultContentType,
  defaultTone,
}: {
  leaderName: string;
  prefillTopic?: string;
  prefillBrief?: string;
  prefillFormat?: Format;
  prefillSource?: { url: string; title: string; why_now: string | null } | null;
  defaultObjective: string | null;
  defaultHookStyle: string | null;
  defaultContentType: string | null;
  defaultTone: string[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>(prefillFormat ?? "linkedin_post");
  const [idea, setIdea] = useState(() => {
    const base = prefillTopic ?? prefillBrief ?? "";
    if (prefillSource?.why_now && base) {
      return `${base}\n\nPor que agora: ${prefillSource.why_now}`;
    }
    return base;
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsOpen, setAttachmentsOpen] = useState(
    !!prefillSource || false
  );
  const [length, setLength] = useState<LengthKey>("short"); // default Curto — direto ao usuário "esse conteúdo está longo"
  const [objective, setObjective] = useState<string | null>(defaultObjective);
  const [hookStyle, setHookStyle] = useState<string | null>(defaultHookStyle);
  const [contentType, setContentType] = useState<string | null>(defaultContentType);
  const [toneOverride, setToneOverride] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [calibrating, setCalibrating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variations, setVariations] = useState<1 | 2 | 3>(1);
  const [mood, setMood] = useState<"best_day" | "critical" | "reflective" | null>(
    null
  );
  const [factCheck, setFactCheck] = useState(false);
  const [overlap, setOverlap] = useState<{
    matches: { id: string; topic: string; created_at: string; shared: number }[];
    total: number;
  } | null>(null);

  const ideaReady = idea.trim().length >= 8;

  // Quando vem do discovery: adiciona o source como anexo e extrai
  // automaticamente. Roda 1x no mount.
  useEffect(() => {
    if (!prefillSource) return;
    const id = crypto.randomUUID();
    const seedAttachment: Attachment = {
      id,
      kind: "discovery",
      title: prefillSource.title,
      url: prefillSource.url,
      text: "",
      truncated: false,
      status: "fetching",
    };
    setAttachments([seedAttachment]);
    // Tenta extrair o conteúdo da fonte original
    (async () => {
      try {
        const res = await fetch("/api/context/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "news", url: prefillSource.url }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, status: "error", error: data.error ?? "Falhou" }
                : a
            )
          );
          return;
        }
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "ready",
                  kind: "discovery",
                  title: data.title || prefillSource.title,
                  text: data.text,
                  truncated: data.truncated,
                  comprehension: data.comprehension,
                }
              : a
          )
        );
      } catch (err) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: "error",
                  error: err instanceof Error ? err.message : "Erro",
                }
              : a
          )
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detecta assunto similar a posts dos últimos 30 dias (debounce 600ms)
  useEffect(() => {
    if (!ideaReady) {
      setOverlap(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/content/check-overlap?topic=${encodeURIComponent(idea.slice(0, 200))}`
        );
        if (res.ok) {
          const data = await res.json();
          setOverlap(data);
        }
      } catch {
        // silencioso
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [idea, ideaReady]);

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

    // Empacota anexos como bloco de contexto pra prompt
    const contextBlock = attachmentsToPromptBlock(attachments);
    const extraCombined = [extra.trim() || null, contextBlock || null]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // Reúne os key_facts de todas as compreensões dos materiais anexados.
    // O backend usa isso pra verificar que o draft cita pelo menos um.
    const mustCiteFacts = attachments
      .filter((a) => a.status === "ready" && a.comprehension?.key_facts?.length)
      .flatMap((a) => a.comprehension?.key_facts ?? [])
      .slice(0, 12);

    const res = await apiFetch<{ draft: ContentDraft }>("/api/content/generate", {
      method: "POST",
      body: JSON.stringify({
        format,
        topic,
        brief,
        extra_instructions: extraCombined || null,
        hook_style: hookStyle,
        objective,
        content_type: contentType,
        length,
        tone_override: toneOverride.length ? toneOverride : null,
        variations,
        mood,
        fact_check: factCheck,
        must_cite_facts: mustCiteFacts.length ? mustCiteFacts : null,
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
    if (mood) n++;
    if (factCheck) n++;
    if (extra.trim()) n++;
    return n;
  }, [objective, hookStyle, contentType, toneOverride, mood, factCheck, extra]);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-5">
        {/* TEMA */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="idea" className="text-base font-medium">
              Sobre o que você quer escrever?
            </Label>
            {prefillSource && (
              <Badge variant="brand" className="text-[10px]">
                <Sparkles className="h-3 w-3" /> vindo do discovery
              </Badge>
            )}
          </div>
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

        {/* MATERIAL DE APOIO — anexos */}
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setAttachmentsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-secondary/30"
            aria-expanded={attachmentsOpen}
          >
            <div className="flex items-center gap-3">
              <Paperclip className="h-4 w-4 text-brand-600" />
              <div>
                <p className="text-sm font-medium">
                  Material de apoio (opcional)
                </p>
                <p className="text-xs text-muted-foreground">
                  Vídeo do YouTube, notícia ou PDF. O motor usa como
                  matéria-prima e pode sugerir ângulos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {attachments.length > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[10px] font-medium text-brand-700">
                  {attachments.length}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  attachmentsOpen && "rotate-180"
                )}
              />
            </div>
          </button>

          {attachmentsOpen && (
            <div className="border-t border-border px-6 py-5">
              <ContextAttachments
                attachments={attachments}
                onAdd={(a) => setAttachments((prev) => [...prev, a])}
                onUpdate={(id, patch) =>
                  setAttachments((prev) =>
                    prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
                  )
                }
                onRemove={(id) =>
                  setAttachments((prev) => prev.filter((a) => a.id !== id))
                }
                onPickAngle={(angle: AngleSuggestion) => {
                  setIdea(`${angle.label}\n\n${angle.summary}`);
                  // garante que o usuário veja onde foi parar
                  document
                    .getElementById("idea")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            </div>
          )}
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

          {/* Seletor de variações */}
          <div className="mt-5 border-t border-border pt-5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Quantas versões gerar
            </Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setVariations(n as 1 | 2 | 3)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-center text-xs font-medium transition",
                    variations === n
                      ? "border-brand-500 bg-brand-50/60 text-brand-700"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {n === 1 ? "1 versão" : `${n} versões`}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {variations === 1
                ? "Padrão — o motor gera uma versão e você revisa."
                : `O motor gera ${variations} versões com aberturas distintas em paralelo. Você escolhe ou mistura. Demora ${variations}x mais.`}
            </p>
          </div>
        </section>

        {/* Aviso de assunto repetido */}
        {overlap && overlap.total > 0 && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 text-xs">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Você já tem {overlap.total} conteúdo{overlap.total === 1 ? "" : "s"} parecido{overlap.total === 1 ? "" : "s"} nos últimos 30 dias
                </p>
                <ul className="mt-2 space-y-1.5">
                  {overlap.matches.slice(0, 3).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/content/${m.id}`}
                        className="truncate hover:underline"
                      >
                        {m.topic}
                      </Link>
                      <span className="shrink-0 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 opacity-70">
                  Tem certeza que quer escrever esse de novo? Considera trocar de
                  ângulo ou pilar.
                </p>
              </div>
            </div>
          </section>
        )}

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
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Como abrir o texto
                  </Label>
                  {!hookStyle && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      <Sparkles className="h-2.5 w-2.5" /> Automático
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hookStyle
                    ? "Você forçou um estilo. Pra deixar o motor escolher, clique no selecionado pra desmarcar."
                    : "O motor escolhe o melhor hook baseado na sua ideia, perfil e guidelines. Só selecione se quiser forçar um padrão específico."}
                </p>
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
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tipo de conteúdo
                  </Label>
                  {!contentType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                      <Sparkles className="h-2.5 w-2.5" /> Automático
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {contentType
                    ? "Você forçou um tipo. Pra deixar automático, clique no selecionado."
                    : "O motor identifica o melhor ângulo (newsjacking, contrarian, bastidor, etc.) a partir da ideia + anexos. Só fixe se já souber o que quer."}
                </p>
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
                  Em que humor está hoje
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Define o estado emocional do texto. Se gerar 2-3 versões, cada
                  uma usa um humor distinto.
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {MOOD_VARIATIONS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() =>
                        setMood(mood === m.key ? null : (m.key as typeof mood))
                      }
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        mood === m.key
                          ? "border-brand-500 bg-brand-50/60"
                          : "border-border bg-background hover:bg-secondary/50"
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          mood === m.key && "text-brand-700"
                        )}
                      >
                        {m.label}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {m.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Verificação de fato (opcional)
                </Label>
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 transition hover:bg-secondary/30">
                  <input
                    type="checkbox"
                    checked={factCheck}
                    onChange={(e) => setFactCheck(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand-600"
                  />
                  <div className="text-xs">
                    <p className="font-medium text-foreground">
                      Verificar números na web durante a geração
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Motor busca dados reais antes de citar estatística. Mais
                      lento (+30s) mas evita número inventado.
                    </p>
                  </div>
                </label>
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
