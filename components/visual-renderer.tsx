"use client";

import { useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Check, Download, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Renderiza infográfico HTML gerado pelo motor (Onfly theme + inline styles).
 *
 * DOMPurify config: permite SVG inline e o atributo `style` (necessário
 * pra o tema funcionar). Bloqueia tudo que pode executar código.
 *
 * Inclui botão "Baixar PNG" — usa html-to-image pra rasterizar o DOM em PNG
 * em alta resolução (pixelRatio 2).
 */
export function InfographicRenderer({
  html,
  className,
  filename = "infografico-onfly",
}: {
  html: string;
  className?: string;
  filename?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "video", "audio"],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["style"],
  });

  async function downloadPng() {
    if (!containerRef.current) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      // pega o div que tem o infográfico inteiro (primeiro filho com role=figure
      // se existir, senão o container todo)
      const target =
        (containerRef.current.querySelector(
          '[role="figure"]'
        ) as HTMLElement | null) ?? containerRef.current;

      const dataUrl = await toPng(target, {
        pixelRatio: 2, // 2x pra ficar nítido em retina/print
        cacheBust: true,
        backgroundColor: "#ffffff",
        // alguns navegadores trancam fontes web — fallback pra system fonts
        skipFonts: false,
      });

      const link = document.createElement("a");
      link.download = `${filename}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao exportar PNG."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadPng} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando PNG…
            </>
          ) : done ? (
            <>
              <Check className="h-3.5 w-3.5" /> Baixado
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> Baixar PNG
            </>
          )}
        </Button>
      </div>
      <div
        ref={containerRef}
        className="overflow-auto rounded-xl border border-border bg-white p-2"
      >
        <div dangerouslySetInnerHTML={{ __html: clean }} />
      </div>
      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
