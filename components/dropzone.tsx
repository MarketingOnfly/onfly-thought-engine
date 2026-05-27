"use client";

import { useCallback, useId, useRef, useState } from "react";
import { CheckCircle2, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LeaderDocument } from "@/lib/db/types";

interface UploadState {
  name: string;
  size: number;
  status: "uploading" | "parsing" | "done" | "error";
  error?: string;
}

const ACCEPTED = ".pdf,.docx,.txt,.md,.markdown";
const ACCEPTED_HINT = "PDF · DOCX · TXT · MD";
const MAX_BYTES = 15 * 1024 * 1024;

export function Dropzone({
  onUploaded,
  className,
  compact = false,
}: {
  onUploaded?: (items: LeaderDocument[]) => void;
  className?: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<UploadState[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;

      // Validação de tamanho no cliente
      const tooBig = arr.filter((f) => f.size > MAX_BYTES);
      const okFiles = arr.filter((f) => f.size <= MAX_BYTES);

      if (tooBig.length) {
        setItems((prev) => [
          ...prev,
          ...tooBig.map<UploadState>((f) => ({
            name: f.name,
            size: f.size,
            status: "error",
            error: `Acima de ${Math.round(MAX_BYTES / 1024 / 1024)}MB`,
          })),
        ]);
      }
      if (!okFiles.length) return;

      // Optimistic UI
      const initial: UploadState[] = okFiles.map((f) => ({
        name: f.name,
        size: f.size,
        status: "uploading",
      }));
      setItems((prev) => [...prev, ...initial]);

      const supabase = createSupabaseBrowserClient();
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) {
        setItems((prev) =>
          prev.map((it) =>
            initial.find((i) => i.name === it.name)
              ? { ...it, status: "error", error: "Sessão expirou" }
              : it
          )
        );
        return;
      }

      // Sobe cada arquivo direto pro Storage — sem passar pelo route
      // handler do Vercel (que tem limite de ~4.5MB).
      const uploads = await Promise.all(
        okFiles.map(async (f) => {
          const safeName = f.name.replace(/[^\w.\-]+/g, "_");
          const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
          const { error } = await supabase.storage
            .from("leader-documents")
            .upload(path, f, {
              upsert: false,
              contentType: f.type || "application/octet-stream",
            });
          if (error) {
            return {
              name: f.name,
              ok: false as const,
              error: error.message,
            };
          }
          return { name: f.name, ok: true as const, path };
        })
      );

      // Atualiza UI: storage upload OK → vai pra "parsing"
      setItems((prev) =>
        prev.map((it) => {
          const u = uploads.find((x) => x.name === it.name);
          if (!u || it.status !== "uploading") return it;
          return u.ok
            ? { ...it, status: "parsing" }
            : { ...it, status: "error", error: u.error };
        })
      );

      const toParse = uploads.filter((u) => u.ok) as Array<{
        name: string;
        ok: true;
        path: string;
      }>;
      if (!toParse.length) return;

      // Chama o server pra puxar do Storage, parsear e salvar
      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: toParse.map((u) => ({ storage_path: u.path, name: u.name })),
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setItems((prev) =>
            prev.map((it) =>
              toParse.find((u) => u.name === it.name) && it.status === "parsing"
                ? { ...it, status: "error", error: data.error ?? "Falha no parse" }
                : it
            )
          );
          return;
        }

        const createdNames: string[] = (data.items ?? []).map(
          (it: { name: string }) => it.name
        );
        const failedMap: Record<string, string> = Object.fromEntries(
          (data.failed ?? []).map((it: { name: string; error: string }) => [
            it.name,
            it.error,
          ])
        );

        setItems((prev) =>
          prev.map((it) => {
            if (it.status !== "parsing") return it;
            if (createdNames.includes(it.name)) return { ...it, status: "done" };
            if (failedMap[it.name])
              return { ...it, status: "error", error: failedMap[it.name] };
            return it;
          })
        );

        if (data.items?.length && onUploaded) onUploaded(data.items);
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            toParse.find((u) => u.name === it.name) && it.status === "parsing"
              ? {
                  ...it,
                  status: "error",
                  error: err instanceof Error ? err.message : "Erro",
                }
              : it
          )
        );
      }
    },
    [onUploaded]
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function clearDone() {
    setItems((prev) => prev.filter((it) => it.status !== "done"));
  }

  return (
    <div className={cn("space-y-3", className)}>
      <label
        htmlFor={inputId}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/30 text-center transition-colors",
          compact ? "p-6" : "p-10",
          dragging && "border-brand-500 bg-brand-50/60"
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPTED}
          onChange={onInputChange}
          className="hidden"
        />
        <Upload
          className={cn(
            "text-brand-600 transition-transform",
            compact ? "h-6 w-6" : "h-10 w-10",
            dragging && "scale-110"
          )}
        />
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {dragging ? "Solta aqui" : "Arraste arquivos ou clica pra escolher"}
        </p>
        <p className="text-xs text-muted-foreground">{ACCEPTED_HINT} · máx 15MB cada</p>
      </label>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={`${it.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              <span className="text-xs text-muted-foreground">
                {humanSize(it.size)}
              </span>
              {it.status === "uploading" && (
                <span className="font-mono text-xs text-brand-700">enviando…</span>
              )}
              {it.status === "parsing" && (
                <span className="font-mono text-xs text-brand-700">lendo…</span>
              )}
              {it.status === "done" && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
              )}
              {it.status === "error" && (
                <span className="text-xs text-destructive">{it.error ?? "erro"}</span>
              )}
            </li>
          ))}
          {items.some((it) => it.status === "done") && (
            <button
              type="button"
              onClick={clearDone}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Limpar concluídos
            </button>
          )}
        </ul>
      )}
    </div>
  );
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
