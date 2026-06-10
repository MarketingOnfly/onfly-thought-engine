/**
 * Análise de voz a partir de TEXTOS REAIS do líder.
 *
 * Benchmark (Boldfy CaaS): "a gente gasta as primeiras horas escutando,
 * mapeando termos que ela usa, histórias que ela conta, opiniões que
 * ela defende". Esta função faz essa escuta de forma automática: recebe
 * os voice_samples (textos que o líder MESMO escreveu) e extrai um
 * fingerprint estruturado que vira a descrição SOBERANA da voz no
 * prompt de geração.
 *
 * Diferença pro learned_preferences: learned vem de FEEDBACK sobre
 * textos gerados (sinal indireto). O fingerprint vem de textos que o
 * líder escreveu com a própria mão (sinal direto). Por isso o
 * fingerprint é soberano: quando os dois conflitam, ganha o fingerprint.
 */

import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";

interface VoiceSample {
  title: string;
  body: string;
}

const SYSTEM_PROMPT = `Você é um analista de voz autoral. Recebe textos escritos por UMA pessoa e extrai o fingerprint da escrita dela — o que faz o texto ser DELA e de mais ninguém.

🔒 REGRA ZERO: extraia APENAS o que está nos textos. Não complete com suposições. Se uma dimensão não tem evidência suficiente, escreva "(sem evidência nos textos)".

Devolva JSON puro com:
{
  "fingerprint": "string em pt-BR com EXATAMENTE estas seções, cada uma com 1-4 linhas baseadas em EVIDÊNCIA dos textos:

VOCABULÁRIO-ASSINATURA: palavras e expressões que essa pessoa usa e a maioria não usa (cite 5-12, literais dos textos).
ABERTURAS: como ela começa os textos (padrão real, com 1 exemplo literal curto).
FECHAMENTOS: como ela termina (padrão real, com 1 exemplo literal curto).
RITMO: tamanho típico de frase e parágrafo, uso de quebras, pontuação característica (reticências? dois-pontos? frases de uma palavra?).
PRONOMES E REGISTRO: 'a gente' ou 'nós'? trata o leitor como? formal ou coloquial? usa gíria/contração?
OPINIÕES QUE DEFENDE: 2-5 teses/posições recorrentes nos textos (literais ou parafraseadas de perto).
HISTÓRIAS E REFERÊNCIAS: que tipo de história/exemplo ela puxa (própria empresa? mercado? números? cenas?).
TIQUES E MARCAS: qualquer idiossincrasia repetida (ALLCAPS pontual? pergunta e responde? ironia? auto-correção? emoji?).
O QUE ELA NUNCA FAZ: padrões AUSENTES que seriam esperados (não usa hashtag? não usa bullet? não cita autor?)."
}

Seja CONCRETO e cite trechos literais curtos entre aspas como evidência. Um fingerprint genérico ("escreve de forma direta e autêntica") é INÚTIL — prefira "abre afirmando um fato seco e sem saudação ('O CAC dobrou. Ninguém olhou.')".`;

function tryParse(text: string): { fingerprint?: string } | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export async function analyzeVoice(
  samples: VoiceSample[]
): Promise<string | null> {
  if (!samples.length) return null;

  const corpus = samples
    .slice(0, 12)
    .map(
      (s, i) =>
        `### Texto ${i + 1}: ${s.title}\n"""\n${s.body.slice(0, 4000)}\n"""`
    )
    .join("\n\n");

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Textos escritos pelo líder (analise o conjunto, não cada um isolado):\n\n${corpus}\n\nExtraia o fingerprint da voz.`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");

  const parsed = tryParse(text);
  if (!parsed?.fingerprint) return null;
  return parsed.fingerprint.slice(0, 4000);
}
