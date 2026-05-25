interface FetchedSource {
  url: string;
  title: string;
  content: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string, fallback: string): string {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (og) return og[1];
  const t = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  if (t) return t[1].trim();
  return fallback;
}

export async function fetchSource(url: string): Promise<FetchedSource | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OnflyThoughtEngine/1.0; +https://onfly.com.br)",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const title = extractTitle(html, new URL(url).hostname);
    const content = stripHtml(html).slice(0, 12000);
    return { url, title, content };
  } catch {
    return null;
  }
}

export async function fetchSources(urls: string[]): Promise<FetchedSource[]> {
  const results = await Promise.all(urls.map(fetchSource));
  return results.filter((x): x is FetchedSource => x !== null);
}
