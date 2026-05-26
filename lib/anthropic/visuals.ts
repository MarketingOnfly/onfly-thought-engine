/**
 * Gerador de infográfico HTML com tema Onfly.
 * Suporta 5 arquétipos visuais — stats_grid, process_flow, comparison, timeline, key_insight.
 */

import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import { buildLeaderSystemPrompt } from "@/lib/anthropic/prompts";
import { ONFLY_THEME_PROMPT } from "@/lib/onfly-theme";

export type InfographicArchetype =
  | "stats_grid"
  | "process_flow"
  | "comparison"
  | "timeline"
  | "key_insight";

const ARCHETYPE_RULES: Record<InfographicArchetype, string> = {
  stats_grid: `ARQUÉTIPO: STATS GRID — 3 a 6 KPIs/números chave do tema.

ESTRUTURA OBRIGATÓRIA (HTML):
<div role="figure" style="font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.9rem; padding: 2.5rem 3rem; box-shadow: 0 16px 40px -16px rgba(0, 158, 251, 0.18); max-width: 880px;">
  <p style="font-family: 'Inter', sans-serif; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin: 0 0 0.5rem;">Eyebrow (3-5 palavras, contexto)</p>
  <h2 style="font-family: 'Fraunces', Georgia, serif; font-size: 1.875rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 2rem; color: #0f172a;">Título-tese (1 linha, opinião)</h2>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
    <div style="background: #f8fafc; border-radius: 0.75rem; padding: 1.5rem;">
      <p style="font-family: 'Fraunces', Georgia, serif; font-size: 3rem; font-weight: 600; line-height: 1; color: #009efb; margin: 0 0 0.5rem;">87%</p>
      <p style="font-size: 0.95rem; font-weight: 500; margin: 0 0 0.25rem; color: #0f172a;">Rótulo do número</p>
      <p style="font-size: 0.8125rem; color: #475569; margin: 0; line-height: 1.4;">Contexto curto explicando o número.</p>
    </div>
  </div>
  <p style="margin: 2rem 0 0; font-size: 0.875rem; color: #475569; line-height: 1.5; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">Bottom-line / o que isso significa pro líder em uma frase.</p>
</div>

Use apenas inline styles. Cada número usa cor primária #009efb. Pra destacar número crítico use #ff8811 (warning).`,

  process_flow: `ARQUÉTIPO: PROCESS FLOW — 3 a 5 etapas em sequência horizontal.

ESTRUTURA (HTML):
<div role="figure" style="font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.9rem; padding: 2.5rem 3rem; box-shadow: 0 16px 40px -16px rgba(0, 158, 251, 0.18); max-width: 940px;">
  <p style="font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin: 0 0 0.5rem;">Eyebrow</p>
  <h2 style="font-family: 'Fraunces', Georgia, serif; font-size: 1.875rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 2rem;">Título do processo (a tese)</h2>
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; align-items: stretch;">
    <div style="position: relative; background: #e6f6ff; border-radius: 0.75rem; padding: 1.25rem;">
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 9999px; background: #009efb; color: #ffffff; font-family: 'Fraunces', Georgia, serif; font-weight: 600; margin-bottom: 0.75rem;">1</span>
      <p style="font-weight: 600; margin: 0 0 0.25rem; color: #0f172a;">Etapa</p>
      <p style="font-size: 0.8125rem; color: #475569; margin: 0; line-height: 1.4;">Frase curta sobre o que acontece nessa etapa.</p>
    </div>
  </div>
  <p style="margin: 2rem 0 0; font-size: 0.875rem; color: #475569; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;">Onde isso quebra na maioria das empresas → o ângulo do líder.</p>
</div>`,

  comparison: `ARQUÉTIPO: COMPARISON — 2 colunas lado a lado (antes/depois, eles/nós, mito/realidade).

ESTRUTURA (HTML):
<div role="figure" style="font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.9rem; padding: 2.5rem 3rem; box-shadow: 0 16px 40px -16px rgba(0, 158, 251, 0.18); max-width: 920px;">
  <p style="font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin: 0 0 0.5rem;">Eyebrow</p>
  <h2 style="font-family: 'Fraunces', Georgia, serif; font-size: 1.875rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 2rem;">A contradição (X vs Y)</h2>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
    <div style="background: #f8fafc; border-radius: 0.75rem; padding: 1.5rem; border-left: 3px solid #94a3b8;">
      <p style="font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; margin: 0 0 0.5rem;">Visão antiga</p>
      <h3 style="font-family: 'Fraunces', Georgia, serif; font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem;">Como pensam</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; color: #475569;">Ponto 1</li>
        <li style="padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; color: #475569;">Ponto 2</li>
        <li style="padding: 0.5rem 0; font-size: 0.875rem; color: #475569;">Ponto 3</li>
      </ul>
    </div>
    <div style="background: #e6f6ff; border-radius: 0.75rem; padding: 1.5rem; border-left: 3px solid #009efb;">
      <p style="font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: #009efb; margin: 0 0 0.5rem;">Visão nova</p>
      <h3 style="font-family: 'Fraunces', Georgia, serif; font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem;">Como deveria ser</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        <li style="padding: 0.5rem 0; border-bottom: 1px solid #c2e8ff; font-size: 0.875rem; color: #0f172a;">Ponto 1</li>
        <li style="padding: 0.5rem 0; border-bottom: 1px solid #c2e8ff; font-size: 0.875rem; color: #0f172a;">Ponto 2</li>
        <li style="padding: 0.5rem 0; font-size: 0.875rem; color: #0f172a;">Ponto 3</li>
      </ul>
    </div>
  </div>
</div>`,

  timeline: `ARQUÉTIPO: TIMELINE — 3 a 6 marcos em sequência vertical.

ESTRUTURA (HTML):
<div role="figure" style="font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.9rem; padding: 2.5rem 3rem; box-shadow: 0 16px 40px -16px rgba(0, 158, 251, 0.18); max-width: 760px;">
  <p style="font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin: 0 0 0.5rem;">Eyebrow</p>
  <h2 style="font-family: 'Fraunces', Georgia, serif; font-size: 1.875rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 2rem;">A linha do tempo (a curva que ninguém viu)</h2>
  <ol style="margin: 0; padding: 0; list-style: none; position: relative;">
    <li style="position: relative; padding-left: 2.5rem; padding-bottom: 1.5rem; border-left: 2px solid #c2e8ff; margin-left: 0.5rem;">
      <span style="position: absolute; left: -0.6rem; top: 0; width: 1.1rem; height: 1.1rem; border-radius: 9999px; background: #009efb; border: 3px solid #ffffff; box-shadow: 0 0 0 1px #009efb;"></span>
      <p style="font-family: 'Fraunces', Georgia, serif; font-size: 1rem; font-weight: 600; color: #009efb; margin: 0 0 0.25rem;">2018</p>
      <p style="font-weight: 600; margin: 0 0 0.25rem;">Título do marco</p>
      <p style="font-size: 0.875rem; color: #475569; margin: 0; line-height: 1.5;">Descrição curta do que aconteceu e por que importou.</p>
    </li>
  </ol>
</div>`,

  key_insight: `ARQUÉTIPO: KEY INSIGHT — UM número gigante + a tese.

ESTRUTURA (HTML):
<div role="figure" style="font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: linear-gradient(135deg, #e6f6ff 0%, #ffffff 60%); border: 1px solid #e2e8f0; border-radius: 0.9rem; padding: 3rem; box-shadow: 0 16px 40px -16px rgba(0, 158, 251, 0.18); max-width: 760px; text-align: left;">
  <p style="font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #009efb; margin: 0 0 1rem; font-weight: 500;">Insight</p>
  <p style="font-family: 'Fraunces', Georgia, serif; font-size: clamp(4rem, 12vw, 7rem); font-weight: 600; line-height: 0.95; letter-spacing: -0.04em; color: #009efb; margin: 0 0 0.5rem;">87%</p>
  <p style="font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; font-weight: 600; line-height: 1.25; margin: 0 0 1.5rem; max-width: 540px;">A frase-tese que dá significado ao número.</p>
  <p style="font-size: 1rem; color: #475569; line-height: 1.6; margin: 0; max-width: 540px;">Parágrafo curto (2-3 frases) explicando o contexto, a fonte do número e a aposta autoral do líder.</p>
</div>`,
};

