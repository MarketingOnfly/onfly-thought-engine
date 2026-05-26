"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AltVersion } from "@/lib/db/types";

interface Props {
  primary: string;
  primaryLabel?: string;
  alternates: AltVersion[];
  activeIndex: number;
  onPick: (index: number) => void;
  onPromote: (versionId: string) => Promise<void>;
}

/**
 * Mostra abas Versão A / B / C quando há variações geradas no mesmo prompt.
 * activeIndex 0 = primary (draft_markdown). 1+ = alternates[0..].
 */
export function VariationsTabs({
  primary,
  primaryLabel,
  alternates,
  activeIndex,
  onPick,
  onPromote,
}: Props) {
  const [promoting, setPromoting] = useState<string | null>(null);
  if (!alternates.length) return null;

  const all = [
    { id: "primary", label: primaryLabel ?? "Versão A", body: primary },
    ...alternates.map((a) => ({ id: a.id, label: a.label, body: a.body })),
  ];

  async function promote(id: string) {
    setPromoting(id);
    try {
      await onPromote(id);
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="border-b border-border">
      <div className="flex flex-wrap items-center gap-1 p-1">
        {all.map((v, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onPick(i)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted-foreground hover:bg-secondary"
              )}
            >
              {v.label}
            </button>
          );
        })}
        {activeIndex > 0 && (
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={() => promote(alternates[activeIndex - 1].id)}
            disabled={!!promoting}
          >
            {promoting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Promovendo…
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> Usar esta versão
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
