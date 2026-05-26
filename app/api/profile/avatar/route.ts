import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de imagem." }, { status: 400 });
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: "Imagem muito grande (máx 2MB)." }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Formato não suportado (PNG/JPG/WebP/GIF)." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatar_url = pub.publicUrl;

  const { error: profErr } = await supabase
    .from("leader_profiles")
    .update({ avatar_url })
    .eq("user_id", user.id);

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ avatar_url });
}

export async function DELETE() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  // best-effort: drop o arquivo se conseguirmos achar
  const { data: list } = await supabase.storage
    .from("avatars")
    .list(user.id, { limit: 50 });
  if (list?.length) {
    const paths = list.map((it) => `${user.id}/${it.name}`);
    await supabase.storage.from("avatars").remove(paths);
  }

  await supabase
    .from("leader_profiles")
    .update({ avatar_url: null })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
