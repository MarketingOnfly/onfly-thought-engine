"use client";

import { useRef, useState } from "react";
import {
  AtSign,
  Camera,
  Check,
  Globe,
  Loader2,
  Linkedin,
  Save,
  Twitter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LeaderProfile } from "@/lib/db/types";
import { initials } from "@/lib/utils";
import { apiFetch } from "@/lib/client-fetch";
import { useConfirm } from "@/components/confirm";
import { PresetOrCustom } from "@/components/preset-or-custom";
import { ROLE_PRESETS, AREA_PRESETS } from "@/lib/style-presets";

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "America/New_York", label: "New York (GMT-5/-4)" },
  { value: "Europe/London", label: "Londres (GMT+0/+1)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
  { value: "UTC", label: "UTC" },
];

const DIGEST_OPTIONS: {
  value: "never" | "daily" | "weekly";
  label: string;
  description: string;
}[] = [
  {
    value: "weekly",
    label: "Semanal (recomendado)",
    description: "Resumo das suas métricas + ideias quentes na segunda.",
  },
  {
    value: "daily",
    label: "Diário",
    description: "Resumo cedo todo dia útil. Pra quem está em alta produção.",
  },
  { value: "never", label: "Desligado", description: "Só notificações no sininho." },
];

export default function PersonalProfileEditor({
  initial,
  userEmail,
}: {
  initial: LeaderProfile;
  userEmail: string | null;
}) {
  const [form, setForm] = useState({
    full_name: initial.full_name,
    role: initial.role,
    area: initial.area,
    bio: initial.bio ?? "",
    linkedin_url: initial.linkedin_url ?? "",
    twitter_url: initial.twitter_url ?? "",
    website_url: initial.website_url ?? "",
    timezone: initial.timezone ?? "America/Sao_Paulo",
    notification_email: initial.notification_email,
    notification_digest: initial.notification_digest ?? "weekly",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initial.avatar_url ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  async function uploadAvatar(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Imagem muito grande. Máx 2MB.");
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha no upload");
        return;
      }
      setAvatarUrl(data.avatar_url);
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    const ok = await confirm({
      title: "Remover sua foto?",
      description: "Volta a mostrar suas iniciais.",
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    const res = await fetch("/api/profile/avatar", { method: "DELETE" });
    if (res.ok) setAvatarUrl(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await apiFetch("/api/profile/personal", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        bio: form.bio.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        twitter_url: form.twitter_url.trim() || null,
        website_url: form.website_url.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Avatar + identity */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <header className="flex flex-wrap items-center gap-6">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={form.full_name}
                className="h-24 w-24 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-medium text-white">
                {initials(form.full_name)}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-brand-500 text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              aria-label="Trocar foto"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) void uploadAvatar(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl tracking-tight">{form.full_name}</h2>
            <p className="text-sm text-muted-foreground">
              {form.role} · {form.area}
            </p>
            {userEmail && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <AtSign className="h-3 w-3" /> {userEmail}
              </p>
            )}
            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                className="mt-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Remover foto
              </button>
            )}
          </div>
        </header>
      </section>

      {/* Identity fields */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Identidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Como você aparece em qualquer assinatura.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nome completo">
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="Cargo">
            <PresetOrCustom
              presets={ROLE_PRESETS}
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              placeholderSelect="Escolha seu cargo"
              placeholderInput="Ex: Diretor de Receita"
            />
          </Field>
          <Field label="Área">
            <PresetOrCustom
              presets={AREA_PRESETS}
              value={form.area}
              onChange={(v) => setForm({ ...form, area: v })}
              placeholderSelect="Escolha sua área"
              placeholderInput="Ex: Inovação"
            />
          </Field>
          <Field label="Fuso horário">
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="flex h-11 w-full rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5">
          <Label>Bio profissional (curta — aparece em comparativos do admin)</Label>
          <Textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Ex: CMO da Onfly. Construindo a categoria de travel-as-data no Brasil."
            rows={3}
            className="mt-2"
          />
        </div>
      </section>

      {/* Social */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Redes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pra cruzar com analytics e dar contexto público.
        </p>
        <div className="mt-5 space-y-3">
          <Field
            label={
              <span className="flex items-center gap-2">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </span>
            }
          >
            <Input
              value={form.linkedin_url}
              onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              placeholder="https://www.linkedin.com/in/..."
            />
          </Field>
          <Field
            label={
              <span className="flex items-center gap-2">
                <Twitter className="h-3.5 w-3.5" /> X / Twitter
              </span>
            }
          >
            <Input
              value={form.twitter_url}
              onChange={(e) => setForm({ ...form, twitter_url: e.target.value })}
              placeholder="https://twitter.com/..."
            />
          </Field>
          <Field
            label={
              <span className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" /> Site / Substack
              </span>
            }
          >
            <Input
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Notificações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O sininho continua sempre ativo. Aqui você controla os e-mails.
        </p>
        <div className="mt-5">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
            <input
              type="checkbox"
              checked={form.notification_email}
              onChange={(e) =>
                setForm({ ...form, notification_email: e.target.checked })
              }
              className="h-4 w-4 rounded border-border accent-brand-500"
            />
            <span className="text-sm">
              Receber e-mails de notificação (campanha pronta, releases marketing)
            </span>
          </label>
        </div>
        <div className="mt-5">
          <Label>Frequência do digest</Label>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {DIGEST_OPTIONS.map((opt) => {
              const active = form.notification_digest === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, notification_digest: opt.value })
                  }
                  className={`relative rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/40"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{opt.label}</p>
                    {active && <Check className="h-4 w-4 text-brand-600" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Account info readonly */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight">Conta</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Email">{userEmail ?? "—"}</Row>
          <Row label="Onboarding">
            {initial.onboarding_completed ? (
              <Badge variant="brand" className="text-[10px]">
                <Check className="mr-1 h-3 w-3" /> Concluído
              </Badge>
            ) : (
              <Badge variant="outline">Pendente</Badge>
            )}
          </Row>
          <Row label="Cadastrado em">
            {new Date(initial.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </Row>
        </dl>
      </section>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {saved ? "Salvo." : "Mudanças valem na hora."}
        </p>
        <Button variant="primary" size="lg" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
