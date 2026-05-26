"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  X as XIcon,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  href: string;
  done: boolean;
  hint?: string;
}

interface Props {
  items: ChecklistItem[];
}

export function OnboardingChecklist({ items }: Props) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;
  const [hidden, setHidden] = useState(false);

  if (allDone || hidden) return null;

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-brand-900">
              Setup do seu motor — {done} de {total} passos
            </h2>
            <p className="text-xs text-brand-700">
              Quanto mais completo, mais o conteúdo sai na sua voz.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="text-brand-700 hover:text-brand-900"
          aria-label="Esconder"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                it.done
                  ? "text-brand-700/70 hover:bg-brand-100/50"
                  : "text-brand-900 hover:bg-brand-100/60"
              )}
            >
              {it.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-brand-400" />
              )}
              <span
                className={cn(
                  "flex-1",
                  it.done && "line-through decoration-brand-400/60"
                )}
              >
                {it.label}
              </span>
              {!it.done && (
                <span className="text-[10px] text-brand-600">→</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
