import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/content/check-overlap?topic=...
 * Devolve quantos drafts recentes (30d) parecem cobrir o mesmo assunto.
 * Heurística leve: bag of words ≥ 3 palavras comuns (>3 chars) entre topic
 * candidato e topics existentes.
 */
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3)
  );
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const topic = request.nextUrl.searchParams.get("topic") ?? "";
  if (topic.length < 8) return NextResponse.json({ matches: [], total: 0 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("content_drafts")
    .select("id, topic, created_at, status")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(60);

  if (!data?.length) return NextResponse.json({ matches: [], total: 0 });

  const candidate = tokenize(topic);
  const matches = data
    .map((d) => ({
      id: d.id as string,
      topic: d.topic as string,
      created_at: d.created_at as string,
      status: d.status as string,
      shared: overlapCount(candidate, tokenize(d.topic as string)),
    }))
    .filter((m) => m.shared >= 3)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 5);

  return NextResponse.json({ matches, total: matches.length });
}
