/**
 * Extrator leve de notícia/artigo a partir de URL.
 *
 * Não usa jsdom/readability (heavy). Usa regex em cima do HTML:
 *  - <title>, meta og:title, meta description, meta og:description
 *  - parágrafos <p> dentro de <article>, <main> ou body
 *
 * É imperfeito (não vai pegar tudo em SPA puro), mas suficiente pra dar
 * matéria-prima ao modelo. O objetivo é alimentar contexto, não fazer
 * scraping perfeito.
 */

const MAX_CHARS = 15_000;
const FETCH_TIMEOUT = 12_000;

export interface ArticleExtraction {
  url: string;
  title: string;
  description: string | null;
  text: string;
  truncated: boolean;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickMetaContent(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m?.[1] ? decodeHtmlEntities(m[1]).trim() : null;
}

function extractTitle(html: string, fallbackUrl: string): string {
  const og = pickMetaContent(
    html,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (og) return og;
  const ogAlt = pickMetaContent(
    html,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
  );
  if (ogAlt) return ogAlt;
  const t = pickMetaContent(html, /<title[^>]*>([^<]+)<\/title>/i);
  if (t) return t;
  return new URL(fallbackUrl).hostname;
}

function extractDescription(html: string): string | null {
  return (
    pickMetaContent(
      html,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    ) ??
    pickMetaContent(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )
  );
}

function extractBodyText(html: string): string {
  // Tenta pegar o <article> primeiro
  let region = html.match(/<article[\s\S]*?<\/article>/i)?.[0];
  if (!region) region = html.match(/<main[\s\S]*?<\/main>/i)?.[0];
  if (!region) region = html.match(/<body[\s\S]*?<\/body>/i)?.[0];
  if (!region) region = html;

  // Pega texto de parágrafos
  const paragraphs = Array.from(region.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => decodeHtmlEntities(stripTags(m[1])))
    .filter((t) => t.length > 40); // descarta micro-parágrafos (nav, footer)

  if (paragraphs.length >= 3) return paragraphs.join("\n\n");

  // Fallback: pega texto cru
  return decodeHtmlEntities(stripTags(region));
}

/**
 * Substack tem RSS público em <subdomain>.substack.com/feed.
 * RSS NÃO tem paywall nem anti-bot — é texto puro com o conteúdo
 * dos últimos posts. Quando detectamos substack na URL, tentamos
 * RSS PRIMEIRO antes de tentar scraping HTML (que dá lixo nos
 * vídeos pagos).
 */
async function trySubstackRss(url: URL): Promise<{ html: string; usedRss: boolean }> {
  if (!url.hostname.endsWith(".substack.com")) return { html: "", usedRss: false };

  try {
    const feedUrl = `https://${url.hostname}/feed`;
    const res = await fetch(feedUrl, {
      headers: { "user-agent": "Mozilla/5.0 (OnflyThoughtEngine RSS Reader)" },
    });
    if (!res.ok) return { html: "", usedRss: false };
    const xml = await res.text();

    // Procura o item específico pelo path da URL original
    const slug = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const itemMatch = xml.match(
      new RegExp(
        `<item>[\\s\\S]*?<link>[^<]*${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[^<]*</link>[\\s\\S]*?</item>`,
        "i"
      )
    );

    if (!itemMatch) return { html: "", usedRss: false };

    // Extrai content:encoded (que tem o HTML do post completo)
    const contentMatch = itemMatch[0].match(
      /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/
    );
    if (!contentMatch) return { html: "", usedRss: false };

    const titleMatch = itemMatch[0].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/);
    const title = titleMatch?.[1] ?? "";

    // Monta HTML mínimo pra extractor processar
    const html = `<html><head><title>${title}</title><meta property="og:title" content="${title}"></head><body><article>${contentMatch[1]}</article></body></html>`;
    return { html, usedRss: true };
  } catch {
    return { html: "", usedRss: false };
  }
}

export async function extractArticle(url: string): Promise<ArticleExtraction> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida.");
  }
  if (!/^https?:/.test(parsed.protocol)) {
    throw new Error("Use uma URL http(s).");
  }

  // Tenta RSS pra substack ANTES de scraping (substack bloqueia bot HTML)
  const substackTry = await trySubstackRss(parsed);
  let html = substackTry.html;

  if (!html) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);

    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          // Pretende ser browser real — alguns sites bloqueiam user-agent custom
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        throw new Error(
          `Site respondeu ${res.status}. Pode estar bloqueando bots ou exigir login.`
        );
      }
      html = await res.text();
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        throw new Error("Site demorou demais pra responder (>12s).");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  const title = extractTitle(html, url);
  const description = extractDescription(html);
  const body = extractBodyText(html);

  const combined = [
    description ? `RESUMO: ${description}` : null,
    body,
  ]
    .filter(Boolean)
    .join("\n\n");

  const truncated = combined.length > MAX_CHARS;
  return {
    url,
    title,
    description,
    text: truncated ? combined.slice(0, MAX_CHARS) : combined,
    truncated,
  };
}
