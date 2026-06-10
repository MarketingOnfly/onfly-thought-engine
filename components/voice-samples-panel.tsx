"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Fingerprint,
  Loader2,
  Mic,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/confirm";
import { formatDate, truncate } from "@/lib/utils";

interface Sample {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

/**
 * Seção "Meus textos" do perfil — o líder cola textos que ELE escreveu
 * (posts reais do LinkedIn, e-mails, artigos). O motor analisa e extrai
 * o fingerprint da voz, que vira a fonte SOBERANA do tom em todas as
 * gerações futuras.
 */
export function VoiceSamplesPanel() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function load() {
    try {
      const res = await fetch("/api/profile/voice-samples");
      if (res.ok) {
        const data = await res.json();
        setSamples(data.samples ?? []);
        setFingerprint(data.fingerprint ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Quando uma análise está rodando em background, re-busca o
  // fingerprint algumas vezes até ele aparecer/atualizar.
  useEffect(() => {
    if (!analyzing) return;
    let tries = 0;
    const interval = setInterval(async () => {
      tries++;
      const res = await fetch("/api/profile/voice-samples");
      if (res.ok) {
        const data = await res.json();
        setFingerprint(data.fingerprint ?? null);
      }
      if (tries >= 6) {
        setAnalyzing(false);
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [analyzing]);

  async function addSample() {
    if (body.trim().length < 100) {
      setError("Cole o texto inteiro — mínimo 100 caracteres pra análise valer.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile/voice-samples", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || undefined,
        body: body.trim(),
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar");
      return;
    }
    setTitle("");
    setBody("");
    setFormOpen(false);
    setAnalyzing(true);
    await load();
  }

  async function removeSample(id: string) {
    const ok = await confirm({
      title: "Remover este texto?",
      description:
        "O motor vai re-analisar sua voz com os textos restantes.",
    });
    if (!ok) return;
    const res = await fetch(`/api/profile/voice-samples/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setAnalyzing(true);
      await load();
    }
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Mic className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg tracking-tight">
              Meus textos (fonte soberana do seu tom)
            </h2>
            <p className="text-xs text-muted-foreground">
              Cole textos que VOCÊ escreveu — posts reais do LinkedIn,
              e-mails, artigos. O motor extrai seu jeito de escrever e
              passa a imitar ELE acima de qualquer regra.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFormOpen((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar texto
        </Button>
      </div>

      {formOpen && (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/20 p-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="De onde veio? (ex: Post sobre nossa campanha de cinema)"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Cole aqui o texto INTEIRO, do jeito que você publicou. Quanto mais natural e seu, melhor a análise. Mínimo 100 caracteres."
            rows={8}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              3 a 8 textos dão a melhor leitura. Posts diferentes entre si
              (um técnico, um pessoal, um de opinião) ajudam mais.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setFormOpen(false);
                  setTitle("");
                  setBody("");
                  setError(null);
                }}
              >
                Cancelar
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={addSample}
                disabled={saving || body.trim().length < 100}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Salvar e analisar
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {samples.length === 0 && !formOpen && (
            <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4 text-sm text-amber-900">
              Nenhum texto seu cadastrado ainda. Sem isso, o motor escreve
              a partir de descrições do seu tom — que é muito mais fraco
              que imitar textos reais. Cole 3-5 posts que você publicou.
            </div>
          )}

          {samples.length > 0 && (
            <ul className="mt-4 space-y-2">
              {samples.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {truncate(s.body, 180)}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDate(s.created_at)} · {s.body.length} caracteres
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeSample(s.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Fingerprint extraído */}
          {(fingerprint || analyzing) && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/30 p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-brand-700">
                <Fingerprint className="h-3 w-3" />
                O que o motor entendeu da sua voz
                {analyzing && (
                  <span className="inline-flex items-center gap-1 normal-case text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> analisando…
                  </span>
                )}
              </p>
              {fingerprint && (
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90">
                  {fingerprint}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
