import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerUser } from "@/lib/supabase/server";
import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import { buildLeaderSystemPrompt } from "@/lib/anthropic/prompts";

export const maxDuration = 60;

const schema = z.object({
  attachments: z
    .array(
      z.object({
        kind: z.enum(["youtube", "news", "pdf", "discovery"]),
        title: z.string(),
        url: z.string().nullable().optional(),
        text: z.string().min(40, "texto curto demais"),
      })
    )
    .min(1, "anexe ao menos uma fonte"),
});

export interface AngleSuggestion {
  label: string; // headline curto do ângulo
  summary: string; // 2-3 frases explicando o ângulo
  why_for_you: string; // por que faz sentido pro líder
}

const SYSTEM_PROMPT = `Você é um senior editor que olha para uma pasta de materiais (vídeos, notícias, PDFs) e responde: "qual é o ÂNGULO mais autoral que esse líder específico pode tirar disso?"

Regras de saída — JSON puro, sem markdown, sem preâmbulo:

{
  "angles": [
    {
      "label": "headline curto do ângulo (até 80 chars)",
      "summary": "2-3 frases explicando o ângulo concreto — o quê dizer, qual a tensão, qual o recorte. Específico, não genérico.",
      "why_for_you": "1 frase: por que esse ângulo casa com a voz, audiência e posicionamento do líder descrito no system prompt."
    }
  ]
}

CRITÉRIOS:
- Devolve EXATAMENTE 3 ângulos distintos. Diferentes uns dos outros — não três variações do mesmo ponto.
- Cada ângulo precisa ter UMA tensão clara (X vs Y, mito vs realidade, mainstream vs contra-corrente).
- Prefere ângulo COM dado/fato concreto do material em vez de generalização.
- Se o material tem número específico, cita ele no summary.
- Voz: pt-BR de operador, direto, sem floreio corporativo.
- NÃO sugere "como se proteger de X" / "tendência X promete" — chavões de IA. Sugere recortes próprios.`;

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const ctx = await loadLeaderContext(user.id);
  if (!ctx) {
    return NextResponse.json(
      { error: "perfil incompleto" },
      { status: 412 }
    );
  }

  const system = buildLeaderSystemPrompt(ctx);

  const sourcesBlock = parsed.data.attachments
    .map((a, i) => {
      const kindLabel =
        a.kind === "youtube"
          ? "Vídeo do YouTube"
          : a.kind === "news"
            ? "Notícia / artigo"
            : a.kind === "pdf"
              ? "PDF"
              : "Fonte de discovery";
      const head = `[${i + 1}] ${kindLabel} — ${a.title}${
        a.url ? ` (${a.url})` : ""
      }`;
      return `${head}\n${a.text.slice(0, 6000)}`;
    })
    .join("\n\n---\n\n");

  const userPrompt = [
    "Você acabou de receber esses materiais. Devolva 3 ângulos autorais distintos que ESTE líder pode tirar.",
    "",
    "MATERIAIS:",
    sourcesBlock,
    "",
    "Responde com o JSON do schema. Apenas o JSON.",
  ].join("\n");

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 1500,
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: SYSTEM_PROMPT,
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    const angles = tryParseAngles(raw);
    if (!angles) {
      return NextResponse.json(
        { error: "Não consegui parsear ângulos. Tenta de novo." },
        { status: 500 }
      );
    }
    return NextResponse.json({ angles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "suggest_failed" },
      { status: 500 }
    );
  }
}

function tryParseAngles(raw: string): AngleSuggestion[] | null {
  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let parsed = tryParse(raw);
  if (!parsed) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as { angles?: unknown };
  if (!Array.isArray(p.angles)) return null;
  const out: AngleSuggestion[] = [];
  for (const a of p.angles) {
    if (
      a &&
      typeof a === "object" &&
      typeof (a as AngleSuggestion).label === "string" &&
      typeof (a as AngleSuggestion).summary === "string"
    ) {
      out.push({
        label: (a as AngleSuggestion).label.slice(0, 120),
        summary: (a as AngleSuggestion).summary.slice(0, 600),
        why_for_you:
          typeof (a as AngleSuggestion).why_for_you === "string"
            ? (a as AngleSuggestion).why_for_you.slice(0, 200)
            : "",
      });
    }
  }
  return out.length ? out.slice(0, 3) : null;
}
