"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Multi-select chip picker — usado em tom, audiência, tipos, temas etc.
 */
export function ChipMultiSelect({
  options,
  selected,
  onChange,
  variant = "neutral",
}: {
  options: { key: string; label: string; description?: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  variant?: "neutral" | "danger";
}) {
  function toggle(k: string) {
    onChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => toggle(opt.key)}
            title={opt.description ?? opt.label}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? variant === "danger"
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-brand-500 bg-brand-500 text-white"
                : "border-border bg-background text-foreground hover:bg-secondary"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Multi-select de cards (label + descrição) — pra opções mais explicadas
 * (objetivos, formatos, hook styles).
 */
export function CardMultiSelect({
  options,
  selected,
  onChange,
  cols = 2,
}: {
  options: {
    key: string;
    label: string;
    description?: string;
    example?: string;
  }[];
  selected: string[];
  onChange: (next: string[]) => void;
  cols?: 1 | 2 | 3;
}) {
  function toggle(k: string) {
    onChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  }
  const gridCls =
    cols === 1
      ? "grid-cols-1"
      : cols === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";
  return (
    <div className={cn("grid gap-2", gridCls)}>
      {options.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => toggle(opt.key)}
            className={cn(
              "relative rounded-xl border p-3 text-left transition",
              active
                ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/40"
                : "border-border bg-card hover:border-brand-300 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{opt.label}</p>
              {active && (
                <Check className="h-4 w-4 shrink-0 text-brand-600" />
              )}
            </div>
            {opt.description && (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                {opt.description}
              </p>
            )}
            {opt.example && (
              <p className="mt-2 rounded-md bg-secondary/50 p-2 font-mono text-[10px] text-muted-foreground leading-snug whitespace-pre-line">
                {opt.example}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Single-select de cards — pra escolher 1 opção (objetivo, hook do post atual).
 */
export function CardSingleSelect({
  options,
  selected,
  onChange,
  allowClear = true,
  cols = 2,
}: {
  options: { key: string; label: string; description?: string; example?: string }[];
  selected: string | null;
  onChange: (next: string | null) => void;
  allowClear?: boolean;
  cols?: 1 | 2 | 3;
}) {
  const gridCls =
    cols === 1
      ? "grid-cols-1"
      : cols === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";
  return (
    <div className={cn("grid gap-2", gridCls)}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(active && allowClear ? null : opt.key)}
            className={cn(
              "relative rounded-xl border p-3 text-left transition",
              active
                ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/40"
                : "border-border bg-card hover:border-brand-300 hover:bg-secondary/50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-tight">{opt.label}</p>
              {active && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
            </div>
            {opt.description && (
              <p className="mt-1 text-xs text-muted-foreground leading-snug">
                {opt.description}
              </p>
            )}
            {opt.example && (
              <p className="mt-2 rounded-md bg-secondary/50 p-2 font-mono text-[10px] text-muted-foreground leading-snug whitespace-pre-line">
                {opt.example}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
