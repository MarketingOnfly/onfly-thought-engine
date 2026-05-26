/**
 * Onfly Theme — design tokens compartilhados pelos infográficos.
 *
 * Travel-tech B2B brasileiro. Azul corporativo confiável.
 * Voz de operador: nada decorativo, sem gradientes neon, sem ícones de stock.
 */

export const ONFLY_THEME = {
  colors: {
    bg: "#ffffff",
    surface: "#f8fafc", // slate-50
    surfaceMuted: "#eff6ff", // brand-50
    border: "#e2e8f0", // slate-200
    borderStrong: "#cbd5e1", // slate-300
    text: "#0f172a", // slate-900
    textMuted: "#475569", // slate-600
    textSubtle: "#94a3b8", // slate-400

    primary: "#009efb", // Onfly azul oficial (brand-500)
    primaryStrong: "#0068ad", // brand-700
    primarySoft: "#c2e8ff", // brand-100
    primaryBg: "#e6f6ff", // brand-50
    navy: "#0f3163", // navy oficial (títulos fortes)

    accent: "#34e098", // Onfly verde oficial (positivo)
    accentSoft: "#d1fae5",
    warning: "#ff8811", // Onfly laranja oficial (aposta/alerta)
    warningSoft: "#ffedd5",
    danger: "#dc2626", // red-600
    dangerSoft: "#fee2e2",
  },
  fonts: {
    display: "'Fraunces', Georgia, serif",
    body: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "0.9rem", // padrão Onfly
    xl: "1.25rem",
    full: "9999px",
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  shadows: {
    sm: "0 1px 2px rgba(15, 23, 42, 0.04)",
    md: "0 4px 12px -2px rgba(15, 23, 42, 0.06)",
    lg: "0 16px 40px -16px rgba(0, 158, 251, 0.18)",
  },
};

/**
 * String do tema injetado no prompt do Claude.
 * Mantemos a referência visual completa pra que ele entenda os tokens
 * e a hierarquia esperada.
 */
export const ONFLY_THEME_PROMPT = `TOKENS DE DESIGN ONFLY (use SEMPRE estes valores — nenhum fora):

CORES (hex obrigatórios):
- Fundo principal: ${ONFLY_THEME.colors.bg}
- Fundo de bloco (sutil): ${ONFLY_THEME.colors.surface}
- Fundo destaque (azul claro): ${ONFLY_THEME.colors.surfaceMuted}
- Borda: ${ONFLY_THEME.colors.border}
- Texto: ${ONFLY_THEME.colors.text}
- Texto secundário: ${ONFLY_THEME.colors.textMuted}
- Azul primário (números, hooks): ${ONFLY_THEME.colors.primary}
- Azul forte (títulos, ícones): ${ONFLY_THEME.colors.primaryStrong}
- Azul soft (badges, fundos de pill): ${ONFLY_THEME.colors.primarySoft}
- Positivo (ganho, crescimento): ${ONFLY_THEME.colors.accent}
- Aposta/alerta (números a observar): ${ONFLY_THEME.colors.warning}

TIPOGRAFIA:
- Títulos H1/H2: ${ONFLY_THEME.fonts.display}, font-weight 600, letter-spacing -0.02em
- Corpo, labels, descrições: ${ONFLY_THEME.fonts.body}
- Números grandes (KPI): ${ONFLY_THEME.fonts.display}, font-size clamp(2.5rem, 6vw, 4.5rem), font-weight 600
- Mini-rótulos: ${ONFLY_THEME.fonts.body}, font-size 0.75rem, letter-spacing 0.06em, text-transform uppercase, color ${ONFLY_THEME.colors.textSubtle}

LAYOUT:
- Container raiz: padding 2.5rem 3rem, border-radius ${ONFLY_THEME.radius.lg}, border 1px solid ${ONFLY_THEME.colors.border}, background ${ONFLY_THEME.colors.bg}
- Sombra do container: ${ONFLY_THEME.shadows.lg}
- Cards internos: border-radius ${ONFLY_THEME.radius.md}, padding 1.5rem, background ${ONFLY_THEME.colors.surface}
- Espaçamento entre seções: 2rem
- Espaçamento entre cards: 1rem

REGRAS DUROS:
- Nada de gradientes neon, drop-shadow exagerado, "glassmorphism".
- Sem emoji de stock decorativo. Se precisar de ícone, use SVG inline simples (linha 1.5px, currentColor) ou um único caractere unicode discreto.
- Sem texto sublinhado decorativo. Sem text-shadow.
- Sem cores fora da paleta acima.
- Diagonais e bordas arredondadas são livres, mas sempre com radius dos tokens.`;
