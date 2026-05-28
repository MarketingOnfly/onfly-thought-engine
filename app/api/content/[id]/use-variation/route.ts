import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { AltVersion, ContentDraft } from "@/lib/db/types";

export const runtime = "nodejs";

/**
 * POST /api/content/[id]/use-variation
 * Body: { version_id: string }
 *
 * Promove uma variação alternativa pra ser o draft principal. A versão
 * antiga vira histórico (em draft_versions) e some das alternativas.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const versionId = typeof body?.version_id === "string" ? body.version_id : null;
  if (!versionId)
    return NextResponse.json({ error: "version_id obrigatório" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: draftRow } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!draftRow)
    return NextResponse.json({ error: "draft não encontrado" }, { status: 404 });

  const draft = draftRow as ContentDraft;
  const alts: AltVersion[] = (draft.alt_versions as AltVersion[]) ?? [];
  const target = alts.find((a) => a.id === versionId);
  if (!target)
    return NextResponse.json({ error: "variação não encontrada" }, { status: 404 });

  // Salva versão atual no histórico
  if (draft.draft_markdown) {
    await supabase.from("draft_versions").insert({
      content_draft_id: id,
      user_id: user.id,
      body: draft.draft_markdown,
      reason: `Substituída pela ${target.label}`,
    });
  }

  // Remove a variação escolhida da lista
  const nextAlts = alts.filter((a) => a.id !== versionId);

  // RASTREIO DE APRENDIZADO: quando o líder promove uma variação alt,
  // isso é sinal forte de preferência pela ESTRATÉGIA daquela variação.
  // Salva no meta do draft pra learn-preferred-strategies pegar depois.
  const prevMeta = (draft.meta as Record<string, unknown>) ?? {};
  const updatedMeta = {
    ...prevMeta,
    promoted_variation: {
      version_id: versionId,
      label: target.label,
      strategy: target.strategy ?? null,
      promoted_at: new Date().toISOString(),
    },
  };

  const { data: updated, error } = await supabase
    .from("content_drafts")
    .update({
      draft_markdown: target.body,
      alt_versions: nextAlts,
      style_score: null, // invalida score — texto novo precisa reavaliar
      meta: updatedMeta,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: updated });
}
