"use client";

import { useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/confirm";
import { formatDate } from "@/lib/utils";
import type { DraftVersion } from "@/lib/db/types";

interface Props {
  draftId: string;
  onRestored: (newBody: string) => void;
}

export function VersionsHistory({ draftId, onRestored }: Props) {
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${draftId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
  }, [open, draftId]);

  async function restore(v: DraftVersion) {
    const ok = await confirm({
      title: "Restaurar essa versão?",
      description:
        "A versão atual vira histórico, e essa antiga passa a ser o draft principal.",
      confirmText: "Restaurar",
    });
    if (!ok) return;
    setRestoring(v.id);
    try {
      const res = await fetch(`/api/content/${draftId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version_id: v.id }),
      });
      if (res.ok) {
        const data = await res.json();
        onRestored(data.draft.draft_markdown);
        await load();
      }
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-medium">Histórico de versões</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? "fechar" : "abrir"}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma versão antiga ainda. Cada revisão e restauração cria uma.
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        {v.reason ?? "Versão antiga"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDate(v.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => restore(v)}
                      disabled={!!restoring}
                    >
                      {restoring === v.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restaurar
                    </Button>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {v.body.slice(0, 200)}
                    {v.body.length > 200 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
