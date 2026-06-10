import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import { z } from "zod";

export const maxDuration = 30;
export const runtime = "nodejs";

const schema = z.object({
  topic: z.string().min(5).max(2000),
});

/**
 * MODO ENTREVISTA (benchmark: Supergrow "Postcast").
 *
 * Em vez de o motor INVENTAR especificidade (proibido pela REGRA ZERO)
 * ou entregar post vago, ele ENTREVISTA o líder: 3 perguntas curtas
 * que extraem os fatos/histórias/opiniões REAIS sobre o tema. As
 * respostas viram parte do briefing da geração — especificidade
 * verdadeira, fornecida na hora.
 */
const SYSTEM_PROMPT = `Você é um entrevistador editorial que prepara um líder pra escrever um post de LinkedIn em pt-BR. Dado o TEMA, devolva JSON puro com EXATAMENTE 3 perguntas curtas e específicas que extraiam matéria-prima REAL que só o líder tem.

As 3 perguntas seguem este mix:
1. FATO/NÚMERO: pergunta que extrai um número, data ou medida real da experiência dele ("Quanto custou?", "Em quanto tempo?", "Quantas pessoas?").
2. CENA/HISTÓRIA: pergunta que extrai um momento específico vivido ("Qual foi a conversa/reunião em que isso ficou claro?", "O que você viu acontecer de perto?").
3. OPINIÃO/APOSTA: pergunta que extrai a posição dele ("O que o mercado erra sobre isso?", "Qual sua aposta impopular aqui?").

Regras:
- Perguntas de NO MÁXIMO 20 palavras, diretas, em pt-BR coloquial.
- Específicas ao TEMA (não genéricas tipo "conte uma história").
- Respondíveis em 1-3 frases por áudio/texto rápido.

Schema: { "questions": ["string", "string", "string"] }`;

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }

  const context = await loadLeaderContext(user.id);
  const leaderLine = context
    ? `O líder: ${context.leader.full_name}, ${context.leader.role} em ${context.leader.area}. Pilares: ${context.leader.themes.join(", ")}.`
    : "";

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${leaderLine}\n\nTEMA do post: ${parsed.data.topic}\n\nDevolva as 3 perguntas em JSON.`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    let questions: string[] = [];
    try {
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
      questions = Array.isArray(json.questions)
        ? json.questions.map(String).slice(0, 3)
        : [];
    } catch {
      questions = [];
    }

    if (questions.length !== 3) {
      return NextResponse.json(
        { error: "Não consegui montar as perguntas. Tenta de novo." },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "interview_failed" },
      { status: 500 }
    );
  }
}
