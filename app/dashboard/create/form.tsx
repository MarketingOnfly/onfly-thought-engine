"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Linkedin, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Format = "linkedin_post" | "article";

export default function CreateForm({
  leaderName,
  prefillTopic,
  prefillBrief,
  prefillFormat,
}: {
  leaderName: string;
  prefillTopic?: string;
  prefillBrief?: string;
  prefillFormat?: Format;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>(prefillFormat ?? "linkedin_post");
  const [topic, setTopic] = useState(prefillTopic ?? "");
  const [brief, setBrief] = useState(prefillBrief ?? "");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format,
          topic,
          brief: brief.trim() || null,
          extra_instructions: extra.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar");
      router.push(`/dashboard/content/${data.draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setFormat("linkedin_post")}
            className={`rounded-2xl border p-5 text-left transition ${
              format === "linkedin_post"
                ? "border-brand-500 bg-brand-50/40 shadow-sm"
                : "border-border bg-card hover:bg-secondary/40"
            }`}
          >
            <Linkedin className="h-5 w-5 text-brand-600" />
            <p className="mt-3 font-medium">Post de LinkedIn</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hook curto, 4-10 parágrafos, voz pessoal. Pronto pra copiar e colar.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setFormat("article")}
            className={`rounded-2xl border p-5 text-left transition ${
              format === "article"
                ? "border-brand-500 bg-brand-50/40 shadow-sm"
                : "border-border bg-card hover:bg-secondary/40"
            }`}
          >
            <FileText className="h-5 w-5 text-brand-600" />
            <p className="mt-3 font-medium">Artigo de autoridade</p>
            <p className="mt-1 text-xs text-muted-foreground">
              800-1500 palavras em markdown, com tese e seções, pronto pra imprensa.
            </p>
          </button>
        </div>

        <div>
          <Label htmlFor="topic">Tema</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: Por que viagem corporativa virou métrica de CFO"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="brief">Briefing (opcional)</Label>
          <Textarea
            id="brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Sua tese, ângulo, número que quer usar, história que quer contar. Tudo o que o motor precisa pra capturar SUA opinião."
            rows={6}
            className="mt-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Quanto mais ângulo seu, menos genérico o resultado.
          </p>
        </div>

        <div>
          <Label htmlFor="extra">Instruções extras (opcional)</Label>
          <Textarea
            id="extra"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Ex: Quero abrir com um número. Não cite a Onfly diretamente. Termine com pergunta provocativa."
            rows={3}
            className="mt-2"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={submit}
          disabled={busy || topic.trim().length < 5}
          className="w-full md:w-auto"
        >
          {busy ? (
            <>
              <span className="shimmer h-2 w-2 rounded-full" /> Gerando para {leaderName.split(" ")[0]}...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" /> Gerar draft
            </>
          )}
        </Button>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-brand-600" /> Como o motor pensa
          </div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>1. Carrega seu perfil, audiência e tom.</li>
            <li>2. Injeta as guidelines da Onfly como contexto.</li>
            <li>3. Lê seus documentos e perfis de referência.</li>
            <li>4. Gera draft direto na sua voz, sem floreio.</li>
            <li>5. Você pode revisar em linguagem natural depois.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sem ideia?</p>
          <p className="mt-2 text-sm">
            Roda o discovery de pautas — varremos suas fontes e devolvemos ângulos autorais.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href="/dashboard/discover">Descobrir pautas</a>
          </Button>
        </div>
      </aside>
    </div>
  );
}
