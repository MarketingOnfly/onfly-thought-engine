"use client";

import { useState } from "react";
import {
  ClipboardPaste,
  FileText,
  Link2,
  Loader2,
  Newspaper,
  Sparkles,
  Trash2,
  Upload,
  Youtube,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  comprehensionAsPromptBlock,
  type LinkComprehension,
} from "@/lib/anthropic/comprehend-link";

export type AttachmentKind = "youtube" | "news" | "pdf" | "discovery";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  title: string;
  url: string | null;
  text: string;
  truncated: boolean;
  status: "fetching" | "ready" | "error";
  error?: string;
  // Compreensão estruturada do material (Claude leu o texto e devolveu
  // fatos). Quando presente, é o que vai pro prompt. Texto cru é só
  // fallback de exibição.
  comprehension?: LinkComprehension;
}

export interface AngleSuggestion {
  label: string;
  summary: string;
  why_for_you: string;
}

interface Props {
  attachments: Attachment[];
  onAdd: (a: Attachment) => void;
  onUpdate: (id: string, patch: Partial<Attachment>) => void;
  onRemove: (id: string) => void;
  onPickAngle: (angle: AngleSuggestion) => void;
}

const ICON_BY_KIND: Record<AttachmentKind, typeof Youtube> = {
  youtube: Youtube,
  news: Newspaper,
  pdf: FileText,
  discovery: Sparkles,
};

const LABEL_BY_KIND: Record<AttachmentKind, string> = {
  youtube: "Vídeo",
  news: "Notícia",
  pdf: "PDF",
  discovery: "Discovery",
};

