import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({
  final_markdown: z.string().optional(),
  status: z.enum(["draft", "refining", "approved"]).optional(),
  // ISO datetime string, or null to clear
  scheduled_at: z
    .union([z.string().datetime(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v ?? null)),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // CAPTURA DE EDIÇÃO MANUAL — o sinal de aprendizado mais forte que
  // existe. Quando o líder edita o texto na mão antes de aprovar, o
  // diff (gerado → editado) mostra EXATAMENTE o que o motor errou.
  // Guardamos o "antes" em draft_versions com reason rastreável;
  // o "depois" fica no final_markdown da própria row. O
  // learn-from-feedback usa esses pares como exemplos antes→depois.
  if (parsed.data.final_markdown !== undefined) {
    const { data: current } = await supabase
      .from("content_drafts")
      .select("draft_markdown, final_markdown")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    const before = current?.final_markdown ?? current?.draft_markdown;
    if (
      before &&
      before.trim() !== parsed.data.final_markdown.trim() &&
      // Ignora micro-edições (typo fix) — só captura edição substancial
      Math.abs(before.length - parsed.data.final_markdown.length) > 30
    ) {
      await supabase.from("draft_versions").insert({
        content_draft_id: id,
        user_id: user.id,
        body: before,
        reason: "edição manual do líder",
      });
    }
  }

  const { data, error } = await supabase
    .from("content_drafts")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_drafts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
