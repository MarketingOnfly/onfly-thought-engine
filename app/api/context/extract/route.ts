import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseAdminClient,
  getServerUser,
} from "@/lib/supabase/server";
import { extractArticle } from "@/lib/extract-article";
import { transcribeYoutube, extractVideoId } from "@/lib/transcribe-youtube";
import { parseDocument } from "@/lib/parse-document";
import { comprehendLink, type LinkComprehension } from "@/lib/anthropic/comprehend-link";

// maxDuration aumentada de 60→180s pra suportar fallback Whisper de
// vídeos sem legenda: download do áudio (~10-30s) + Whisper API
// (~5-40s pra podcast de 30min). Vercel Pro suporta até 300s.
export const maxDuration = 180;
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
  // Compreensão estruturada — Claude leu o texto bruto e devolveu fatos.
  // O frontend usa isso pra montar o prompt, em vez do texto cru.
  // Se undefined, é fallback: texto cru ainda funciona, só sem
  // estrutura.
  comprehension?: LinkComprehension;
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
      const comprehension = await comprehendLink({
        rawText: yt.text,
        hintTitle: yt.title,
        hintUrl: input.url,
        kind: "youtube",
      });
      return NextResponse.json<ExtractResult>({
        kind: "youtube",
        title: yt.title,
        url: input.url,
        text: yt.text,
        truncated: yt.truncated,
        comprehension,
      });
    }

    if (input.kind === "news") {
      // Detectar se é YouTube colado no campo de notícia
      if (extractVideoId(input.url)) {
        const yt = await transcribeYoutube(input.url);
        const comprehension = await comprehendLink({
          rawText: yt.text,
          hintTitle: yt.title,
          hintUrl: input.url,
          kind: "youtube",
        });
        return NextResponse.json<ExtractResult>({
          kind: "youtube",
          title: yt.title,
          url: input.url,
          text: yt.text,
          truncated: yt.truncated,
          comprehension,
        });
      }
      // Detectar Spotify — não conseguimos transcrever áudio,
      // explicamos o caminho alternativo em vez de tentar parse genérico
      // que falharia ou devolveria texto sem valor.
      const host = (() => {
        try {
          return new URL(input.url).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })();
      if (
        host.endsWith("spotify.com") ||
        host.endsWith("podcasts.apple.com") ||
        host.endsWith("podcasts.google.com")
      ) {
        return NextResponse.json(
          {
            error:
              "Spotify/Apple/Google Podcasts não liberam o áudio pra transcrição externa. Caminho: busca a versão YouTube do mesmo episódio (a maioria dos podcasts publica nos dois) e cola o link do YouTube aqui — a gente transcreve em ~1s.",
          },
          { status: 400 }
        );
      }
      const art = await extractArticle(input.url);
      const comprehension = await comprehendLink({
        rawText: art.text,
        hintTitle: art.title,
        hintUrl: art.url,
        kind: "news",
      });
      return NextResponse.json<ExtractResult>({
        kind: "news",
        title: art.title,
        url: art.url,
        text: art.text,
        truncated: art.truncated,
        comprehension,
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

    const comprehension = await comprehendLink({
      rawText: parsedDoc.content,
      hintTitle: parsedDoc.name,
      hintUrl: null,
      kind: "pdf",
    });
    return NextResponse.json<ExtractResult>({
      kind: "pdf",
      title: parsedDoc.name,
      url: null,
      text: parsedDoc.content,
      truncated: parsedDoc.truncated,
      comprehension,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "extract_failed" },
      { status: 500 }
    );
  }
}
