"use client";

import { useState } from "react";
import {
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Send,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import { initials } from "@/lib/utils";

interface Props {
  text: string;
  authorName: string;
  authorRole?: string | null;
  authorAvatar?: string | null;
}

/**
 * Mockup do post como vai aparecer no feed do LinkedIn. Não 100% fiel,
 * mas próximo o suficiente pro líder visualizar antes de publicar.
 */
export function LinkedInPreview({
  text,
  authorName,
  authorRole,
  authorAvatar,
}: Props) {
  // LinkedIn corta no terceiro parágrafo (aprox 210 chars).
  // Aqui usamos o corte por blocos pra ficar mais próximo do real.
  const blocks = text.split(/\n\s*\n/).filter(Boolean);
  const FOLD_CHAR = 210;
  const [expanded, setExpanded] = useState(false);

  // Conta chars cumulativos até decidir onde quebrar
  let cumulative = 0;
  const visibleBlocks: string[] = [];
  let hasMore = false;
  for (const block of blocks) {
    if (cumulative + block.length > FOLD_CHAR && visibleBlocks.length >= 1) {
      hasMore = true;
      break;
    }
    visibleBlocks.push(block);
    cumulative += block.length;
  }

  const renderedBlocks = expanded ? blocks : visibleBlocks;

  return (
    <div className="overflow-hidden rounded-xl border border-[#dde0e3] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4">
        {authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={authorAvatar}
            alt={authorName}
            className="h-12 w-12 shrink-0 rounded-full border border-[#dde0e3] object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-medium text-white">
            {initials(authorName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-[#000000e6]">
            {authorName}
          </p>
          {authorRole && (
            <p className="text-xs leading-tight text-[#666666]">{authorRole}</p>
          )}
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#666666]">
            agora • <Globe className="h-3 w-3" />
          </p>
        </div>
        <button
          className="text-[#666666] hover:text-[#0a66c2]"
          type="button"
          aria-label="Mais opções"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <div className="space-y-2 text-sm leading-relaxed text-[#000000e6] whitespace-pre-line">
          {renderedBlocks.map((b, i) => (
            <p key={i}>{b}</p>
          ))}
        </div>
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 text-sm font-medium text-[#666666] hover:text-[#0a66c2] hover:underline"
          >
            …ver mais
          </button>
        )}
      </div>

      {/* Stats fake */}
      <div className="flex items-center justify-between border-t border-[#dde0e3] px-4 py-2 text-xs text-[#666666]">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#0a66c2] text-white">
              <ThumbsUp className="h-2.5 w-2.5" />
            </span>
          </div>
          <span>Pré-visualização — métricas não contam aqui</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-4 gap-1 border-t border-[#dde0e3] px-2 py-1">
        {[
          { Icon: ThumbsUp, label: "Curtir" },
          { Icon: MessageCircle, label: "Comentar" },
          { Icon: Repeat2, label: "Repostar" },
          { Icon: Send, label: "Enviar" },
        ].map(({ Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-medium text-[#666666] hover:bg-[#f4f2ee]"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
