"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Linkedin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { LeaderProfile } from "@/lib/db/types";
import StepReferences from "./step-references";
import StepDocuments from "./step-documents";

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

export default function OnboardingWizard({
  initialProfile,
  userEmail,
}: {
  initialProfile: LeaderProfile | null;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: initialProfile?.full_name ?? "",
    role: initialProfile?.role ?? "",
    area: initialProfile?.area ?? "",
    linkedin_url: initialProfile?.linkedin_url ?? "",
    target_audience: initialProfile?.target_audience ?? "",
    tone_traits: initialProfile?.tone_traits ?? [],
    tone_avoid: initialProfile?.tone_avoid ?? [],
    tone_examples: initialProfile?.tone_examples ?? "",
    main_objective: initialProfile?.main_objective ?? "",
    custom_briefing: initialProfile?.custom_briefing ?? "",
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  async function saveProfile(opts: { finish?: boolean } = {}) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          linkedin_url: form.linkedin_url?.trim() || null,
          tone_examples: form.tone_examples?.trim() || null,
          custom_briefing: form.custom_briefing?.trim() || null,
          finish_onboarding: opts.finish ?? false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao salvar");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    setError(null);
    try {
      if (step === 1) {
        if (!form.full_name.trim() || !form.role.trim() || !form.area.trim()) {
          setError("Nome, cargo e área são obrigatórios.");
          return;
        }
      }
      if (step === 2) {
        if (form.target_audience.trim().length < 20) {
          setError("Descreve a audiência com pelo menos uma frase completa.");
          return;
        }
      }
      if (step === 3) {
        if (!form.tone_traits.length) {
          setError("Escolhe ao menos 1 traço de tom.");
          return;
        }
        if (form.main_objective.trim().length < 20) {
          setError("Descreve o objetivo com pelo menos uma frase.");
          return;
        }
        await saveProfile();
      }
      setStep((s) => Math.min(s + 1, totalSteps));
    } catch {
      // already shown
    }
  }

  async function handleFinish() {
    try {
      await saveProfile({ finish: true });
      router.push("/dashboard");
      router.refresh();
    } catch {
      // shown
    }
  }

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

  return (
    <main className="relative min-h-screen px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            Onboarding
          </div>
          <Badge variant="soft">
            Passo {step} de {totalSteps}
          </Badge>
        </div>

        <Progress value={progress} className="mt-6" />

        <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
          {step === 1 && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h2 className="font-display text-3xl tracking-tight">
                  Vamos conhecer você
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Esses dados ancoram o motor. Nada que você escreva aqui aparece textualmente
                  no conteúdo final.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Ex: Vinicius Lima"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Cargo</Label>
                  <Input
                    id="role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Ex: CMO"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="area">Área</Label>
                <Input
                  id="area"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  placeholder="Ex: Marketing, Produto, Engenharia, Operações"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="linkedin_url" className="flex items-center gap-2">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                </Label>
                <Input
                  id="linkedin_url"
                  value={form.linkedin_url ?? ""}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  placeholder="https://www.linkedin.com/in/seu-perfil"
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Opcional. Ajuda o motor a entender seu histórico público.
                </p>
              </div>

              {userEmail && (
                <p className="text-xs text-muted-foreground">
                  Logado como <span className="font-mono">{userEmail}</span>
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-up">
              <div>
                <h2 className="font-display text-3xl tracking-tight">
                  Para quem você escreve?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Quanto mais específico, melhor. Audiência genérica gera conteúdo genérico.
                </p>
              </div>

              <div>
                <Label htmlFor="target_audience">Audiência-alvo</Label>
                <Textarea
                  id="target_audience"
                  value={form.target_audience}
                  onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                  placeholder="Ex: Heads de finanças e de operações de empresas brasileiras com 500+ funcionários que ainda tratam viagem corporativa como custo, e não como dado."
                  rows={6}
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Pense: cargo + porte + recorte + dor latente.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-fade-up">
              <div>
                <h2 className="font-display text-3xl tracking-tight">Tom e objetivo</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  O motor usa esses sinais para calibrar cada frase.
                </p>
              </div>

              <div>
                <Label>Traços do seu tom (escolha 2-5)</Label>
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
                <Label>O que você NUNCA escreveria</Label>
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
                <Label htmlFor="tone_examples">Exemplos do seu tom (opcional, mas ouro)</Label>
                <Textarea
                  id="tone_examples"
                  value={form.tone_examples ?? ""}
                  onChange={(e) => setForm({ ...form, tone_examples: e.target.value })}
                  placeholder="Cole 1 ou 2 trechos seus que você acha que captam bem como você fala — post, e-mail, mensagem de WhatsApp interno."
                  rows={5}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="main_objective">Objetivo principal de thought leadership</Label>
                <Textarea
                  id="main_objective"
                  value={form.main_objective}
                  onChange={(e) => setForm({ ...form, main_objective: e.target.value })}
                  placeholder="Ex: Posicionar a categoria 'travel como dado de operação' e ser a primeira referência brasileira citada quando o tema aparece."
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="custom_briefing">Briefing livre (opcional)</Label>
                <Textarea
                  id="custom_briefing"
                  value={form.custom_briefing ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, custom_briefing: e.target.value })
                  }
                  placeholder="Algo que o motor PRECISA saber sobre você, sua área ou a Onfly e que não cabe nos campos acima."
                  rows={4}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          {step === 4 && <StepReferences />}

          {step === 5 && <StepDocuments />}

          {error && (
            <p className="mt-6 text-sm text-destructive">{error}</p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(s - 1, 1))}
              disabled={step === 1 || saving}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>

            {step < totalSteps ? (
              <Button variant="primary" onClick={handleNext} disabled={saving}>
                {saving ? "Salvando..." : "Continuar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish} disabled={saving}>
                {saving ? "Finalizando..." : "Concluir e ir pro dashboard"}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
