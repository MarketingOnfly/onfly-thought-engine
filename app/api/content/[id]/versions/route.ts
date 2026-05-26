import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/content/[id]/versions — lista versões antigas (mais nova primeiro).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("draft_versions")
    .select("*")
    .eq("content_draft_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}

/**
 * POST /api/content/[id]/versions/restore body { version_id }
 *  - Salva a versão atual como histórico
 *  - Substitui draft_markdown pelo body da versão escolhida
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

  const [{ data: draft }, { data: target }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("draft_markdown")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("draft_versions")
      .select("body")
      .eq("id", versionId)
      .eq("content_draft_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!draft) return NextResponse.json({ error: "draft não encontrado" }, { status: 404 });
  if (!target)
    return NextResponse.json({ error: "versão não encontrada" }, { status: 404 });

  // Salva a atual no histórico antes de sobrescrever
  if (draft.draft_markdown) {
    await supabase.from("draft_versions").insert({
      content_draft_id: id,
      user_id: user.id,
      body: draft.draft_markdown,
      reason: "Snapshot antes de restaurar versão antiga",
    });
  }

  const { data: updated, error: updErr } = await supabase
    .from("content_drafts")
    .update({ draft_markdown: target.body })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ draft: updated });
}
