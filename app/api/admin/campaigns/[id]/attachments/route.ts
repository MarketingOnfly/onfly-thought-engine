import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { parseDocument } from "@/lib/parse-document";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaign_attachments")
    .select("*")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const formData = await request.formData();
  const files = formData.getAll("files");
  const kindRaw = (formData.get("kind") as string | null) ?? "reference";
  const explicitKind =
    kindRaw === "data" || kindRaw === "press_release" || kindRaw === "brief"
      ? kindRaw
      : "reference";

  if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const created = [];
  const failed: { name: string; error: string }[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;
    try {
      const parsed = await parseDocument(f);
      // Imagem força kind=image. Senão usa o kind do formulário.
      const kind = parsed.kind === "image" ? "image" : explicitKind;
      const { data, error } = await supabase
        .from("campaign_attachments")
        .insert({
          campaign_id: id,
          name: parsed.name,
          content: parsed.content,
          kind,
          mime_type: parsed.mimeType ?? null,
          size_bytes: parsed.sizeBytes ?? null,
        })
        .select()
        .single();
      if (error) failed.push({ name: f.name, error: error.message });
      else created.push(data);
    } catch (err) {
      failed.push({
        name: f.name,
        error: err instanceof Error ? err.message : "erro",
      });
    }
  }

  return NextResponse.json({ items: created, failed });
}
