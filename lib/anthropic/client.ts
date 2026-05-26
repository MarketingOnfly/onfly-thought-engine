import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic() {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is missing");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

// Opus 4.7 — priorizando qualidade de construção de texto e raciocínio na descoberta de pauta.
// Trade-off conhecido: ~5x o custo do Sonnet 4.6, geração 8-12s vs 3-5s. Vale a pena pra autoria.
export const MODEL = "claude-opus-4-7";

// Sonnet 4.6 — pra tarefas de baixa latência (revisão em tempo real, análise estrutural).
// Sonnet é rápido e bom em raciocínio estruturado/JSON. Custo ~1/5 do Opus.
export const FAST_MODEL = "claude-sonnet-4-6";
