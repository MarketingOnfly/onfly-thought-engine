/**
 * Pega os 2-3 melhores exemplos de texto pra few-shot na geração —
 * modelo imita FORMA muito melhor a partir de exemplo real do que de
 * instrução textual.
 *
 * Critério de "melhor" (corrigido em 2026-06):
 *  0. VOICE SAMPLES — textos que o líder ESCREVEU COM A PRÓPRIA MÃO.
 *     Antes o few-shot só usava posts GERADOS PELA FERRAMENTA com
 *     rating alto — aprendizado circular: o motor imitava a própria
 *     saída, não o líder. Voice samples quebram o ciclo.
 *  1. Posts com feedback rating >= 4 do próprio líder
 *  2. Posts com métrica de impressões > 2x média (learned_from)
 *  3. Posts mais recentes (fallback)
 */

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function getFewShotExamples(opts: {
  userId: string;
  format: "linkedin_post" | "article";
  excludeId?: string;
}): Promise<string | null> {
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    supabase = await createSupabaseServerClient();
  }

  // 0. VOICE SAMPLES — fonte soberana, textos do próprio punho do líder
  const { data: voiceSamples } = await supabase
    .from("leader_voice_samples")
    .select("title, body")
    .eq("user_id", opts.userId)
    .order("created_at", { ascending: false })
    .limit(2);

  const sovereign = ((voiceSamples ?? []) as { title: string; body: string }[]).map(
    (v) => ({
      topic: v.title,
      body: v.body,
      source: "(escrito pelo próprio líder — IMITE este acima de tudo)",
    })
  );

  // 1. Tenta posts com feedback alto (4-5 estrelas)
  const { data: rated } = await supabase
    .from("content_feedback")
    .select("rating, content_draft:content_drafts(id, format, draft_markdown, topic)")
    .eq("user_id", opts.userId)
    .gte("rating", 4)
    .order("rating", { ascending: false })
    .limit(8);

  const candidates: { topic: string; body: string; source: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (rated ?? []) as any[]) {
    const d = r.content_draft;
    if (!d || d.format !== opts.format || !d.draft_markdown) continue;
    if (opts.excludeId && d.id === opts.excludeId) continue;
    candidates.push({
      topic: d.topic,
      body: d.draft_markdown,
      source: `(rating ${r.rating}/5)`,
    });
    if (candidates.length >= 3) break;
  }

  // 2. Se faltar, busca posts marcados como high-performer (learned_from = true)
  if (candidates.length < 3) {
    const { data: perf } = await supabase
      .from("post_metrics")
      .select(
        "impressions, content_draft:content_drafts(id, format, draft_markdown, topic)"
      )
      .eq("user_id", opts.userId)
      .eq("learned_from", true)
      .order("impressions", { ascending: false })
      .limit(6);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (perf ?? []) as any[]) {
      const d = r.content_draft;
      if (!d || d.format !== opts.format || !d.draft_markdown) continue;
      if (opts.excludeId && d.id === opts.excludeId) continue;
      if (candidates.some((c) => c.body === d.draft_markdown)) continue;
      candidates.push({
        topic: d.topic,
        body: d.draft_markdown,
        source: `(alto desempenho — ${r.impressions} impressões)`,
      });
      if (candidates.length >= 3) break;
    }
  }

  // 3. Fallback: 1 post recente qualquer (pra ter ao menos UM exemplo de voz)
  if (candidates.length === 0) {
    const { data: recent } = await supabase
      .from("content_drafts")
      .select("id, draft_markdown, topic")
      .eq("user_id", opts.userId)
      .eq("format", opts.format)
      .not("draft_markdown", "is", null)
      .order("created_at", { ascending: false })
      .limit(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of (recent ?? []) as any[]) {
      if (opts.excludeId && d.id === opts.excludeId) continue;
      candidates.push({
        topic: d.topic,
        body: d.draft_markdown,
        source: "(recente)",
      });
      if (candidates.length >= 2) break;
    }
  }

  // Voice samples primeiro (soberanos), depois os melhores gerados.
  // Total cap 3 — few-shot longo demais dilui o sinal.
  const finalExamples = [...sovereign, ...candidates].slice(0, 3);
  if (!finalExamples.length) return null;

  return finalExamples
    .map(
      (c, i) =>
        `### Exemplo ${i + 1} ${c.source}\nTEMA: ${c.topic}\n\n${c.body.slice(0, 2000)}`
    )
    .join("\n\n---\n\n");
}
