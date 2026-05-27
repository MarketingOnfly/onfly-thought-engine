import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseAdminClient,
  getServerUser,
} from "@/lib/supabase/server";
import { extractArticle } from "@/lib/extract-article";
import { transcribeYoutube, extractVideoId } from "@/lib/transcribe-youtube";
import { parseDocument } from "@/lib/parse-document";

export const maxDuration = 60;
export const runtime = "nodejs";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("youtube"), url: z.string().url() }),
  z.object({ kind: z.literal("news"), url: z.string().url() }),
  z.object({
    kind: z.literal("pdf"),
    storage_path: z.string().min(3),
    name: z.string().min(1),
  }),
]);

export type ExtractInput = z.infer<typeof schema>;

export interface ExtractResult {
  kind: "youtube" | "news" | "pdf";
  title: string;
  url: string | null;
  text: string;
  truncated: boolean;
}

/**
 * POST /api/context/extract — extrai texto de YouTube, notícia ou PDF
 * pra alimentar contexto da geração.
 *
 * PDF: cliente sobe direto no Supabase Storage (bucket leader-documents)
 * e passa o storage_path aqui. A gente baixa, parseia e devolve o texto.
 * O arquivo é apagado do Storage no fim — é descartável.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const input = parsed.data;

  try {
    if (input.kind === "youtube") {
      const yt = await transcribeYoutube(input.url);
      return NextResponse.json<ExtractResult>({
        kind: "youtube",
        title: yt.title,
        url: input.url,
        text: yt.text,
        truncated: yt.truncated,
      });
    }

    if (input.kind === "news") {
      // Detectar se é YouTube colado no campo de notícia
      if (extractVideoId(input.url)) {
        const yt = await transcribeYoutube(input.url);
        return NextResponse.json<ExtractResult>({
          kind: "youtube",
          title: yt.title,
          url: input.url,
          text: yt.text,
          truncated: yt.truncated,
        });
      }
      const art = await extractArticle(input.url);
      return NextResponse.json<ExtractResult>({
        kind: "news",
        title: art.title,
        url: art.url,
        text: art.text,
        truncated: art.truncated,
      });
    }

    // pdf
    if (!input.storage_path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "invalid path" }, { status: 403 });
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from("leader-documents")
      .download(input.storage_path);
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "download falhou" },
        { status: 500 }
      );
    }
    const buf = await data.arrayBuffer();
    const file = new File([buf], input.name, {
      type: data.type || "application/pdf",
    });
    const parsedDoc = await parseDocument(file);

    // Limpa do Storage — anexo é transitório, não fica salvo
    await admin.storage.from("leader-documents").remove([input.storage_path]);

    return NextResponse.json<ExtractResult>({
      kind: "pdf",
      title: parsedDoc.name,
      url: null,
      text: parsedDoc.content,
      truncated: parsedDoc.truncated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "extract_failed" },
      { status: 500 }
    );
  }
}
