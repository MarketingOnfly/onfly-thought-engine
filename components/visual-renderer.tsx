"use client";

import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

/**
 * Renderiza infográfico HTML gerado pelo motor (Onfly theme + inline styles).
 *
 * DOMPurify config: permite SVG inline e o atributo `style` (necessário
 * pra o tema funcionar). Bloqueia tudo que pode executar código.
 */
export function InfographicRenderer({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
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

  return (
    <div className={cn("overflow-auto", className)}>
      <div dangerouslySetInnerHTML={{ __html: clean }} />
    </div>
  );
}
