import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { parseDocument } from "@/lib/parse-document";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll("files");
  if (!files.length) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const created = [];
  const failed: { name: string; error: string }[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;
    try {
      const parsed = await parseDocument(f);

      const { data, error } = await supabase
        .from("leader_documents")
        .insert({
          user_id: user.id,
          name: parsed.name,
          content: parsed.content,
          kind: parsed.kind === "pdf" ? "background" : parsed.kind === "docx" ? "background" : "background",
        })
        .select()
        .single();

      if (error) {
        failed.push({ name: parsed.name, error: error.message });
        continue;
      }
      created.push({ ...data, truncated: parsed.truncated });
    } catch (err) {
      failed.push({
        name: f.name,
        error: err instanceof Error ? err.message : "erro desconhecido",
      });
    }
  }

  return NextResponse.json({ items: created, failed });
}
