/**
 * Transcrição de vídeo do YouTube com fallback em 2 camadas:
 *
 * 1. Tenta LEGENDAS (via youtube-transcript). Rápido, grátis. Funciona em
 *    ~90% dos vídeos populares que têm caption auto ativada.
 * 2. Se falha, BAIXA O ÁUDIO via @distube/ytdl-core e transcreve via
 *    OpenAI Whisper API. Mais lento (~10-40s pra podcast de 30min),
 *    custa ~$0.006/min, mas funciona em QUALQUER vídeo público.
 *
 * Limitações da camada 2:
 *  - Cap de 60min de vídeo (Whisper API só aceita arquivos até 25MB).
 *  - Vídeos com restrição de idade ou que YouTube bloqueia bot podem falhar.
 *  - Lives em andamento não funcionam.
 *  - Requer OPENAI_API_KEY no env.
 */

import { YoutubeTranscript } from "youtube-transcript";
import ytdl from "@distube/ytdl-core";
import OpenAI from "openai";

// Cap em 45k chars (~11k tokens) — cobre podcasts de até ~3h sem
// estourar contexto da Sonnet.
const MAX_CHARS = 45_000;
// Cap de duração do vídeo pra fallback Whisper. Acima disso o áudio
// passa de 25MB (limite Whisper) com codec opus em qualidade decente.
const MAX_VIDEO_SECONDS = 3600; // 60 minutos

export interface YouTubeTranscriptResult {
  videoId: string;
  title: string;
  text: string;
  truncated: boolean;
  source: "captions" | "whisper"; // qual método foi usado
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (
      u.hostname === "www.youtube.com" ||
      u.hostname === "youtube.com" ||
      u.hostname === "m.youtube.com"
    ) {
      const v = u.searchParams.get("v");
      if (v) return v;
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

/**
 * CAMADA 1 — tenta pegar legendas (caption auto ou manual) do YouTube.
 * Rápido e grátis. Funciona quando o vídeo tem qualquer caption ativa.
 */
async function tryCaptions(videoId: string): Promise<string | null> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "pt",
    }).catch(() => YoutubeTranscript.fetchTranscript(videoId));

    if (!segments?.length) return null;

    const fullText = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return fullText || null;
  } catch {
    return null;
  }
}

/**
 * CAMADA 2 — baixa o áudio do YouTube e transcreve via OpenAI Whisper.
 * Mais lento e custa por minuto, mas funciona em qualquer vídeo público.
 */
async function tryWhisper(
  url: string,
  videoId: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Vídeo sem legenda disponível, e a transcrição automática (Whisper) precisa de OPENAI_API_KEY configurada no ambiente. Avisa o admin."
    );
  }

  // 1. Pega info do vídeo pra checar duração
  let info;
  try {
    info = await ytdl.getInfo(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    throw new Error(
      `Não consegui acessar o vídeo pra baixar o áudio: ${msg}. Pode ser vídeo privado, com restrição de idade, ou YouTube bloqueando.`
    );
  }

  const lengthSeconds = Number(info.videoDetails.lengthSeconds ?? 0);
  if (lengthSeconds > MAX_VIDEO_SECONDS) {
    throw new Error(
      `Vídeo muito longo (${Math.round(lengthSeconds / 60)}min). Limite é 60min pra transcrição automática. Tenta um vídeo mais curto ou um que tenha legenda ativada.`
    );
  }

  // 2. Baixa áudio em qualidade mais baixa (audio-only) pra arquivo menor
  const audioStream = ytdl(url, {
    quality: "lowestaudio",
    filter: "audioonly",
  });

  // 3. Junta os chunks num buffer
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const MAX_BYTES = 24 * 1024 * 1024; // 24MB — margem antes do limite 25MB do Whisper

  for await (const chunk of audioStream) {
    const buf = chunk as Buffer;
    totalBytes += buf.length;
    if (totalBytes > MAX_BYTES) {
      throw new Error(
        "Áudio passou de 24MB durante download. Vídeo muito longo ou com bitrate alto. Tenta um mais curto ou com legenda ativada."
      );
    }
    chunks.push(buf);
  }
  const audioBuffer = Buffer.concat(chunks);

  if (audioBuffer.length === 0) {
    throw new Error("Download do áudio retornou vazio. YouTube pode estar bloqueando o request.");
  }

  // 4. Transcreve via OpenAI Whisper
  // Whisper SDK aceita File-like — em Node 20+ temos File global
  const openai = new OpenAI({ apiKey });
  const file = new File([audioBuffer], `${videoId}.webm`, {
    type: "audio/webm",
  });

  let transcript;
  try {
    transcript = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt", // dica que o áudio é português (Whisper detecta auto, mas a dica acelera)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    throw new Error(`Falha no Whisper: ${msg}`);
  }

  return transcript.text?.trim() || null;
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

  // CAMADA 1: legendas
  let text = await tryCaptions(videoId);
  let source: "captions" | "whisper" = "captions";

  // CAMADA 2: Whisper (se legendas falharam)
  if (!text) {
    text = await tryWhisper(url, videoId);
    source = "whisper";
  }

  if (!text) {
    throw new Error(
      "Não consegui transcrever esse vídeo. Tenta um vídeo com legenda ativada, mais curto que 60min, ou cola um resumo do conteúdo no campo de ideia."
    );
  }

  const truncated = text.length > MAX_CHARS;
  const finalText = truncated ? text.slice(0, MAX_CHARS) : text;
  const title = (await fetchTitle(videoId)) ?? `Vídeo do YouTube (${videoId})`;

  return { videoId, title, text: finalText, truncated, source };
}
