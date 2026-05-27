import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { scoreStyle } from "@/lib/anthropic/score-style";
import type { LeaderProfile } from "@/lib/db/types";

export const maxDuration = 60;

/**
 * POST /api/content/[id]/score — autoavalia o conteúdo.
 *
 * Aceita opcionalmente `body` no JSON pra avaliar uma variação específica
 * (A/B/C) sem persistir. Quando body NÃO vem, usa o draft_markdown
 * primário e PERSISTE em content_drafts.style_score.
 *
 * Assim cada variação pode ter sua própria nota em tempo real, mas o
 * banco continua guardando só a oficial (versão promovida).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // body opcional: { body?: string }
  // Cap de 20k chars — Anthropic já trunca em 6k dentro do scoreStyle,
  // mas o cap aqui evita payload abusivo na entrada (DoS leve por
  // usuário autenticado que pode mandar 1MB de texto)
  const MAX_BODY_CHARS = 20_000;
  let overrideBody: string | null = null;
  try {
    const json = await request.json();
    if (typeof json?.body === "string" && json.body.trim().length > 0) {
      overrideBody = json.body.slice(0, MAX_BODY_CHARS);
    }
  } catch {
    // sem body ou body vazio — ok, vamos avaliar o draft primário
  }

  const [{ data: draft }, { data: profile }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("id, draft_markdown, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("leader_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  if (!profile)
    return NextResponse.json({ error: "profile not found" }, { status: 412 });

  const textToScore = overrideBody ?? draft.draft_markdown;
  if (!textToScore || !textToScore.trim()) {
    return NextResponse.json(
      { error: "sem texto pra avaliar" },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await scoreStyle({
      draftText: textToScore,
      profile: profile as LeaderProfile,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "score_failed" },
      { status: 500 }
    );
  }

  const score = {
    ...result,
    computed_at: new Date().toISOString(),
  };

  // Só persiste quando NÃO veio body (= avaliando a versão primária)
  if (!overrideBody) {
    const { error: updErr } = await supabase
      .from("content_drafts")
      .update({ style_score: score })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ score, ephemeral: !!overrideBody });
}