export function ContextAttachments({
  attachments,
  onAdd,
  onUpdate,
  onRemove,
  onPickAngle,
}: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [angles, setAngles] = useState<AngleSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Snippet form (colar trecho direto — resolve LinkedIn/paywall)
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [snippetText, setSnippetText] = useState("");
  const [snippetSourceUrl, setSnippetSourceUrl] = useState("");

  const readyCount = attachments.filter((a) => a.status === "ready").length;

  async function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setError(null);

    let kind: AttachmentKind = "news";
    if (/youtu\.be|youtube\.com/i.test(url)) kind = "youtube";

    const id = crypto.randomUUID();
    onAdd({
      id,
      kind,
      title: url,
      url,
      text: "",
      truncated: false,
      status: "fetching",
    });
    setUrlInput("");
    setAdding(true);

    try {
      const res = await fetch("/api/context/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, url }),
      });
      const data = await res.json();
      if (!res.ok) {
        onUpdate(id, { status: "error", error: data.error ?? "Falhou" });
      } else {
        onUpdate(id, {
          status: "ready",
          kind: data.kind,
          title: data.title,
          text: data.text,
          truncated: data.truncated,
          comprehension: data.comprehension,
        });
      }
    } catch (err) {
      onUpdate(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Erro",
      });
    } finally {
      setAdding(false);
    }
  }

  /**
   * Adiciona um trecho colado direto. Resolve LinkedIn (que web_search
   * não lê bem) ou qualquer paywall total. Cara mais cola o texto.
   */
  async function addSnippet(opts: {
    title: string;
    text: string;
    sourceUrl?: string | null;
  }) {
    if (opts.text.trim().length < 20) {
      setError("O trecho precisa ter pelo menos 20 caracteres.");
      return;
    }
    setError(null);
    const id = crypto.randomUUID();
    onAdd({
      id,
      kind: "news", // tipo "news" pra compatibilidade com pipeline existente
      title: opts.title.trim() || "Trecho colado",
      url: opts.sourceUrl ?? null,
      text: opts.text,
      truncated: false,
      status: "fetching",
    });

    try {
      const res = await fetch("/api/context/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "snippet",
          title: opts.title.trim() || "Trecho colado",
          text: opts.text,
          source_url: opts.sourceUrl ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onUpdate(id, { status: "error", error: data.error ?? "Falhou" });
      } else {
        onUpdate(id, {
          status: "ready",
          kind: data.kind,
          title: data.title,
          text: data.text,
          truncated: data.truncated,
          comprehension: data.comprehension,
        });
      }
    } catch (err) {
      onUpdate(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Erro",
      });
    }
  }

  async function uploadPdf(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      setError("PDF acima de 15MB");
      return;
    }
    setError(null);
    const id = crypto.randomUUID();
    onAdd({
      id,
      kind: "pdf",
      title: file.name,
      url: null,
      text: "",
      truncated: false,
      status: "fetching",
    });

    const supabase = createSupabaseBrowserClient();
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id;
    if (!userId) {
      onUpdate(id, { status: "error", error: "Sessão expirou" });
      return;
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("leader-documents")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "application/pdf",
      });
    if (upErr) {
      onUpdate(id, { status: "error", error: upErr.message });
      return;
    }

    try {
      const res = await fetch("/api/context/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "pdf",
          storage_path: path,
          name: file.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onUpdate(id, { status: "error", error: data.error ?? "Falhou" });
      } else {
        onUpdate(id, {
          status: "ready",
          title: data.title,
          text: data.text,
          truncated: data.truncated,
          comprehension: data.comprehension,
        });
      }
    } catch (err) {
      onUpdate(id, {
        status: "error",
        error: err instanceof Error ? err.message : "Erro",
      });
    }
  }

  async function suggestAngles() {
    const ready = attachments.filter(
      (a) => a.status === "ready" && a.text.trim().length > 40
    );
    if (!ready.length) return;
    setSuggesting(true);
    setAngles(null);
    setError(null);
    try {
      const res = await fetch("/api/context/suggest-angles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attachments: ready.map((a) => ({
            kind: a.kind,
            title: a.title,
            url: a.url,
            text: a.text,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não consegui sugerir ângulos.");
      } else {
        setAngles(data.angles ?? []);
      }
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Cole link de vídeo, notícia, solta um PDF, ou cola um trecho direto
        (LinkedIn / paywall / qualquer texto). O motor lê tudo, junta com
        seu estilo e (se quiser) sugere ângulos pra você partir.
      </p>

      {/* Input de URL */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://… (vídeo do YouTube ou notícia)"
            className="border-0 bg-transparent px-0 py-0 focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addUrl();
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void addUrl()}
          disabled={!urlInput.trim() || adding}
        >
          {adding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Adicionar"
          )}
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary">
          <Upload className="h-3.5 w-3.5" />
          PDF
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPdf(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setSnippetOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
          title="Pra LinkedIn, paywalls, ou qualquer texto que você tenha na mão"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Colar trecho
        </button>
      </div>

      {/* Form de snippet — colar trecho direto */}
      {snippetOpen && (
        <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/30 p-3">
          <p className="text-xs text-muted-foreground">
            Cola aqui o texto que você quer usar como referência. Resolve
            LinkedIn (que não dá pra ler de fora), paywall, ou qualquer
            material que você tem na mão.
          </p>
          <Input
            value={snippetTitle}
            onChange={(e) => setSnippetTitle(e.target.value)}
            placeholder="Título / origem do trecho"
            className="text-sm"
          />
          <textarea
            value={snippetText}
            onChange={(e) => setSnippetText(e.target.value)}
            placeholder="Cole o texto aqui (mínimo 20 caracteres)…"
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
          />
          <Input
            value={snippetSourceUrl}
            onChange={(e) => setSnippetSourceUrl(e.target.value)}
            placeholder="URL de origem (opcional) — pra rastreio no editor"
            className="text-xs"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSnippetOpen(false);
                setSnippetTitle("");
                setSnippetText("");
                setSnippetSourceUrl("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              size="sm"
              disabled={snippetText.trim().length < 20}
              onClick={async () => {
                await addSnippet({
                  title: snippetTitle,
                  text: snippetText,
                  sourceUrl: snippetSourceUrl.trim() || null,
                });
                setSnippetOpen(false);
                setSnippetTitle("");
                setSnippetText("");
                setSnippetSourceUrl("");
              }}
            >
              Adicionar trecho
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Lista de anexos */}
      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((a) => {
            const Icon = ICON_BY_KIND[a.kind];
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-xl border bg-card p-3 transition-colors",
                  a.status === "error"
                    ? "border-destructive/30 bg-destructive/5"
                    : a.status === "ready"
                      ? "border-border"
                      : "border-brand-200 bg-brand-50/30"
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      a.status === "ready"
                        ? "text-brand-600"
                        : a.status === "error"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {LABEL_BY_KIND[a.kind]}
                      </Badge>
                      {a.status === "fetching" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-brand-700">
                          <Loader2 className="h-3 w-3 animate-spin" /> lendo…
                        </span>
                      )}
                      {a.truncated && a.status === "ready" && (
                        <span className="text-[10px] text-amber-700">
                          truncado
                        </span>
                      )}
                      {a.status === "ready" &&
                        (!a.comprehension ||
                          a.comprehension.comprehension_failed ||
                          a.comprehension.source_quality === "low_signal" ||
                          (a.comprehension.key_facts?.length ?? 0) === 0) && (
                          <span
                            className="text-[10px] font-medium text-amber-700"
                            title="O sistema baixou a página mas não conseguiu estruturar fatos. Geralmente paywall ou anti-bot. O motor vai tentar buscar com web_search na hora de gerar, mas se não achar, vai pedir pra você colar o trecho."
                          >
                            ⚠ leitura parcial
                          </span>
                        )}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {a.title}
                    </p>
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {a.url}
                      </a>
                    )}
                    {a.status === "error" && (
                      <p className="mt-1 text-xs text-destructive">
                        {a.error}
                      </p>
                    )}
                    {a.status === "ready" && a.text && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        {a.text.slice(0, 280)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(a.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Sugestão de ângulos */}
      {readyCount > 0 && (
        <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Quer 3 ângulos autorais a partir desses materiais?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void suggestAngles()}
              disabled={suggesting}
            >
              {suggesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Sugerir ângulos
                </>
              )}
            </Button>
          </div>

          {angles && angles.length > 0 && (
            <div className="mt-3 space-y-2">
              {angles.map((angle, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickAngle(angle)}
                  className="block w-full rounded-lg border border-border bg-card p-3 text-left transition hover:border-brand-400 hover:shadow-sm"
                >
                  <p className="text-sm font-medium text-brand-900">
                    {angle.label}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-foreground/80">
                    {angle.summary}
                  </p>
                  {angle.why_for_you && (
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      por que pra você:{" "}
                      <span className="normal-case text-muted-foreground/90">
                        {angle.why_for_you}
                      </span>
                    </p>
                  )}
                </button>
              ))}
              <p className="text-center text-[10px] text-muted-foreground">
                Clica num ângulo pra usar como ponto de partida.
              </p>
            </div>
          )}

          {angles && angles.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Não consegui tirar ângulos desse material. Adiciona mais
              contexto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Limpa em dashes e tells claros de IA do texto extraído ANTES de injetar
 * no prompt. Fallback pra quando a compreensão estruturada falhou.
 */
function sanitizeExtractedText(raw: string): string {
  return raw
    .replace(/ — /g, ", ")
    .replace(/—/g, ", ")
    .replace(/  +/g, " ");
}

/**
 * Formata os anexos prontos como bloco de texto pra injetar no prompt
 * de geração — vai junto do `extra_instructions`.
 *
 * MUDANÇA IMPORTANTE: agora o default é usar a COMPREENSÃO estruturada
 * que o Claude já fez do material (key_facts, key_quotes, etc.). Texto
 * cru só é usado se a compreensão falhou (low_signal ou comprehension_failed).
 *
 * Antes: jogávamos HTML-stripped no prompt. Modelo lia em modo skim,
 * subliminamente copiava estilo da fonte, e às vezes nem citava fact
 * concreto. Agora: modelo vê SÓ fatos limpos.
 */
export function attachmentsToPromptBlock(attachments: Attachment[]): string {
  const ready = attachments.filter(
    (a) => a.status === "ready" && a.text.trim().length > 0
  );
  if (!ready.length) return "";

  // Separa: anexos com compreensão estruturada vs fallback
  const withComprehension = ready
    .map((a, i) => ({ attachment: a, index: i }))
    .filter(
      (
        x
      ): x is { attachment: Attachment & { comprehension: LinkComprehension }; index: number } =>
        !!x.attachment.comprehension &&
        !x.attachment.comprehension.comprehension_failed
    );

  const withoutComprehension = ready
    .map((a, i) => ({ attachment: a, index: i }))
    .filter(
      ({ attachment }) =>
        !attachment.comprehension || attachment.comprehension.comprehension_failed
    );

  const sections: string[] = [];

  // Bloco 1: anexos com compreensão estruturada (path principal)
  if (withComprehension.length > 0) {
    sections.push(
      comprehensionAsPromptBlock(
        withComprehension.map(({ attachment, index }) => ({
          comprehension: attachment.comprehension!,
          index,
        }))
      )
    );
  }

  // Bloco 2: anexos sem compreensão (fallback - cuidado redobrado)
  if (withoutComprehension.length > 0) {
    sections.push(
      [
        "MATERIAIS DE APOIO SEM COMPREENSÃO ESTRUTURADA (cautela):",
        "Estes materiais não foram destilados em fatos estruturados (paywall, conteúdo pobre, ou falha). Use SÓ pra pegar fato concreto. NUNCA copie tom/estilo.",
        "",
        ...withoutComprehension.map(({ attachment: a, index }) => {
          const kindLabel =
            a.kind === "youtube"
              ? "Vídeo"
              : a.kind === "news"
                ? "Notícia"
                : a.kind === "pdf"
                  ? "PDF"
                  : "Fonte de discovery";
          const sanitized = sanitizeExtractedText(a.text);
          return `[${index + 1}] ${kindLabel}: ${a.title}${
            a.url ? ` (${a.url})` : ""
          }\n${sanitized.slice(0, 3000)}`;
        }),
      ].join("\n")
    );
  }

  return sections.join("\n\n");
}
