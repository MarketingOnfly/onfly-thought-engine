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

export const MODEL = "claude-sonnet-4-6";
