/**
 * Transcrição de vídeo do YouTube via legendas (closed captions).
 *
 * Usa o pacote `youtube-transcript` que bate direto no endpoint interno
 * do YouTube — não precisa de API key. Funciona em qualquer vídeo público
 * que TENHA legenda (auto ou manual).
 *
 * Limitações:
 *  - Sem legenda → falha (vídeo precisa ter capções, mesmo que automáticas).
 *  - Lives em andamento não funcionam.
 *  - Vídeos muito longos (> 1h) podem demorar — capamos em ~25k chars.
 */

import { YoutubeTranscript } from "youtube-transcript";

// Cap em 45k chars (~11k tokens) — cobre podcasts de até ~3h sem
// estourar contexto da Sonnet. Anteriormente estava em 25k mas
// perdíamos contexto em podcasts de 60-90min, justamente os mais
// interessantes pra leitura de mercado.
const MAX_CHARS = 45_000;

export interface YouTubeTranscriptResult {
  videoId: string;
  title: string;
  text: string;
  truncated: boolean;
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    // youtube.com/watch?v=<id>
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // /shorts/<id> ou /embed/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed") {
        return parts[1] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tenta pegar o título do vídeo via oEmbed (público, sem auth).
 */
async function fetchTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title ?? null;
  } catch {
    return null;
  }
}

export async function transcribeYoutube(
  url: string
): Promise<YouTubeTranscriptResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error(
      "URL do YouTube inválida. Cola o link completo (https://www.youtube.com/watch?v=… ou https://youtu.be/…)."
    );
  }

  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "pt",
    }).catch(() => YoutubeTranscript.fetchTranscript(videoId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("transcript")) {
      throw new Error(
        "Vídeo sem legenda disponível. Tenta um vídeo que tenha capções (auto ou manual)."
      );
    }
    throw new Error(`Não consegui pegar a transcrição: ${msg || "erro"}`);
  }

  if (!segments?.length) {
    throw new Error("Transcrição vazia. Vídeo pode estar restrito ou sem capções.");
  }

  const fullText = segments
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const truncated = fullText.length > MAX_CHARS;
  const text = truncated ? fullText.slice(0, MAX_CHARS) : fullText;

  const title =
    (await fetchTitle(videoId)) ?? `Vídeo do YouTube (${videoId})`;

  return { videoId, title, text, truncated };
}
