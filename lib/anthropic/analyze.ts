/**
 * Análise automática de perfis de referência.
 * Lê o conteúdo público (Substack/blog/portal) e usa Claude pra extrair:
 *  - hooks (aberturas reais)
 *  - estilo de escrita (ritmo, estrutura)
 *  - tom (traços de voz)
 *  - posicionamento (tese recorrente)
 *  - temas e assuntos
 *  - vocabulário característico
 *
 * Para LinkedIn, retorna `unfetchable` — eles bloqueiam scraping.
 * Nesse caso o líder cola posts manualmente.
 */

import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { fetchSource } from "@/lib/fetch-source";

export interface AnalysisResult {
  status: "ok" | "unfetchable" | "analyzed_with_sample";
  hook_examples: string;
  style_notes: string;
  tone_signals: string[];
  positioning: string | null;
  topics_recurring: string[];
  vocab_notes: string | null;
  fetched_title?: string;
}

const ANALYSIS_PROMPT = `Você é um analista de estilo de escrita autoral. Vou te dar o conteúdo público de um perfil/site que um líder usa como referência de tom. Identifique os PADRÕES — não opine sobre a pessoa.

Devolva JSON puro, NADA de markdown nem prefixo. Schema obrigatório:
{
  "hook_examples": "string — 3 a 5 hooks REAIS extraídos do conteúdo, separados por LINHA EM BRANCO. NÃO invente; só transcreva trechos curtos da abertura de posts/textos.",
  "style_notes": "string — 4 a 7 bullets curtos começando com '-', um por linha, descrevendo padrão de hook, ritmo (frase curta/longa/mista), uso de números, estrutura recorrente e maneirismos.",
  "tone_signals": ["array de 3 a 6 traços de tom em pt-BR, ex: 'provocativo', 'analítico', 'bem-humorado', 'didático', 'contra-intuitivo', 'operador de bastidor'. Sem floreio."],
  "positioning": "string curta (1-2 frases) — a tese / posicionamento recorrente. O que essa pessoa DEFENDE publicamente. Se não der pra extrair, use null.",
  "topics_recurring": ["array de 3 a 6 temas/assuntos que aparecem com mais frequência, em pt-BR. Ex: 'travel-as-data', 'cultura híbrida', 'B2B brasileiro'. Substantivos curtos."],
  "vocab_notes": "string curta — vocabulário característico, jargões, expressões marcantes. Ex: 'usa muito \\\"queimar caixa\\\" e \\\"engolir margem\\\"'. Se nada destacar, use null."
}

Critérios:
- Nada de elogio genérico ("escreve muito bem", "engajamento alto").
- Foco em PADRÃO replicável, não em opinião sobre o autor.
- tone_signals e topics_recurring são ARRAYS de strings curtas, sempre.
- Se o conteúdo for fraco/insuficiente, devolva style_notes começando com "Conteúdo insuficiente para padrão: ..." e os outros campos como [] / null.
- NÃO inclua os campos do schema fora da estrutura. SOMENTE o objeto JSON.`;

function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

interface RawAnalysis {
  hook_examples?: string;
  style_notes?: string;
  tone_signals?: unknown;
  positioning?: string | null;
  topics_recurring?: unknown;
  vocab_notes?: string | null;
}

function tryParse(text: string): RawAnalysis | null {
  const trimmed = text.trim();
  // tenta 3 formas: JSON direto, JSON dentro de fences ```json, JSON entre {}
  try {
    return JSON.parse(trimmed);
  } catch {
    // fences
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fence) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        // fallthrough
      }
    }
    // primeiro objeto que parecer válido
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter(Boolean)
    .slice(0, 10);
}

function shape(raw: RawAnalysis): Omit<AnalysisResult, "status" | "fetched_title"> {
  return {
    hook_examples: typeof raw.hook_examples === "string" ? raw.hook_examples : "",
    style_notes: typeof raw.style_notes === "string" ? raw.style_notes : "",
    tone_signals: toStringArray(raw.tone_signals),
    positioning:
      typeof raw.positioning === "string" && raw.positioning.trim()
        ? raw.positioning.trim()
        : null,
    topics_recurring: toStringArray(raw.topics_recurring),
    vocab_notes:
      typeof raw.vocab_notes === "string" && raw.vocab_notes.trim()
        ? raw.vocab_notes.trim()
        : null,
  };
}

export async function analyzeReference(opts: {
  url: string;
  manualSample?: string | null;
}): Promise<AnalysisResult | { error: string } | null> {
  // Caminho 1: sample manual colado pelo líder (LinkedIn etc.)
  if (opts.manualSample && opts.manualSample.trim().length > 200) {
    const out = await callClaudeAnalysis(opts.manualSample);
    if ("error" in out) return out;
    return { status: "analyzed_with_sample", ...shape(out) };
  }

  // Caminho 2: tenta fetch público
  if (isLinkedInUrl(opts.url)) {
    return {
      status: "unfetchable",
      hook_examples: "",
      style_notes:
        "LinkedIn bloqueia leitura pública. Cole 2-3 posts dessa pessoa para o motor estudar o estilo.",
      tone_signals: [],
      positioning: null,
      topics_recurring: [],
      vocab_notes: null,
    };
  }

  const fetched = await fetchSource(opts.url);
  if (!fetched) {
    return {
      status: "unfetchable",
      hook_examples: "",
      style_notes:
        "Não consegui acessar essa URL (timeout ou bloqueio). Cole 2-3 exemplos diretamente.",
      tone_signals: [],
      positioning: null,
      topics_recurring: [],
      vocab_notes: null,
    };
  }

  if (fetched.content.length < 400) {
    return {
      status: "unfetchable",
      hook_examples: "",
      style_notes: `Conteúdo público insuficiente (${fetched.content.length} chars). Cole 2-3 exemplos pra análise.`,
      tone_signals: [],
      positioning: null,
      topics_recurring: [],
      vocab_notes: null,
    };
  }

  const out = await callClaudeAnalysis(fetched.content.slice(0, 8000));
  if ("error" in out) return out;

  return {
    status: "ok",
    fetched_title: fetched.title,
    ...shape(out),
  };
}

async function callClaudeAnalysis(
  content: string
): Promise<RawAnalysis | { error: string }> {
  const anthropic = getAnthropic();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2200,
        system: ANALYSIS_PROMPT,
        messages: [
          {
            role: "user",
            content: `Conteúdo a analisar:\n\n${content}`,
          },
        ],
      });
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n");
      const parsed = tryParse(text);
      if (parsed) return parsed;
      // se não parseou, tenta uma 2ª vez (raro mas acontece)
      if (attempt === 1) {
        return {
          error:
            "Claude devolveu JSON malformado nas duas tentativas. Tente colar 2-3 posts manualmente como exemplo.",
        };
      }
    } catch (err) {
      return {
        error: `Falha no Claude: ${
          err instanceof Error ? err.message : "erro desconhecido"
        }`,
      };
    }
  }
  return { error: "Análise não retornou resultado." };
}
