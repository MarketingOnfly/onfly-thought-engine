import { NextResponse } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildDiscoveryPrompt,
  buildLeaderSystemPrompt,
} from "@/lib/anthropic/prompts";
import { fetchSources } from "@/lib/fetch-source";

export const maxDuration = 120;

interface RawIdea {
  title?: unknown;
  angle?: unknown;
  why_now?: unknown;
  source_url?: unknown;
  source_title?: unknown;
  relevance_score?: unknown;
}

function tryParseJson(text: string): { ideas: RawIdea[] } | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const context = await loadLeaderContext(user.id);
  if (!context) return NextResponse.json({ error: "no profile" }, { status: 412 });

  if (!context.referenceLinks.length) {
    return NextResponse.json(
      {
        error:
          "Adicione ao menos uma fonte (substack, newsletter, blog, portal) na sua biblioteca antes de rodar a descoberta.",
      },
      { status: 400 }
    );
  }

  // Cap em 5 fontes por rodada — balanço entre cobertura e tempo total de Claude.
  // Líder pode re-rodar pra processar as próximas se quiser.
  const urls = context.referenceLinks.slice(0, 5).map((l) => l.url);
  const fetched = await fetchSources(urls);

  if (!fetched.length) {
    return NextResponse.json(
      { error: "Não consegui baixar nenhuma das suas fontes agora. Tente novamente em alguns minutos." },
      { status: 502 }
    );
  }

  const system = buildLeaderSystemPrompt(context);
  const userPrompt = buildDiscoveryPrompt({ fetchedSources: fetched });

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  const parsed = tryParseJson(text);
  if (!parsed?.ideas?.length) {
    return NextResponse.json(
      { error: "Não consegui extrair ideias estruturadas. Tente de novo." },
      { status: 502 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const rows = parsed.ideas
    .map((idea) => ({
      user_id: user.id,
      title: String(idea.title ?? "").slice(0, 240),
      angle: String(idea.angle ?? "").slice(0, 1200),
      why_now: idea.why_now ? String(idea.why_now).slice(0, 600) : null,
      source_url: idea.source_url ? String(idea.source_url).slice(0, 600) : null,
      source_title: idea.source_title ? String(idea.source_title).slice(0, 240) : null,
      relevance_score:
        typeof idea.relevance_score === "number"
          ? Math.max(0, Math.min(100, Math.round(idea.relevance_score)))
          : 50,
    }))
    .filter((row) => row.title && row.angle);

  if (!rows.length) {
    return NextResponse.json({ error: "Ideias incompletas." }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("topic_suggestions")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ideas: data,
    sources_used: fetched.map((s) => ({ url: s.url, title: s.title })),
  });
}

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("topic_suggestions")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .order("relevance_score", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ideas: data ?? [] });
}
