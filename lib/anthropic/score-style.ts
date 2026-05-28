/**
 * Auto-avaliação do draft contra o estilo do líder.
 *
 * Matriz de 5 dimensões, cada uma 0-20 pts, total 0-100:
 *   1. Anti-IA tells (DETERMINÍSTICO via regex)
 *   2. Aderência ao tom do líder (LLM com rubrica)
 *   3. Estrutura do post (DETERMINÍSTICO + LLM)
 *   4. Substância (LLM com rubrica)
 *   5. Aderência às preferências aprendidas (LLM com rubrica)
 *
 * Cada dimensão tem critérios objetivos. Não devolvemos "uma nota". O
 * resultado é uma decomposição que o líder consegue ler e agir.
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import type { LeaderProfile } from "@/lib/db/types";
import { TONE_TRAITS, TONE_AVOID } from "@/lib/style-presets";
import { detectContraposicao } from "@/lib/anthropic/polish-pass";

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSÃO 1 — Anti-IA tells (DETERMINÍSTICO)
// ─────────────────────────────────────────────────────────────────────────────

const BANNED_VOCAB = [
  "jornada",
  "ecossistema",
  "vibrante",
  "intricado",
  "tapeçaria",
  "robusto",
  "holístico",
  "sinergia",
  "fomentar",
  "alavancar",
  "pivotal",
  "panorama",
  "marca indelével",
  "no fim do dia",
  "no final do dia",
  "no fim das contas",
  "vivemos uma era",
  "em um mundo onde",
  "no mundo dinâmico",
  "vale destacar",
  "vale a pena destacar",
  "é importante notar",
  "como mencionado anteriormente",
  "trazer valor",
  "performar",
  "deliverar",
  "mindset",
  "stakeholder",
  "disruptivo",
  "leverage",
  "deliver value",
  "game-changer",
  "cutting-edge",
];

interface AntiAiTells {
  score: number; // 0-20
  deductions: string[];
}

function scoreAntiAiTells(text: string): AntiAiTells {
  let score = 20;
  const deductions: string[] = [];

  // Em dash (já era pra ter sido removido por applyHardRules, mas re-checa)
  const emDashCount = (text.match(/—/g) || []).length;
  if (emDashCount > 0) {
    const penalty = Math.min(8, emDashCount * 3);
    score -= penalty;
    deductions.push(
      `${emDashCount} em dash(es) (-${penalty}). Substitua por vírgula/ponto/dois-pontos.`
    );
  }

  // Contraposição paralela "não X, é Y"
  const contras = detectContraposicao(text);
  if (contras.length > 0) {
    const penalty = Math.min(8, contras.length * 4);
    score -= penalty;
    deductions.push(
      `${contras.length} contraposição(ões) paralela(s) tipo "não X, é Y" (-${penalty}). Quebre em 2 frases independentes.`
    );
  }

  // Banned vocab
  const lower = text.toLowerCase();
  const bannedHits: string[] = [];
  for (const word of BANNED_VOCAB) {
    if (lower.includes(word)) bannedHits.push(word);
  }
  if (bannedHits.length > 0) {
    const penalty = Math.min(6, bannedHits.length * 2);
    score -= penalty;
    deductions.push(
      `${bannedHits.length} palavra(s) AI-coded (-${penalty}): ${bannedHits.slice(0, 4).join(", ")}${bannedHits.length > 4 ? "..." : ""}`
    );
  }

  // Emoji (regex de emoji unicode)
  const emojiCount = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 0) {
    const penalty = Math.min(4, emojiCount);
    score -= penalty;
    deductions.push(`${emojiCount} emoji(s) (-${penalty}). Default da plataforma é zero.`);
  }

  // CTA mole no fechamento
  const ctaPatterns = [
    /comente?\s+aí/i,
    /deixa\s+sua\s+opinião/i,
    /espero\s+ter\s+ajudado/i,
    /e\s+você,?\s+o\s+que\s+acha/i,
    /bora\s+trocar\s+uma\s+ideia/i,
    /simples\s+assim\s*[.!]?\s*$/i,
  ];
  const last200 = text.slice(-200);
  const ctaHits = ctaPatterns.filter((p) => p.test(last200));
  if (ctaHits.length > 0) {
    score -= 4;
    deductions.push(
      `CTA clichê no fechamento (-4). Use assertion ou zinger em vez de pergunta retórica.`
    );
  }

  return {
    score: Math.max(0, score),
    deductions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSÃO 3 — Estrutura (parcialmente determinístico)
// ─────────────────────────────────────────────────────────────────────────────

interface StructureChecks {
  score: number; // 0-20
  hook_works: boolean;
  has_anchor: boolean;
  has_isolated_line: boolean;
  dry_close: boolean;
  notes: string[];
}

function scoreStructure(text: string): StructureChecks {
  const notes: string[] = [];
  let score = 0;

  const lines = text.split("\n");
  const firstThreeLines = lines.slice(0, 3).join(" ").trim();

  // Hook: as 3 primeiras linhas têm < 210 chars E não começam com "Trago hoje" / "Compartilho" / "Você já parou"
  const lameOpenings = [
    /^trago\s+hoje/i,
    /^compartilho\s+com/i,
    /^você\s+já\s+parou/i,
    /^venha\s+conosco/i,
    /^pensando\s+nisso/i,
    /^refletindo\s+sobre/i,
    /^vamos\s+falar/i,
  ];
  const hookWorks =
    firstThreeLines.length > 20 &&
    !lameOpenings.some((p) => p.test(firstThreeLines));
  if (hookWorks) {
    score += 5;
  } else {
    notes.push("Hook (3 primeiras linhas) fraco ou começa com abertura clichê.");
  }

  // Anchor: tem número específico, ano (4 dígitos), nome próprio com maiúscula, ou citação entre aspas no início
  const firstHalf = text.slice(0, Math.floor(text.length / 2));
  const hasNumber = /\b\d{2,}([.,]\d+)?\s*(%|mil|milhão|anos?|meses?|h|m|R\$)?/i.test(
    firstHalf
  );
  const hasYear = /\b(19|20)\d{2}\b/.test(firstHalf);
  const hasQuotedAnchor = /["“][^"”]{15,}["”]/.test(firstHalf);
  const hasNamedEntity = /\b[A-Z][a-záéíóúâêôãõç]{3,}\s+[A-Z][a-záéíóúâêôãõç]{2,}\b/.test(
    firstHalf
  );
  const hasAnchor = hasNumber || hasYear || hasQuotedAnchor || hasNamedEntity;
  if (hasAnchor) {
    score += 5;
  } else {
    notes.push("Sem âncora concreta na 1ª metade (número, ano, citação ou nome próprio).");
  }

  // Frase-âncora isolada: pelo menos 1 parágrafo de 1 linha curta no meio do texto
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const middleParagraphs = paragraphs.slice(
    Math.floor(paragraphs.length / 4),
    Math.ceil((paragraphs.length * 3) / 4)
  );
  const hasIsolatedLine = middleParagraphs.some((p) => {
    const wordCount = p.split(/\s+/).length;
    return !p.includes("\n") && wordCount >= 4 && wordCount <= 18;
  });
  if (hasIsolatedLine) {
    score += 5;
  } else {
    notes.push("Sem frase-âncora isolada no meio (parágrafo de 1 linha curta como pausa visual).");
  }

  // Close seco: última linha não é pergunta E não termina com clichê
  const lastParagraph =
    paragraphs[paragraphs.length - 1] ?? text.trim().slice(-200);
  const endsWithQuestion = /\?\s*$/.test(lastParagraph);
  const closeCliches =
    /(comente\s+aí|deixa\s+sua\s+opinião|espero\s+ter\s+ajudado|simples\s+assim|bora\s+trocar)/i.test(
      lastParagraph
    );
  const dryClose = !endsWithQuestion && !closeCliches && lastParagraph.length < 250;
  if (dryClose) {
    score += 5;
  } else {
    if (endsWithQuestion) notes.push("Close termina com pergunta (default da plataforma é assertion).");
    if (closeCliches) notes.push("Close usa CTA clichê.");
    if (lastParagraph.length >= 250)
      notes.push("Último parágrafo longo (>250 chars). Close seco corta antes.");
  }

  return {
    score,
    hook_works: hookWorks,
    has_anchor: hasAnchor,
    has_isolated_line: hasIsolatedLine,
    dry_close: dryClose,
    notes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSÕES 2, 4, 5 — Voice / Substance / Learned (LLM com rubrica)
// ─────────────────────────────────────────────────────────────────────────────

interface LlmDimensions {
  voice_match: { score: number; notes: string };
  substance: { score: number; notes: string };
  learned_match: { score: number; notes: string };
  matches: string[];
  gaps: string[];
}

function labelize<T extends { key: string; label: string }>(
  items: readonly T[],
  keys: string[] | undefined | null
): string {
  if (!keys?.length) return "—";
  return keys.map((k) => items.find((i) => i.key === k)?.label ?? k).join(", ");
}

async function scoreLlmDimensions(opts: {
  draftText: string;
  profile: LeaderProfile;
}): Promise<LlmDimensions> {
  const traits = labelize(TONE_TRAITS, opts.profile.tone_traits);
  const avoid = labelize(TONE_AVOID, opts.profile.tone_avoid);
  const learned = opts.profile.learned_preferences?.trim();

  const SYSTEM = `Você é um avaliador severo com RUBRICA EXPLÍCITA. Devolve JSON puro, sem markdown.

Você avalia 3 dimensões. Cada uma vale 0 a 20 pontos. NÃO devolva 10-15 como "default confortável" — use os ANCORAS abaixo.

DIMENSÃO 2 — VOICE MATCH (0-20):
Quanto o vocabulário, registro e ritmo casam com o tone_traits + tone_examples do líder.
- 20: cada parágrafo soa indistinguível do tone_examples. Vocabulário, contrações, ritmo.
- 16: voz reconhecível em 80% do texto. 1-2 pontos onde escapou pra registro genérico.
- 12: estilo médio. Reconhecível em metade. Outras metade neutro/genérico.
- 8: poucos toques da voz, predominantemente neutro corporativo.
- 4: cheira a copywriter genérico, não o líder.
- 0: tom completamente diferente do líder.

DIMENSÃO 4 — SUBSTÂNCIA (0-20):
Tem opinião autoral + algum recorte concreto (número, nome, cena, decisão tomada)?
- 20: tese clara + ao menos 2 ganchos concretos (número específico, nome próprio, recorte de bastidor com hora/lugar)
- 16: tese clara + 1 gancho concreto
- 12: tese implícita + 1 gancho concreto OU tese clara sem gancho
- 8: comentário genérico de mercado, sem aposta autoral
- 4: parafraseou consenso de mercado
- 0: pura platitude

DIMENSÃO 5 — LEARNED MATCH (0-20):
Quanto o texto respeita as PREFERÊNCIAS APRENDIDAS do líder (lista de "Gosta: X" / "Evita: Y").
- 20: respeita TODAS as preferências
- 16: respeita maioria, 1 escapou
- 12: respeita metade
- 8: viola maioria das preferências
- 4: viola múltiplos itens importantes
- 0: ignora todas
- Se não houver preferências aprendidas, devolva 15 (neutro, sem dados pra avaliar).

Schema de saída:
{
  "voice_match": { "score": número 0-20, "notes": "1 frase específica explicando o número" },
  "substance": { "score": número 0-20, "notes": "1 frase específica" },
  "learned_match": { "score": número 0-20, "notes": "1 frase específica" },
  "matches": ["até 4 bullets curtos do que CASOU bem"],
  "gaps": ["até 4 bullets curtos do que ESCAPOU"]
}

Regras:
- score precisa ser INT (não decimal).
- notes em pt-BR direto, sem floreio.
- Cite trecho específico quando possível ("usou 'no fim do dia' no 2º parágrafo").
- VARIE os scores. Texto bom não tira 17 em tudo. Texto ruim não tira 8 em tudo.`;

  const userText = `ESTILO DO LÍDER:
- Traços de tom: ${traits}
- NUNCA escreveria: ${avoid}
- Exemplos próprios de tom:
${opts.profile.tone_examples ?? "(nenhum)"}

PREFERÊNCIAS APRENDIDAS DE FEEDBACK ANTERIOR:
${learned || "(nenhuma ainda — para learned_match devolva 15)"}

TEXTO A AVALIAR:
"""
${opts.draftText.slice(0, 6000)}
"""

Devolva o JSON com voice_match, substance, learned_match, matches, gaps.`;

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  // Parse defensivo
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = null;
      }
    }
  }

  function clampScore(v: unknown): number {
    const n = Number((v as Record<string, unknown>)?.score ?? v);
    if (!Number.isFinite(n)) return 10;
    return Math.max(0, Math.min(20, Math.round(n)));
  }

  function getNotes(v: unknown): string {
    const s = (v as Record<string, unknown>)?.notes;
    return typeof s === "string" ? s : "";
  }

  return {
    voice_match: {
      score: clampScore(parsed?.voice_match),
      notes: getNotes(parsed?.voice_match),
    },
    substance: {
      score: clampScore(parsed?.substance),
      notes: getNotes(parsed?.substance),
    },
    learned_match: {
      score: clampScore(parsed?.learned_match),
      notes: getNotes(parsed?.learned_match),
    },
    matches: Array.isArray(parsed?.matches)
      ? (parsed.matches as unknown[]).map(String).slice(0, 4)
      : [],
    gaps: Array.isArray(parsed?.gaps)
      ? (parsed.gaps as unknown[]).map(String).slice(0, 4)
      : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORQUESTRADOR — combina as 5 dimensões em score final
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreDimensions {
  anti_ai_tells: { score: number; max: 20; deductions: string[] };
  voice_match: { score: number; max: 20; notes: string };
  structure: {
    score: number;
    max: 20;
    hook_works: boolean;
    has_anchor: boolean;
    has_isolated_line: boolean;
    dry_close: boolean;
    notes: string[];
  };
  substance: { score: number; max: 20; notes: string };
  learned_match: { score: number; max: 20; notes: string };
}

export async function scoreStyle(opts: {
  draftText: string;
  profile: LeaderProfile;
}): Promise<{
  overall: number;
  matches: string[];
  gaps: string[];
  dimensions: ScoreDimensions;
}> {
  // Roda dimensões determinísticas + LLM em paralelo
  const antiAi = scoreAntiAiTells(opts.draftText);
  const structure = scoreStructure(opts.draftText);
  const llm = await scoreLlmDimensions(opts);

  const dimensions: ScoreDimensions = {
    anti_ai_tells: { score: antiAi.score, max: 20, deductions: antiAi.deductions },
    voice_match: { score: llm.voice_match.score, max: 20, notes: llm.voice_match.notes },
    structure: {
      score: structure.score,
      max: 20,
      hook_works: structure.hook_works,
      has_anchor: structure.has_anchor,
      has_isolated_line: structure.has_isolated_line,
      dry_close: structure.dry_close,
      notes: structure.notes,
    },
    substance: { score: llm.substance.score, max: 20, notes: llm.substance.notes },
    learned_match: { score: llm.learned_match.score, max: 20, notes: llm.learned_match.notes },
  };

  const overall =
    antiAi.score +
    llm.voice_match.score +
    structure.score +
    llm.substance.score +
    llm.learned_match.score;

  // matches: bullets do LLM + 1 por dimensão estrutural que passou
  const structuralMatches: string[] = [];
  if (structure.hook_works) structuralMatches.push("Hook funciona nas 3 primeiras linhas");
  if (structure.has_anchor) structuralMatches.push("Tem âncora concreta (número/ano/citação)");
  if (structure.has_isolated_line)
    structuralMatches.push("Tem frase-âncora isolada como pausa visual");
  if (structure.dry_close) structuralMatches.push("Close seco, sem CTA mole");

  // gaps: bullets do LLM + penalidades anti-IA + notes estruturais
  const allGaps = [
    ...antiAi.deductions,
    ...structure.notes,
    ...llm.gaps,
  ].slice(0, 8);

  return {
    overall: Math.max(0, Math.min(100, overall)),
    matches: [...structuralMatches, ...llm.matches].slice(0, 6),
    gaps: allGaps,
    dimensions,
  };
}
