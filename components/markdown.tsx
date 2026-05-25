import { cn } from "@/lib/utils";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-secondary px-1.5 py-0.5 text-[0.85em]">$1</code>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a class="text-brand-700 underline-offset-2 hover:underline" href="$2" target="_blank" rel="noreferrer">$1</a>'
    );
}

function renderBlocks(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  let paragraphBuffer: string[] = [];
  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      const text = paragraphBuffer.join(" ").trim();
      if (text) {
        out.push(`<p>${inline(escapeHtml(text))}</p>`);
      }
      paragraphBuffer = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      closeLists();
      continue;
    }

    const hMatch = /^(#{1,4})\s+(.+)$/.exec(line);
    if (hMatch) {
      flushParagraph();
      closeLists();
      const level = hMatch[1].length;
      const tag = `h${level}`;
      out.push(`<${tag}>${inline(escapeHtml(hMatch[2]))}</${tag}>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inUl) {
        closeLists();
        out.push("<ul>");
        inUl = true;
      }
      const item = line.replace(/^\s*[-*]\s+/, "");
      out.push(`<li>${inline(escapeHtml(item))}</li>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      if (!inOl) {
        closeLists();
        out.push("<ol>");
        inOl = true;
      }
      const item = line.replace(/^\s*\d+\.\s+/, "");
      out.push(`<li>${inline(escapeHtml(item))}</li>`);
      continue;
    }

    if (/^>\s+/.test(line)) {
      flushParagraph();
      closeLists();
      out.push(`<blockquote>${inline(escapeHtml(line.replace(/^>\s+/, "")))}</blockquote>`);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  closeLists();
  return out.join("\n");
}

export function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const html = renderBlocks(source);
  return (
    <div
      className={cn(
        "prose-content max-w-none text-foreground",
        "[&_h1]:font-display [&_h1]:text-3xl [&_h1]:tracking-tight [&_h1]:mb-2 [&_h1]:mt-6",
        "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:mb-2 [&_h2]:mt-6",
        "[&_h3]:font-display [&_h3]:text-xl [&_h3]:tracking-tight [&_h3]:mb-2 [&_h3]:mt-5",
        "[&_p]:my-3 [&_p]:leading-relaxed",
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:my-1",
        "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function PlainPost({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap font-sans text-[15px] leading-relaxed",
        className
      )}
    >
      {source}
    </div>
  );
}
