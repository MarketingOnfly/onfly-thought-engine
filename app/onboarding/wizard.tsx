"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  FileText,
  Linkedin,
  Loader2,
  MessageSquareQuote,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dropzone } from "@/components/dropzone";
import { PresetOrCustom } from "@/components/preset-or-custom";
import {
  ROLE_PRESETS,
  AREA_PRESETS,
  AUDIENCE_SEGMENTS,
} from "@/lib/style-presets";
import type { LeaderProfile, ReferenceLink } from "@/lib/db/types";

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

function detectLinkKind(url: string): ReferenceLink["kind"] {
  const u = url.toLowerCase();
  if (u.includes("substack.com")) return "substack";
  if (u.includes("medium.com")) return "blog";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("spotify.com") || u.includes("podcast")) return "podcast";
  if (u.match(/\b(newsletter|news\.)/)) return "newsletter";
  if (u.includes("linkedin.com")) return "other"; // linkedin de pessoa vai pra reference_profiles
  if (u.match(/portal|exame|forbes|propmark|meioemensagem|valor/i)) return "portal";
  return "blog";
}

export default function OnboardingWizard({
  initialProfile,
  userEmail,
}: {
  initialProfile: LeaderProfile | null;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");

  const [form, setForm] = useState({
    full_name: initialProfile?.full_name ?? "",
    role: initialProfile?.role ?? "",
    area: initialProfile?.area ?? "",
    linkedin_url: initialProfile?.linkedin_url ?? "",
    target_audience: initialProfile?.target_audience ?? "",
    audience_segments: initialProfile?.audience_segments ?? [],
    tone_traits: initialProfile?.tone_traits ?? [],
    tone_examples: initialProfile?.tone_examples ?? "",
    main_objective: initialProfile?.main_objective ?? "",
  });

  // textareas with URLs/profiles, one per line
  const [refLinksRaw, setRefLinksRaw] = useState("");
  const [refProfilesRaw, setRefProfilesRaw] = useState("");

  function toggleTrait(value: string) {
    setForm((prev) => ({
      ...prev,
      tone_traits: prev.tone_traits.includes(value)
        ? prev.tone_traits.filter((v) => v !== value)
        : [...prev.tone_traits, value],
    }));
  }

  function validate(): string | null {
    if (form.full_name.trim().length < 2) return "Nome é obrigatório.";
    if (form.role.trim().length < 2) return "Cargo é obrigatório.";
    if (form.area.trim().length < 2) return "Área é obrigatória.";
    if (
      !form.audience_segments.length &&
      form.target_audience.trim().length < 20
    )
      return "Escolhe ao menos um segmento OU descreve sua audiência em uma frase.";
    if (!form.tone_traits.length) return "Escolha ao menos 1 traço de tom.";
    if (form.main_objective.trim().length < 20)
      return "Descreve seu objetivo em pelo menos uma frase.";
    return null;
  }

  async function finish() {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    try {
      // 1. save profile (and mark onboarding_completed)
      setStage("Salvando perfil…");
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          linkedin_url: form.linkedin_url.trim() || null,
          tone_examples: form.tone_examples.trim() || null,
          tone_avoid: [],
          custom_briefing: null,
          finish_onboarding: true,
        }),
      });
      if (!profileRes.ok) {
        const data = await profileRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao salvar perfil.");
      }

      // 2. ref profiles (parse lines as "Name | URL" or just URL)
      const refProfileLines = refProfilesRaw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (refProfileLines.length) {
        setStage(`Salvando ${refProfileLines.length} perfis de referência…`);
        await Promise.allSettled(
          refProfileLines.map(async (line) => {
            const [namePart, urlPart] = splitNameUrl(line);
            if (!urlPart) return;
            await fetch("/api/references/profiles", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: namePart || urlPart.replace(/^https?:\/\//, "").split("/")[0],
                url: urlPart,
                why_relevant: null,
                hook_examples: null,
              }),
            });
          })
        );
      }

      // 3. ref links (one URL per line, auto-detect kind)
      const refLinkLines = refLinksRaw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (refLinkLines.length) {
        setStage(`Salvando ${refLinkLines.length} fontes…`);
        await Promise.allSettled(
          refLinkLines.map(async (line) => {
            const [titlePart, urlPart] = splitNameUrl(line);
            if (!urlPart) return;
            await fetch("/api/references/links", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                title:
                  titlePart ||
                  urlPart
                    .replace(/^https?:\/\//, "")
                    .replace(/^www\./, "")
                    .split("/")[0],
                url: urlPart,
                kind: detectLinkKind(urlPart),
                notes: null,
              }),
            });
          })
        );
      }

      setStage("Tudo certo. Indo pro dashboard…");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl">
        <header className="flex items-center gap-2 font-display text-lg tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          Onboarding
        </header>

        <div className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">
            Vamos te conhecer rapidamente
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tudo aqui alimenta o motor. Quanto mais específico, menos genérico fica o conteúdo
            depois. Você pode editar tudo no `/dashboard/profile`.
          </p>
          {userEmail && (
            <p className="mt-3 text-xs text-muted-foreground">
              Logado como <span className="font-mono">{userEmail}</span>
            </p>
          )}

          {/* Section 1: identidade */}
          <Section title="Quem você é" icon={User}>
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
                <div className="mt-2">
                  <PresetOrCustom
                    presets={ROLE_PRESETS}
                    value={form.role}
                    onChange={(v) => setForm({ ...form, role: v })}
                    placeholderSelect="Escolha seu cargo"
                    placeholderInput="Ex: Diretor de Receita"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="area">Área</Label>
                <div className="mt-2">
                  <PresetOrCustom
                    presets={AREA_PRESETS}
                    value={form.area}
                    onChange={(v) => setForm({ ...form, area: v })}
                    placeholderSelect="Escolha sua área"
                    placeholderInput="Ex: Inovação"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="linkedin_url" className="flex items-center gap-2">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn (opcional)
                </Label>
                <Input
                  id="linkedin_url"
                  value={form.linkedin_url}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                  placeholder="https://www.linkedin.com/in/..."
                  className="mt-2"
                />
              </div>
            </div>
          </Section>

          {/* Section 2: audiência + objetivo */}
          <Section title="Pra quem você fala — e por quê" icon={Users}>
            <div className="grid gap-4">
              <div>
                <Label>Pra quem você escreve (marque um ou mais)</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escolha segmentos prontos pra acelerar. Se nenhum encaixa
                  bem, deixa em branco e descreve no campo livre abaixo.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {AUDIENCE_SEGMENTS.map((seg) => {
                    const active = form.audience_segments.includes(seg.key);
                    return (
                      <button
                        key={seg.key}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            audience_segments: active
                              ? prev.audience_segments.filter(
                                  (k) => k !== seg.key
                                )
                              : [...prev.audience_segments, seg.key],
                          }))
                        }
                        className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                          active
                            ? "border-brand-500 bg-brand-50"
                            : "border-border bg-card hover:bg-secondary"
                        }`}
                      >
                        <p
                          className={`font-medium ${
                            active ? "text-brand-900" : "text-foreground"
                          }`}
                        >
                          {seg.label}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                          {seg.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="target_audience">
                  Refinamento livre (opcional)
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use pra adicionar recorte de porte, dor específica ou
                  audiência fora da lista.
                </p>
                <Textarea
                  id="target_audience"
                  value={form.target_audience}
                  onChange={(e) =>
                    setForm({ ...form, target_audience: e.target.value })
                  }
                  placeholder="Ex: Heads de finanças e operações de empresas brasileiras 500+ que ainda tratam viagem corporativa como custo."
                  rows={3}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="main_objective">Por que você quer publicar? (qual ganho de negócio você espera)</Label>
                <Textarea
                  id="main_objective"
                  value={form.main_objective}
                  onChange={(e) => setForm({ ...form, main_objective: e.target.value })}
                  placeholder="Ex: Quero virar a primeira referência citada quando alguém fala em 'travel como dado de operação'."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
          </Section>

          {/* Section 3: tom */}
          <Section title="Como você fala" icon={MessageSquareQuote}>
            <div>
              <Label>Como você quer soar (escolha 2-5)</Label>
              <div className="mt-3 flex flex-wrap gap-2">
                {TONE_TRAITS.map((t) => {
                  const active = form.tone_traits.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTrait(t)}
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

            <div className="mt-4">
              <Label htmlFor="tone_examples">Exemplos do seu tom (opcional)</Label>
              <Textarea
                id="tone_examples"
                value={form.tone_examples}
                onChange={(e) => setForm({ ...form, tone_examples: e.target.value })}
                placeholder="Cole 1-2 trechos seus que capturam bem como você fala. Pode ser e-mail, mensagem de WhatsApp, post antigo."
                rows={4}
                className="mt-2"
              />
            </div>
          </Section>

          {/* Section 4: documentos */}
          <Section title="Documentos de base (opcional)" icon={FileText}>
            <p className="mb-3 text-xs text-muted-foreground">
              Cases, dados internos, manifestos, slides — qualquer texto que sirva de matéria-prima.
              PDF, DOCX, TXT, MD. Você pode adicionar mais depois.
            </p>
            <Dropzone compact />
          </Section>

          {/* Section 5: referências */}
          <Section title="Referências (opcional, mas valioso)" icon={BookOpen}>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="refs_profiles">
                  Perfis cujo estilo de escrita te inspira
                </Label>
                <Textarea
                  id="refs_profiles"
                  value={refProfilesRaw}
                  onChange={(e) => setRefProfilesRaw(e.target.value)}
                  placeholder={`Uma por linha. Aceita formato "Nome | URL":\n\nMatheus Pessôa | https://substack.com/@matheuspessoa\nhttps://www.linkedin.com/in/lara-acrich/`}
                  rows={5}
                  className="mt-2 font-mono text-xs"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  O motor lê o conteúdo público de cada um e extrai padrões de hook + estilo
                  sozinho. Pra LinkedIn (que bloqueia leitura), você cola exemplos depois.
                </p>
              </div>

              <div>
                <Label htmlFor="refs_links">
                  Fontes que você acompanha (substacks, newsletters, blogs, portais…)
                </Label>
                <Textarea
                  id="refs_links"
                  value={refLinksRaw}
                  onChange={(e) => setRefLinksRaw(e.target.value)}
                  placeholder={`Uma por linha. Aceita "Título | URL" ou só URL:\n\nStratechery | https://stratechery.com\nhttps://www.exame.com\nhttps://www.meioemensagem.com.br`}
                  rows={6}
                  className="mt-2 font-mono text-xs"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Essas fontes alimentam o "Descobrir pautas" — o motor varre, rankeia e devolve
                  ideias autorais.
                </p>
              </div>
            </div>
          </Section>

          {error && (
            <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              {saving ? stage : "Pode finalizar — tudo é editável depois."}
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={finish}
              disabled={saving}
              className="min-w-[200px]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Concluir
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof User;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-border pt-6 first:mt-8 first:border-0 first:pt-0">
      <h2 className="flex items-center gap-3 font-display text-xl tracking-tight">
        {Icon && (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" />
          </span>
        )}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function splitNameUrl(line: string): [string | null, string | null] {
  // Accept "Name | url", "Name - url", "Name url", or just "url"
  const pipeIdx = line.indexOf("|");
  if (pipeIdx > 0) {
    const name = line.slice(0, pipeIdx).trim();
    const url = line.slice(pipeIdx + 1).trim();
    return [name || null, isUrl(url) ? url : null];
  }
  const dashIdx = line.indexOf(" - ");
  if (dashIdx > 0) {
    const name = line.slice(0, dashIdx).trim();
    const url = line.slice(dashIdx + 3).trim();
    if (isUrl(url)) return [name || null, url];
  }
  // try splitting on first space
  const spaceIdx = line.lastIndexOf(" ");
  if (spaceIdx > 0) {
    const maybeUrl = line.slice(spaceIdx + 1).trim();
    if (isUrl(maybeUrl)) return [line.slice(0, spaceIdx).trim() || null, maybeUrl];
  }
  return [null, isUrl(line) ? line : null];
}

function isUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}
