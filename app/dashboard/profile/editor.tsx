"use client";

import { useState } from "react";
import { Linkedin, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { LeaderProfile } from "@/lib/db/types";

const TONE_TRAITS = [
  "Direto",
  "Provocativo",
  "Analítico",
  "Bastidor de operador",
  "Histórias pessoais",
  "Dado em primeiro plano",
  "Contraintuitivo",
  "Bem-humorado",
  "Crítico de mercado",
  "Otimista mas realista",
];

const TONE_AVOID = [
  "Jargão americano cru",
  '"No fim do dia"',
  "Hooks com emoji",
  "Listas de '3 lições'",
  "Tom motivacional",
  "Auto-elogio explícito",
  "Em dashes decorativos",
  "Frases longas demais",
];

export default function ProfileEditor({ initial }: { initial: LeaderProfile }) {
  const [form, setForm] = useState({
    full_name: initial.full_name,
    role: initial.role,
    area: initial.area,
    linkedin_url: initial.linkedin_url ?? "",
    target_audience: initial.target_audience,
    tone_traits: initial.tone_traits,
    tone_avoid: initial.tone_avoid,
    tone_examples: initial.tone_examples ?? "",
    main_objective: initial.main_objective,
    custom_briefing: initial.custom_briefing ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(field: "tone_traits" | "tone_avoid", value: string) {
    setForm((prev) => {
      const arr = prev[field];
      const exists = arr.includes(value);
      return {
        ...prev,
        [field]: exists ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          linkedin_url: form.linkedin_url.trim() || null,
          tone_examples: form.tone_examples.trim() || null,
          custom_briefing: form.custom_briefing.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao salvar");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Nome completo</Label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Cargo</Label>
          <Input
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label>Área</Label>
        <Input
          value={form.area}
          onChange={(e) => setForm({ ...form, area: e.target.value })}
          className="mt-2"
        />
      </div>

      <div>
        <Label className="flex items-center gap-2">
          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
        </Label>
        <Input
          value={form.linkedin_url}
          onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
          className="mt-2"
          placeholder="https://www.linkedin.com/in/seu-perfil"
        />
      </div>

      <div>
        <Label>Audiência-alvo</Label>
        <Textarea
          value={form.target_audience}
          onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
          rows={5}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Traços do tom</Label>
        <div className="mt-3 flex flex-wrap gap-2">
          {TONE_TRAITS.map((t) => {
            const active = form.tone_traits.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle("tone_traits", t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-border bg-background hover:bg-secondary"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>O que NUNCA escrever</Label>
        <div className="mt-3 flex flex-wrap gap-2">
          {TONE_AVOID.map((t) => {
            const active = form.tone_avoid.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle("tone_avoid", t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-background hover:bg-secondary"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Exemplos do seu tom</Label>
        <Textarea
          value={form.tone_examples}
          onChange={(e) => setForm({ ...form, tone_examples: e.target.value })}
          rows={6}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Objetivo principal de thought leadership</Label>
        <Textarea
          value={form.main_objective}
          onChange={(e) => setForm({ ...form, main_objective: e.target.value })}
          rows={4}
          className="mt-2"
        />
      </div>

      <div>
        <Label>Briefing livre</Label>
        <Textarea
          value={form.custom_briefing}
          onChange={(e) => setForm({ ...form, custom_briefing: e.target.value })}
          rows={4}
          className="mt-2"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        {saved && (
          <p className="text-xs text-brand-700">Salvo.</p>
        )}
        <Button variant="primary" onClick={save} disabled={saving} className="ml-auto">
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