function buildInfographicPrompt(
  archetype: InfographicArchetype,
  topic: string,
  brief: string | null
): string {
  return [
    `TAREFA: gerar um INFOGRÁFICO em HTML, no arquétipo "${archetype}", que ajude o líder a estruturar visualmente a ideia abaixo.`,
    "",
    `TEMA: ${topic}`,
    "",
    brief ? `CONTEXTO:\n${brief}` : "",
    "",
    ONFLY_THEME_PROMPT,
    "",
    ARCHETYPE_RULES[archetype],
    "",
    "REGRAS DE SAÍDA:",
    "- ENTREGUE APENAS o HTML do <div> raiz. Sem markdown fences. Sem explicação antes/depois.",
    "- Use SOMENTE inline styles (atributo style=). Sem <style>, sem classes externas.",
    "- Pode usar <svg> inline pra ícones (linha 1.5px, stroke=#009efb, fill=none, width/height 18-24px).",
    "- Sem <script>, <link>, <iframe>, <video>, <audio>, on*=, javascript:.",
    "- Sem URLs externas. Sem imagens externas.",
    "- Conteúdo em português brasileiro, voz de operador, sem floreio.",
    "- Cada número, etapa, comparação deve trazer SUBSTÂNCIA — não placeholder. Use dados plausíveis quando o briefing der margem.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface GenerateVisualOpts {
  userId: string;
  archetype?: InfographicArchetype;
  topic: string;
  brief?: string | null;
}

export async function generateVisual(
  opts: GenerateVisualOpts
): Promise<{ payload: string; promptUsed: string } | null> {
  const context = await loadLeaderContext(opts.userId);
  if (!context) return null;

  const system = buildLeaderSystemPrompt(context);
  const userPrompt = buildInfographicPrompt(
    opts.archetype ?? "key_insight",
    opts.topic,
    opts.brief ?? null
  );

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  return { payload: cleanPayload(text), promptUsed: userPrompt };
}

function cleanPayload(raw: string): string {
  return raw
    .replace(/^```(?:html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
