"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/confirm";
import { formatDate, truncate } from "@/lib/utils";

interface Story {
  id: string;
  title: string;
  story: string;
  facts: string | null;
  times_used: number;
  created_at: string;
}

/**
 * Story Bank — banco de histórias e números REAIS do líder.
 *
 * Resolve a tensão central do motor: post bom precisa de caso/número
 * concreto, mas a REGRA ZERO proíbe inventar. Aqui o líder registra
 * uma vez os fatos verdadeiros dele e o motor passa a ter estoque de
 * especificidade legítima.
 */
export function StoryBankPanel() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [facts, setFacts] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function load() {
    try {
      const res = await fetch("/api/profile/stories");
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addStory() {
    if (title.trim().length < 3 || storyText.trim().length < 40) {
      setError("Dá um título e conta a história inteira (mínimo 40 caracteres).");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        story: storyText.trim(),
        facts: facts.trim() || null,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar");
      return;
    }
    setTitle("");
    setStoryText("");
    setFacts("");
    setFormOpen(false);
    await load();
  }

  async function removeStory(id: string) {
    const ok = await confirm({
      title: "Remover esta história?",
      description: "O motor deixa de usá-la nas próximas gerações.",
    });
    if (!ok) return;
    const res = await fetch(`/api/profile/stories/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg tracking-tight">
              Banco de histórias (seus casos e números reais)
            </h2>
            <p className="text-xs text-muted-foreground">
              Registre uma vez os casos, erros, vitórias e números
              verdadeiros da sua trajetória. O motor usa ELES quando o
              post pedir exemplo concreto — em vez de inventar ou ficar
              vago.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setFormOpen((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Nova história
        </Button>
      </div>

      {formOpen && (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/20 p-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título curto (ex: Quando cortamos um canal que parecia funcionar)"
          />
          <Textarea
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            placeholder="A história como você contaria num café: o que estava em jogo, o que aconteceu, o que mudou. Detalhe vale ouro."
            rows={5}
          />
          <Input
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            placeholder="Números reais associados (opcional — ex: 'caiu de 14 pra 3 dias; economia de ~R$ 200k/ano')"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFormOpen(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              size="sm"
              onClick={addStory}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Salvar história
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : stories.length === 0 && !formOpen ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
          Nenhuma história ainda. Sem estoque de caso real, o motor só tem
          duas saídas quando o post pede exemplo: ficar vago ou pedir o
          dado na hora. Registre 5-10 histórias e ele passa a puxar daqui.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {stories.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {s.times_used > 0 ? `usada ${s.times_used}x` : "inédita"}
                  </Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {truncate(s.story, 180)}
                </p>
                {s.facts && (
                  <p className="mt-1 text-[11px] font-medium text-brand-700">
                    {truncate(s.facts, 120)}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDate(s.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeStory(s.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
