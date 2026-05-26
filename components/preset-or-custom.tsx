"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const CUSTOM_TOKEN = "__custom__";

/**
 * Dropdown com presets + opção "Outro (digitar)" que abre um input livre.
 * Mantém compatibilidade com valores legados — se o valor inicial não bate com
 * nenhum preset, já entra em modo livre.
 */
export function PresetOrCustom({
  presets,
  value,
  onChange,
  placeholderSelect = "Escolha…",
  placeholderInput = "Digite…",
  customLabel = "Outro (digitar)",
}: {
  presets: readonly string[];
  value: string;
  onChange: (next: string) => void;
  placeholderSelect?: string;
  placeholderInput?: string;
  customLabel?: string;
}) {
  const isPreset = presets.includes(value);
  const [customMode, setCustomMode] = useState(!isPreset && value.length > 0);

  if (customMode) {
    return (
      <div className="space-y-1.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderInput}
          autoFocus={value.length === 0}
        />
        <button
          type="button"
          onClick={() => {
            setCustomMode(false);
            onChange("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Escolher da lista
        </button>
      </div>
    );
  }

  return (
    <Select
      value={isPreset ? value : ""}
      onValueChange={(v) => {
        if (v === CUSTOM_TOKEN) {
          setCustomMode(true);
          onChange("");
          return;
        }
        onChange(v);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholderSelect} />
      </SelectTrigger>
      <SelectContent>
        {presets.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
        <SelectItem value={CUSTOM_TOKEN}>{customLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}
