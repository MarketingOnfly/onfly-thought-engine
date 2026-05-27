"use client";

import { useMemo, useState } from "react";
import {
  Hash,
  Layers,
  LayoutGrid,
  MessageSquareQuote,
  NotebookPen,
  Quote,
  Save,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ChipMultiSelect, CardMultiSelect } from "@/components/preset-picker";
import type { LeaderProfile } from "@/lib/db/types";
import {
  AUDIENCE_SEGMENTS,
  CONTENT_FORMATS,
  CONTENT_TYPES,
  HOOK_STYLES,
  OBJECTIVES,
  THEMES_LIBRARY,
  TONE_AVOID,
  TONE_TRAITS,
} from "@/lib/style-presets";
import { cn } from "@/lib/utils";

type StyleForm = {
  target_audience: string;
  audience_segments: string[];
  tone_traits: string[];
  tone_avoid: string[];
  tone_examples: string;
  objectives: string[];
  preferred_formats: string[];
  content_types: string[];
  themes: string[];
  preferred_hook_styles: string[];
  custom_briefing: string;
};

type SectionMeta = {
  id: string;
  label: string;
  count: () => number;
  icon: typeof Users;
};

export default function StyleEditor({ initial }: { initial: LeaderProfile }) {
  const [form, setForm] = useState<StyleForm>({
    target_audience: initial.target_audience ?? "",
    audience_segments: initial.audience_segments ?? [],
    tone_traits: initial.tone_traits ?? [],
    tone_avoid: initial.tone_avoid ?? [],
    tone_examples: initial.tone_examples ?? "",
    objectives: initial.objectives ?? [],
    preferred_formats: initial.preferred_formats ?? [],
    content_types: initial.content_types ?? [],
    themes: initial.themes ?? [],
    preferred_hook_styles: initial.preferred_hook_styles ?? [],
    custom_briefing: initial.custom_briefing ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customTheme, setCustomTheme] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/profile/style", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          tone_examples: form.tone_examples.trim() || null,
          custom_briefing: form.custom_briefing.trim() || null,
          target_audience: form.target_audience.trim(),
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

  function addCustomTheme() {
    const t = customTheme.trim();
    if (!t) return;
    if (form.themes.includes(t)) return;
    setForm({ ...form, themes: [...form.themes, t] });
    setCustomTheme("");
  }

  const sections: SectionMeta[] = useMemo(
    () => [
      {
        id: "audiencia",
        label: "Audiência",
        count: () => form.audience_segments.length,
        icon: Users,
      },
      {
        id: "objetivos",
        label: "Objetivos",
        count: () => form.objectives.length,
        icon: Target,
      },
      {
        id: "voz",
        label: "Como você fala",
        count: () => form.tone_traits.length + form.tone_avoid.length,
        icon: MessageSquareQuote,
      },
      {
        id: "formatos",
        label: "Formatos",
        count: () => form.preferred_formats.length,
        icon: LayoutGrid,
      },
      {
        id: "tipos",
        label: "Tipos de post",
        count: () => form.content_types.length,
        icon: Layers,
      },
      {
        id: "temas",
        label: "Temas",
        count: () => form.themes.length,
        icon: Hash,
      },
      {
        id: "aberturas",
        label: "Aberturas",
        count: () => form.preferred_hook_styles.length,
        icon: Quote,
      },
      {
        id: "extras",
        label: "Observações",
        count: () => (form.custom_briefing.trim() ? 1 : 0),
        icon: NotebookPen,
      },
    ],
    [form]
  );

  return (
    <div className="mt-8">
      <SectionNav sections={sections} />

      <div className="mt-6 space-y-8">
        <Section
          id="audiencia"
          title="Audiência"
          subtitle="Pra quem você fala. Marca segmentos prontos e, se precisar, refina com texto."
          icon={Users}
        >
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Segmentos
          </Label>
          <div className="mt-3">
            <CardMultiSelect
              options={[...AUDIENCE_SEGMENTS]}
              selected={form.audience_segments}
              onChange={(v) => setForm({ ...form, audience_segments: v })}
              cols={3}
            />
          </div>
          <div className="mt-5">
            <Label>Refinamento livre (opcional)</Label>
            <Textarea
              value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
              placeholder="Especifica o porte, recorte de mercado, dor latente — só se os segmentos acima não chegarem."
              rows={3}
              className="mt-1"
            />
          </div>
        </Section>

        <Section
          id="objetivos"
          title="Objetivos"
          subtitle="Pra que cada conteúdo seu serve. O motor calibra o tipo de fechamento por aqui."
          icon={Target}
        >
          <CardMultiSelect
            options={[...OBJECTIVES]}
            selected={form.objectives}
            onChange={(v) => setForm({ ...form, objectives: v })}
            cols={2}
          />
        </Section>

        <Section
          id="voz"
          title="Como você fala"
          subtitle="Os traços do seu jeito e o que jamais aparece."
          icon={MessageSquareQuote}
        >
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Como você soa
          </Label>
          <div className="mt-3">
            <ChipMultiSelect
              options={[...TONE_TRAITS]}
              selected={form.tone_traits}
              onChange={(v) => setForm({ ...form, tone_traits: v })}
            />
          </div>
          <Label className="mt-5 block text-xs uppercase tracking-wide text-muted-foreground">
            O que NUNCA escrever
          </Label>
          <div className="mt-3">
            <ChipMultiSelect
              options={[...TONE_AVOID]}
              selected={form.tone_avoid}
              onChange={(v) => setForm({ ...form, tone_avoid: v })}
              variant="danger"
            />
          </div>
          <div className="mt-5">
            <Label>Exemplos do seu tom (opcional)</Label>
            <Textarea
              value={form.tone_examples}
              onChange={(e) => setForm({ ...form, tone_examples: e.target.value })}
              placeholder="Cole 1-2 trechos seus que captam bem como você fala."
              rows={4}
              className="mt-1"
            />
          </div>
        </Section>

        <Section
          id="formatos"
          title="Formatos que você publica"
          subtitle="Quais formatos fazem sentido no seu fluxo."
          icon={LayoutGrid}
        >
          <CardMultiSelect
            options={[...CONTENT_FORMATS]}
            selected={form.preferred_formats}
            onChange={(v) => setForm({ ...form, preferred_formats: v })}
            cols={3}
          />
        </Section>

        <Section
          id="tipos"
          title="Tipos de post que você publica"
          subtitle="As formas de história que você costuma contar."
          icon={Layers}
        >
          <CardMultiSelect
            options={[...CONTENT_TYPES]}
            selected={form.content_types}
            onChange={(v) => setForm({ ...form, content_types: v })}
            cols={2}
          />
        </Section>

        <Section
          id="temas"
          title="Seus temas"
          subtitle="Os assuntos em que você é referência. Marca os prontos ou adiciona o seu."
          icon={Hash}
        >
          <ChipMultiSelect
            options={[
              ...THEMES_LIBRARY.map((t) => ({ key: t, label: t })),
              // Temas custom (que não estão no THEMES_LIBRARY) viram chips
              // já marcados ao lado dos prontos. Clicar nelas remove.
              ...form.themes
                .filter((t) => !THEMES_LIBRARY.includes(t))
                .map((t) => ({
                  key: t,
                  label: t,
                  description: "Tema custom — clica pra remover.",
                })),
            ]}
            selected={form.themes}
            onChange={(v) => setForm({ ...form, themes: v })}
          />
          <div className="mt-4 flex gap-2">
            <Input
              value={customTheme}
              onChange={(e) => setCustomTheme(e.target.value)}
              placeholder="Adicionar tema novo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTheme();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addCustomTheme}
              disabled={!customTheme.trim()}
            >
              Adicionar
            </Button>
          </div>
        </Section>

        <Section
          id="aberturas"
          title="Como você gosta de abrir um post"
          subtitle="As aberturas que combinam com seu jeito. Viram opções rápidas na hora de criar."
          icon={Quote}
        >
          <CardMultiSelect
            options={[...HOOK_STYLES]}
            selected={form.preferred_hook_styles}
            onChange={(v) => setForm({ ...form, preferred_hook_styles: v })}
            cols={2}
          />
        </Section>

        <Section
          id="extras"
          title="Observações livres (opcional)"
          subtitle="Algo importante que não cabe nos campos acima — entra no contexto do motor sempre."
          icon={NotebookPen}
        >
          <Textarea
            value={form.custom_briefing}
            onChange={(e) => setForm({ ...form, custom_briefing: e.target.value })}
            rows={4}
          />
        </Section>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-4 z-10 mt-8 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {saved
            ? "Salvo. Próxima geração já usa essas configurações."
            : "Tudo é editável a qualquer momento."}
        </p>
        <Button variant="primary" size="lg" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function SectionNav({ sections }: { sections: SectionMeta[] }) {
  return (
    <nav
      aria-label="Seções do estilo"
      className="sticky top-16 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-border bg-background/80 p-1 backdrop-blur-md"
    >
      {sections.map((s) => {
        const count = s.count();
        const Icon = s.icon;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{s.label}</span>
            {count > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-100 px-1 text-[10px] font-semibold text-brand-700">
                {count}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function Section({
  id,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon?: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-32 rounded-2xl border border-border bg-card p-6 shadow-sm"
      )}
    >
      <header className="flex items-start gap-3">
        {Icon && (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl tracking-tight">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}
