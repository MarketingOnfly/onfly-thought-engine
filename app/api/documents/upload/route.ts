import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  getServerUser,
} from "@/lib/supabase/server";
import { parseDocument } from "@/lib/parse-document";

export const maxDuration = 60;
export const runtime = "nodejs";

interface StorageItem {
  storage_path: string;
  name: string;
}

/**
 * Aceita dois modos:
 *  1. JSON `{ items: [{ storage_path, name }] }` — cliente subiu direto pro
 *     Supabase Storage (bucket leader-documents). Lemos de lá, parseamos,
 *     gravamos em leader_documents e apagamos do bucket.
 *  2. FormData `files` — modo legado, mantido pra retrocompat (arquivos
 *     pequenos < 4.5MB que o Vercel ainda aceita inline).
 *
 * O modo 1 é o caminho oficial — não tem limite de body do Vercel.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return handleStorageItems(request, user.id);
  }

  // legado: FormData (arquivos pequenos)
  const formData = await request.formData();
  const files = formData.getAll("files");
  if (!files.length) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }
  const result = await parseAndPersistFiles(files as File[], user.id);
  return NextResponse.json(result);
}

async function handleStorageItems(request: NextRequest, userId: string) {
  let body: { items?: StorageItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const items = (body.items ?? []).filter(
    (it): it is StorageItem =>
      typeof it?.storage_path === "string" && typeof it?.name === "string"
  );
  if (!items.length) {
    return NextResponse.json({ error: "no items" }, { status: 400 });
  }

  // Garante que o usuário só lê paths sob a própria pasta
  const invalid = items.find(
    (it) => !it.storage_path.startsWith(`${userId}/`)
  );
  if (invalid) {
    return NextResponse.json({ error: "invalid path" }, { status: 403 });
  }

  // Admin client pra ler do Storage e apagar depois (mais simples que
  // re-autenticar — o check de pasta acima garante a barreira por user).
  const admin = createSupabaseAdminClient();
  const files: File[] = [];

  const downloadFails: { name: string; error: string }[] = [];
  for (const it of items) {
    try {
      const { data, error } = await admin.storage
        .from("leader-documents")
        .download(it.storage_path);
      if (error || !data) {
        downloadFails.push({
          name: it.name,
          error: error?.message ?? "download falhou",
        });
        continue;
      }
      const buf = await data.arrayBuffer();
      const file = new File([buf], it.name, {
        type: data.type || "application/octet-stream",
      });
      files.push(file);
    } catch (err) {
      downloadFails.push({
        name: it.name,
        error: err instanceof Error ? err.message : "erro",
      });
    }
  }

  const result = await parseAndPersistFiles(files, userId);

  // Apaga tudo do Storage — sucesso ou falha, não queremos sujeira
  await admin.storage
    .from("leader-documents")
    .remove(items.map((it) => it.storage_path));

  // Combina falhas de download com falhas de parse
  return NextResponse.json({
    items: result.items,
    failed: [...result.failed, ...downloadFails],
  });
}

async function parseAndPersistFiles(
  files: File[],
  userId: string
): Promise<{ items: unknown[]; failed: { name: string; error: string }[] }> {
  const supabase = await createSupabaseServerClient();
  const created: unknown[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;
    try {
      const parsed = await parseDocument(f);
      const { data, error } = await supabase
        .from("leader_documents")
        .insert({
          user_id: userId,
          name: parsed.name,
          content: parsed.content,
          kind:
            parsed.kind === "pdf"
              ? "background"
              : parsed.kind === "docx"
                ? "background"
                : "background",
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

  return { items: created, failed };
}
