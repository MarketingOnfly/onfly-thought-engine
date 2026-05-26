"use client";

import { cn, formatCompact } from "@/lib/utils";

/**
 * Line chart com eixos, gridlines e dots. SVG puro, sem libs.
 *
 * `data` é a série numérica (uma por dia). Posição 0 = mais antigo,
 * última posição = hoje.
 */
export function Sparkline({
  data,
  height = 200,
  className,
  showArea = true,
  labels,
}: {
  data: number[];
  height?: number;
  className?: string;
  showArea?: boolean;
  /** Labels do eixo X. Se omitido, gera "há Nd" baseado no tamanho do array. */
  labels?: string[];
}) {
  if (!data.length) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-secondary/30 text-xs text-muted-foreground",
          className
        )}
        style={{ height }}
      >
        sem dados ainda
      </div>
    );
  }

  // Geometria — viewBox fixo, escala via width: 100%
  const VBW = 480;
  const VBH = height;
  const PAD = { top: 12, right: 12, bottom: 26, left: 38 };
  const innerW = VBW - PAD.left - PAD.right;
  const innerH = VBH - PAD.top - PAD.bottom;

  const max = Math.max(...data, 1);
  // mantém min em 0 pra não esmagar a curva
  const min = 0;
  const range = max - min || 1;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = PAD.left + i * stepX;
    const y = PAD.top + innerH - ((v - min) / range) * innerH;
    return { x, y, v };
  });

  const linePath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    )
    .join(" ");

  const areaPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${(
          PAD.top + innerH
        ).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(
          1
        )} Z`
      : "";

  // Y gridlines + labels: 4 níveis (0, max/3, 2*max/3, max)
  const yTicks = [0, max / 3, (2 * max) / 3, max].map((v) => ({
    v,
    y: PAD.top + innerH - ((v - min) / range) * innerH,
  }));

  // X labels — 3 marcações: primeira, meio, última
  const xMarks = (() => {
    if (data.length === 0) return [];
    const idxs = data.length >= 3 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0, data.length - 1];
    return idxs.map((i) => ({
      x: points[i].x,
      label: labels?.[i] ?? defaultXLabel(i, data.length),
    }));
  })();

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VBW} ${VBH}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#009efb" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#009efb" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines + Y labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={t.y}
            x2={VBW - PAD.right}
            y2={t.y}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeDasharray={i === 0 ? "0" : "2 3"}
          />
          <text
            x={PAD.left - 6}
            y={t.y + 3}
            textAnchor="end"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            fill="currentColor"
            opacity="0.55"
          >
            {formatCompact(t.v)}
          </text>
        </g>
      ))}

      {/* Área embaixo da curva */}
      {showArea && areaPath && (
        <path d={areaPath} fill="url(#sparkGradient)" />
      )}

      {/* Linha */}
      <path
        d={linePath}
        fill="none"
        stroke="#009efb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots em todos os pontos */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 4 : 2.5}
          fill="#009efb"
          stroke="#ffffff"
          strokeWidth="1.5"
        >
          <title>{`${labels?.[i] ?? defaultXLabel(i, data.length)}: ${formatCompact(
            p.v
          )}`}</title>
        </circle>
      ))}

      {/* X labels */}
      {xMarks.map((m, i) => (
        <text
          key={i}
          x={m.x}
          y={VBH - 8}
          textAnchor={i === 0 ? "start" : i === xMarks.length - 1 ? "end" : "middle"}
          fontSize="10"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill="currentColor"
          opacity="0.55"
        >
          {m.label}
        </text>
      ))}
    </svg>
  );
}

function defaultXLabel(i: number, total: number): string {
  // Última posição = hoje. Posição 0 = mais antiga.
  const daysAgo = total - 1 - i;
  if (daysAgo === 0) return "hoje";
  if (daysAgo === 1) return "ontem";
  return `há ${daysAgo}d`;
}

/**
 * Horizontal bar chart for ranking.
 */
export function BarRanking({
  items,
}: {
  items: { label: string; value: number; subtitle?: string; href?: string }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((it, idx) => {
        const pct = (it.value / max) * 100;
        const content = (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-start gap-2 font-medium">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[10px] font-mono text-brand-700">
                  {idx + 1}
                </span>
                <span className="line-clamp-2 break-words">{it.label}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-brand-700">
                {formatCompact(it.value)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-700 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {it.subtitle && (
              <p className="text-xs text-muted-foreground">{it.subtitle}</p>
            )}
          </div>
        );
        return (
          <li key={`${it.label}-${idx}`}>
            {it.href ? (
              <a
                href={it.href}
                target={it.href.startsWith("/") ? undefined : "_blank"}
                rel={it.href.startsWith("/") ? undefined : "noreferrer"}
                className="block transition-opacity hover:opacity-80"
              >
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Reexporta de lib/utils pra retrocompat — charts.tsx tem "use client" e
// importar daqui em Server Component quebra build. Use lib/utils direto
// em Server Components.
export { formatCompact } from "@/lib/utils";
