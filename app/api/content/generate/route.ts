import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { getAnthropic, FAST_MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildLeaderSystemPrompt,
  buildContentUserPrompt,
} from "@/lib/anthropic/prompts";
import { generateContentSchema } from "@/lib/validation";
import { CONTENT_LENGTHS, MOOD_VARIATIONS } from "@/lib/style-presets";
import {
  planContent,
  planAsPromptContext,
  planAsPromptContextForStrategy,
} from "@/lib/anthropic/plan-content";
import {
  polishPass,
  applyHardRules,
  detectFabricatedTokens,
} from "@/lib/anthropic/polish-pass";
import { getFewShotExamples } from "@/lib/anthropic/few-shot";
import { reviewText } from "@/lib/anthropic/review";
import { selfRepair } from "@/lib/anthropic/self-repair";
import type { AltVersion, LeaderProfile } from "@/lib/db/types";

export const maxDuration = 180;

/**
 * Pipeline de geração (cada chamada faz):
 *  1. PLAN (Opus) — Sênior editor pensa estrutura, tensão, fato, mood.
 *  2. DRAFT (Sonnet) — Executor escreve seguindo o plano + few-shot.
 *  3. POLISH (Sonnet) — Anti-clichê + cut 20% + sensorial check.
 *  4. SELF-CRITIQUE (Sonnet) — Roda o MESMO revisor da revisão em tempo
 *     real. Se voice_match < 75 ou issue crítica, faz repair cirúrgico.
 *     Assim o texto que chega no editor já passou pelo mesmo crivo que o
 *     líder usaria manualmente.
 *
 * Pra variações > 1: cada versão usa um MOOD distinto pra dar variação
 * semântica de verdade (não só hook). Pipelines rodam em paralelo.
 */

function pickMoodBiases(
  chosenMood: string | null,
  count: number
): (string | null)[] {
  const all = MOOD_VARIATIONS.map((m) => m.key) as string[];
  const biases: (string | null)[] = [chosenMood];
  if (count <= 1) return biases;
  // Adiciona moods contrastantes
  for (const m of all) {
    if (biases.length >= count) break;
    if (biases.includes(m)) continue;
    biases.push(m);
  }
  return biases.slice(0, count);
}

/**
 * REMOVIDO em 2026-05-28: o pickHookPatterns forçava hook diferente
 * em cada variação A/B/C, sobrescrevendo a escolha do planner. Isso
 * gerava variações B e C artificialmente piores (com hook que o motor
 * próprio considera inferior pra a ideia).
 *
 * Agora todas as variações usam o hook ESCOLHIDO PELO PLANNER. A
 * diferenciação A/B/C vem do MOOD (humor) — best_day vs critical vs
 * reflective. O mesmo hook contado em 3 tons diferentes gera variação
 * semântica REAL sem comprometer qualidade.
 */

function labelForMood(moodKey: string | null): string {
  if (!moodKey) return "humor padrão";
  const m = MOOD_VARIATIONS.find((x) => x.key === moodKey);
  return m?.label.toLowerCase() ?? moodKey;
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = generateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const context = await loadLeaderContext(user.id);
  if (!context) {
    return NextResponse.json(
      { error: "Profile not found. Complete onboarding first." },
      { status: 412 }
    );
  }

  const variations = parsed.data.variations ?? 1;
  const systemPrompt = buildLeaderSystemPrompt(context);

  // ============================================================
  // BARREIRA ANTI-FABRICAÇÃO (REGRA ZERO em código)
  //
  // Caso real do Vini: anexou link substack pedindo "o primeiro erro
  // do texto", motor leu pouco/nada, INVENTOU outro erro plausível.
  // Mesmo com REGRA ZERO no prompt, modelo ainda inventou.
  //
  // Solução cirúrgica: se o líder pediu algo ESPECÍFICO de material
  // ("o primeiro erro mencionado", "o que o autor diz") E o sistema
  // NÃO CONSEGUIU LER o(s) material(is), abortamos ANTES de chamar o
  // LLM. Erro 422 explicando que precisa colar o trecho.
  //
  // Sem essa barreira, o LLM SEMPRE tem o caminho fácil de "fingir
  // que sabe" — porque tem tokens latentes do tema. A única forma de
  // garantir é não deixar ele rodar.
  // ============================================================
  const unreadable = parsed.data.unreadable_sources ?? [];
  const combinedPrompt = [
    parsed.data.topic,
    parsed.data.brief ?? "",
    parsed.data.extra_instructions ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Detecta se o prompt PEDE algo específico do material anexado
  const SPECIFIC_REQUEST_PATTERNS = [
    // ordinal + termo de conteúdo
    /\b(primeir|segund|terceir|quart|quint|sext|sétim|oitav|non|décim)[oa]s?\s+(erro|ponto|item|tópico|exemplo|case|argumento|princíp|líção|aprendizad|capítul|seção|reflex|insight|pergunta|truque|dica|tese|mensagem|fato|dado|frase|trecho|paragraf)/i,
    // referência ao texto/material em si
    /\b(d[oa]|n[oa])\s+(text|link|artig|post|vídeo|video|podcast|matéria|noticia|notícia|reportagem|paper|entrevista|reportagem|episódio|episodio|live|conteúd)/i,
    // palavras de citação
    /\b(mencionad|citad|dit[ao]|comentad|destacad|afirmad)/i,
    // "que o autor / fulano disse"
    /\b(que\s+o\s+(autor|pierre|fulano|ele|ela)\s+(diz|fala|menciona|cita|defende|comenta|destaca|escreve|argumenta))/i,
    // pede pra "comentar sobre" o material
    /\b(comentar?|reagir?|responder?|escrever?)\s+(sobre|d[oa])\s+(text|link|artig|post|vídeo|matéria|esse|aquilo)/i,
  ];
  const requestsSpecificMaterial = SPECIFIC_REQUEST_PATTERNS.some((p) =>
    p.test(combinedPrompt)
  );

  // Se o frontend marcou unreadable mas o líder pediu específico do
  // material, fazemos UMA ÚLTIMA TENTATIVA de ler via Claude+web_search
  // direto aqui (pode ter sido erro temporário no /extract antes).
  // Só bloqueia se ESSA tentativa também falhar.
  let stillUnreadable = unreadable;
  if (unreadable.length > 0 && requestsSpecificMaterial) {
    const { fetchAndComprehendUrl } = await import(
      "@/lib/anthropic/fetch-and-comprehend"
    );
    const recheckResults = await Promise.all(
      unreadable
        .filter((s) => s.url) // só URLs (PDFs corruptos não dá)
        .map(async (s) => {
          try {
            const fc = await fetchAndComprehendUrl({
              url: s.url!,
              hintTitle: s.title,
            });
            return {
              source: s,
              ok:
                !fc.comprehension.comprehension_failed &&
                fc.comprehension.key_facts.length > 0,
              comprehension: fc.comprehension,
            };
          } catch {
            return { source: s, ok: false, comprehension: null };
          }
        })
    );

    // Os que ainda falharam continuam unreadable. Os que agora deram certo
    // VIRAM key_facts adicionais pra must_cite_facts no resto do pipeline.
    stillUnreadable = recheckResults
      .filter((r) => !r.ok)
      .map((r) => r.source);
    const recoveredFacts = recheckResults
      .filter((r) => r.ok && r.comprehension)
      .flatMap((r) => r.comprehension!.key_facts);

    if (recoveredFacts.length > 0) {
      // Injeta no must_cite_facts pra o pipeline usar
      const existingFacts = parsed.data.must_cite_facts ?? [];
      parsed.data.must_cite_facts = [...existingFacts, ...recoveredFacts].slice(
        0,
        20
      );
    }
  }

  if (stillUnreadable.length > 0 && requestsSpecificMaterial) {
    const sourceList = stillUnreadable
      .map((s) => `• ${s.title}${s.url ? ` (${s.url})` : ""}`)
      .join("\n");
    return NextResponse.json(
      {
        error: `Você pediu algo específico do material anexado (ex: "o primeiro erro mencionado"), mas o sistema NÃO conseguiu ler o conteúdo nem com a busca direta do Claude. Materiais com leitura falhada:\n\n${sourceList}\n\nGeralmente é paywall completo (Substack/Medium pago), site privado, ou link 404. Pra evitar que o motor invente conteúdo: cole o TRECHO ESPECÍFICO que você quer usar (ex: o primeiro erro do texto) no campo "Ideia" ou "Briefing" e refaz.`,
        kind: "unreadable_material_specific_request",
        unreadable_sources: stillUnreadable,
      },
      { status: 422 }
    );
  }

  const lengthPreset = parsed.data.length
    ? CONTENT_LENGTHS.find((l) => l.key === parsed.data.length)
    : null;
  const maxTokens = lengthPreset
    ? parsed.data.format === "linkedin_post"
      ? lengthPreset.maxTokensPost
      : lengthPreset.maxTokensArticle
    : parsed.data.format === "linkedin_post"
      ? 1400
      : 4000;

  const supabase = await createSupabaseServerClient();

  const insertRes = await supabase
    .from("content_drafts")
    .insert({
      user_id: user.id,
      format: parsed.data.format,
      topic: parsed.data.topic,
      brief: parsed.data.brief ?? null,
      status: "draft",
      meta: {
        extra_instructions: parsed.data.extra_instructions ?? null,
        length: parsed.data.length ?? null,
        tone_override: parsed.data.tone_override ?? null,
        hook_style: parsed.data.hook_style ?? null,
        objective: parsed.data.objective ?? null,
        content_type: parsed.data.content_type ?? null,
        mood: parsed.data.mood ?? null,
        variations,
        pipeline: "plan_draft_polish_critique_v2",
      },
    })
    .select()
    .single();

  if (insertRes.error || !insertRes.data) {
    return NextResponse.json(
      { error: insertRes.error?.message ?? "DB error" },
      { status: 500 }
    );
  }

  const draftId = insertRes.data.id;
  // moodBiases é fallback se o planner não devolver variation_strategies.
  // Quando ele devolve, usamos a estratégia completa (framework+mood) por variação.
  const moodBiasesFallback = pickMoodBiases(parsed.data.mood ?? null, variations);

  try {
    // ============================================================
    // FASE 1 — PLAN (Opus, 1 chamada compartilhada por todas variações)
    //
    // O planner também ESCOLHE o melhor hook_style e content_type
    // baseado na ideia. Se o líder forçou um valor no formulário,
    // a escolha do líder tem precedência (é o que ele quis). Se o
    // líder deixou em branco (default = automático), usamos a
    // recomendação do planner.
    // ============================================================
    const plan = await planContent({
      format: parsed.data.format,
      topic: parsed.data.topic,
      brief: parsed.data.brief ?? null,
      leader: context.leader as LeaderProfile,
    });

    const effectiveHookStyle =
      parsed.data.hook_style ?? plan.recommended_hook_style ?? null;
    const effectiveContentType =
      parsed.data.content_type ?? plan.recommended_content_type ?? null;

    // Monta a lista de estratégias por variação. Se o planner devolveu
    // variation_strategies, usa elas (3 frameworks DISTINTOS com moods
    // específicos). Senão, usa moodBiasesFallback + framework principal.
    const variationPlans =
      plan.variation_strategies && plan.variation_strategies.length >= variations
        ? plan.variation_strategies
            .slice(0, variations)
            .map((s) => ({ moodKey: s.mood, strategy: s }))
        : moodBiasesFallback.map((m) => ({
            moodKey: m,
            strategy: {
              framework: plan.narrative_framework ?? "story_arc",
              mood: m ?? "best_day",
              rationale: "fallback (planner não devolveu variation_strategies)",
            },
          }));

    // ============================================================
    // FASE 2 — DRAFT (Sonnet, N paralelas com mood distinto)
    //          + opcional web_search se fact_check=true
    // ============================================================
    const fewShot = await getFewShotExamples({
      userId: user.id,
      format: parsed.data.format,
      excludeId: draftId,
    });

    // Se o líder anexou material que o comprehend-link FALHOU em ler
    // (substack com paywall, cloudflare, PDF corrompido), ativamos
    // web_search automaticamente E injetamos instrução EXPLÍCITA pro
    // modelo NÃO INVENTAR conteúdo do material. Sem isso, o modelo
    // gera prosa genérica fingindo que leu o link.
    const unreadableSources = parsed.data.unreadable_sources ?? [];
    const hasUnreadableSources = unreadableSources.length > 0;
    const unreadableHint = hasUnreadableSources
      ? `\n\n🚨 ATENÇÃO CRÍTICA — MATERIAIS NÃO ACESSADOS:
O líder anexou ${unreadableSources.length} material(is) que o sistema NÃO conseguiu ler (paywall, anti-bot, PDF corrompido):
${unreadableSources.map((s, i) => `  ${i + 1}. ${s.title}${s.url ? ` (${s.url})` : ""}`).join("\n")}

REGRAS DURAS:
1. NUNCA INVENTE o conteúdo desses materiais. Não escreva sobre o que você ACHA que está neles.
2. USE A FERRAMENTA web_search pra buscar o material pelo título ou URL. Tente extrair o conteúdo real.
3. Se a busca falhar OU se o líder pediu algo específico do material que você não consegue verificar (ex: "o primeiro erro mencionado", "o que o autor diz sobre X"), DEVOLVA APENAS ESTA FRASE:
   "Não consegui acessar o material que você anexou (paywall/anti-bot). Cola o trecho específico do que você quer usar no campo de ideia e refaz."
4. Se você buscar e encontrar, CITE EXATAMENTE o que o material diz (com aspas se for citação direta).
5. PROIBIDO gerar prosa genérica sobre o TEMA do material. Se você não tem o conteúdo, você não escreve.

Esse é o pior erro que esse motor pode cometer: fingir que leu o link e inventar. Custa credibilidade do líder. Não faça.`
      : "";

    const anthropic = getAnthropic();
    const calls = variationPlans.map(async ({ moodKey, strategy }) => {
      // Cada variação A/B/C usa uma ESTRATÉGIA distinta:
      //  - framework próprio (vindo do planner que pondera o histórico)
      //  - mood próprio
      // Permite o sistema APRENDER qual estratégia o líder prefere.
      const planContextForThisVariation = planAsPromptContextForStrategy(
        plan,
        strategy
      );

      const baseUserPrompt = buildContentUserPrompt({
        format: parsed.data.format,
        topic: parsed.data.topic,
        brief: parsed.data.brief,
        // Anexa o alerta CRÍTICO de materiais ilegíveis no extra_instructions
        // — aparece bem visível pro modelo, antes das outras instruções
        extraInstructions:
          (unreadableHint ? `${unreadableHint}\n\n` : "") +
          (parsed.data.extra_instructions ?? ""),
        // Usa a escolha do planner quando o líder não forçou
        hookStyle: effectiveHookStyle,
        objective: parsed.data.objective,
        contentType: effectiveContentType,
        length: parsed.data.length ?? null,
        toneOverride: parsed.data.tone_override ?? null,
        mood: moodKey as "best_day" | "critical" | "reflective" | null,
        planContext: planContextForThisVariation,
        fewShot,
      });
      const userPrompt = baseUserPrompt;

      // web_search é ATIVADO automaticamente quando:
      //  - líder marcou fact_check=true, OU
      //  - há materiais ilegíveis (modelo precisa buscar o conteúdo)
      const shouldUseWebSearch = parsed.data.fact_check || hasUnreadableSources;
      const tools = shouldUseWebSearch
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ([
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: hasUnreadableSources ? 4 : 2,
            },
          ] as any)
        : undefined;

      const response = await anthropic.messages.create({
        model: FAST_MODEL, // Sonnet é mais que suficiente — o plano vem do Opus
        max_tokens: maxTokens,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        ...(tools ? { tools } : {}),
        messages: [{ role: "user", content: userPrompt }],
      });

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();

      return { moodKey, raw, strategy };
    });

    // SAFETY NET: aplica applyHardRules JÁ no draft cru. Mesmo que o
    // polish ou self-repair falhem, o em dash não passa. Defesa em
    // profundidade — aplicado em CADA fase do pipeline.
    const drafted = (await Promise.allSettled(calls))
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(
        (
          x
        ): x is {
          moodKey: string | null;
          raw: string;
          strategy: { framework: string; mood: string; rationale: string };
        } => !!x && !!x.raw
      )
      .map((d) => ({ ...d, raw: applyHardRules(d.raw) }));

    if (!drafted.length) throw new Error("Todas as gerações falharam na fase de draft.");

    // ============================================================
    // FASE 3 — POLISH (Sonnet, N paralelas: anti-clichê + cut + sensorial)
    // ============================================================
    const polished = await Promise.allSettled(
      drafted.map((d) =>
        polishPass({
          draft: d.raw,
          format: parsed.data.format,
          notes: `Versão ${labelForMood(d.moodKey)}`,
          // Lista de fatos dos materiais anexados — polish verifica
          // que o draft cita pelo menos um. Sem isso, o modelo
          // "esquece" do material às vezes.
          mustCiteFacts: parsed.data.must_cite_facts ?? undefined,
        })
      )
    );

    const polishedFinal = drafted.map((d, i) => {
      const p = polished[i];
      // SAFETY NET 2: fallback do polish também passa por applyHardRules.
      const text = p.status === "fulfilled" && p.value ? p.value : d.raw;
      // Propaga strategy junto pra ser salva nas alt_versions no fim
      return {
        moodKey: d.moodKey,
        text: applyHardRules(text),
        strategy: d.strategy,
      };
    });

    // ============================================================
    // FASE 4 — SELF-CRITIQUE (review + conditional repair)
    //          Roda o MESMO revisor da revisão em tempo real e, se o
    //          score for ruim, corrige antes de devolver pro líder.
    // ============================================================
    const critiqued = await Promise.allSettled(
      polishedFinal.map(async (v) => {
        try {
          const review = await reviewText({
            userId: user.id,
            text: v.text,
            format: parsed.data.format,
          });
          if (!review) return { ...v, review: null, repaired: false };

          const errorIssues = review.issues.filter(
            (i) => i.severity === "error"
          );
          // Threshold ajustado em 2026-05-28:
          // Antes: voice_match < 75 OU 1+ error → repair (disparava em maioria)
          // Agora: voice_match < 60 OU 2+ errors → repair (só quando ruim de fato)
          // O polish + applyHardRules já limpou o óbvio. Repair que dispara
          // por 1 issue menor reescreve o texto e perde voz boa no caminho.
          const needsRepair =
            review.voice_match_score < 60 || errorIssues.length >= 2;

          if (!needsRepair) return { ...v, review, repaired: false };

          const repaired = await selfRepair({
            draft: v.text,
            format: parsed.data.format,
            issues: review.issues.slice(0, 6),
            voiceNotes: review.voice_notes,
            voiceMatchScore: review.voice_match_score,
          });
          return {
            ...v,
            text: repaired || v.text,
            review,
            repaired: !!repaired && repaired !== v.text,
          };
        } catch {
          return { ...v, review: null, repaired: false };
        }
      })
    );

    // SAFETY NET 3 (FINAL): aplica applyHardRules em CADA versão antes
    // de salvar no banco. Mesmo que o critique/repair tenha reintroduzido
    // qualquer tell, o em dash não chega no editor do líder.
    const beforeFabricationCheck = critiqued
      .map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : {
              ...polishedFinal[i],
              review: null as Awaited<ReturnType<typeof reviewText>>,
              repaired: false,
            }
      )
      .map((v) => ({ ...v, text: applyHardRules(v.text) }));

    // ============================================================
    // FASE 5 (NOVA) — VERIFICAÇÃO ANTI-FABRICAÇÃO
    //
    // Caso real: modelo gerou "três vezes nos últimos dois meses",
    // "200 impressões", "fevereiro desse ano" sem nada disso ter sido
    // input do líder. REGRA ZERO no prompt foi ignorada.
    //
    // Solução determinística: extrai TODOS os tokens específicos do
    // draft (números, datas, nomes próprios) e verifica se aparecem
    // em ALGUMA fonte legítima (topic + brief + extra + must_cite_facts
    // + learned_preferences + tone_examples + docs). Se 2+ tokens
    // suspeitos: regenera UMA vez com instrução EXPLÍCITA de remover.
    // ============================================================
    const fabricationSources = {
      topic: parsed.data.topic,
      brief: parsed.data.brief,
      extra_instructions: parsed.data.extra_instructions,
      must_cite_facts: parsed.data.must_cite_facts ?? undefined,
      learned_preferences: context.leader.learned_preferences,
      tone_examples: context.leader.tone_examples,
      org_docs: (context.orgDocuments ?? [])
        .map((d) => d.content)
        .join("\n"),
      leader_docs: (context.leaderDocuments ?? [])
        .map((d) => d.content)
        .join("\n"),
    };

    type CheckedVersion = (typeof beforeFabricationCheck)[number] & {
      fabrication_fixed?: boolean;
      fabrication_detected?: string[];
    };
    const verifyAndFixFabrication = async (
      v: (typeof beforeFabricationCheck)[number]
    ): Promise<CheckedVersion> => {
      const detection = detectFabricatedTokens(v.text, fabricationSources);
      // Threshold: 2+ tokens suspeitos = sinal forte de fabricação
      if (detection.suspicious.length < 2) return v;

      // Regenera removendo os tokens fabricados
      const fixInstructions = [
        `Reescreva o texto removendo TODOS os tokens fabricados listados abaixo.`,
        `Esses tokens NÃO apareceram em nenhuma fonte de input do líder (topic, brief, materiais anexados, learned_preferences, documentos).`,
        ``,
        `TOKENS FABRICADOS A REMOVER:`,
        ...detection.suspicious.map((t, i) => `  ${i + 1}. "${t}"`),
        ``,
        `COMO REMOVER:`,
        `- Substitua o número específico por linguagem qualitativa ("muito", "a maior parte", "dobrou", "ainda crescia")`,
        `- Substitua a data específica por referência temporal vaga ("recentemente", "nos últimos meses")`,
        `- Substitua o nome próprio inventado por categoria ("um cliente", "uma empresa do setor")`,
        `- Substitua a citação inventada por paráfrase sem aspas`,
        `- OU corte a frase inteira que dependia do token`,
        ``,
        `MANTENHA tudo que NÃO está na lista. Mantenha tese, estrutura, ritmo, voz do líder.`,
        `REGRA ZERO: prefere texto mais curto e verdadeiro a texto longo com invenção.`,
        ``,
        `Devolva APENAS o texto reescrito. Sem preâmbulo, sem explicação.`,
      ].join("\n");

      const userPrompt = `${fixInstructions}\n\nTEXTO ORIGINAL:\n"""\n${v.text}\n"""\n\nReescreva:`;

      try {
        const anthropicLocal = getAnthropic();
        const response = await anthropicLocal.messages.create({
          model: FAST_MODEL,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: userPrompt }],
        });
        const newText = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("\n")
          .trim();
        if (newText && newText.length > 50) {
          return { ...v, text: applyHardRules(newText), fabrication_fixed: true };
        }
      } catch (err) {
        console.error("[fabrication-fix] failed", err);
      }
      return { ...v, fabrication_detected: detection.suspicious };
    };

    const final = await Promise.all(
      beforeFabricationCheck.map((v) => verifyAndFixFabrication(v))
    );

    // ============================================================
    // Salva primary + alt_versions + plan + review no meta
    // ============================================================
    const primary = final[0];
    const alts: AltVersion[] = final.slice(1).map((s, i) => {
      // Tenta puxar a strategy do polishedFinal correspondente (mesmo índice
      // +1 já que primary é index 0). O strategy fica no polishedFinal, não no
      // critiqued (que não propaga).
      const polishedSlot = polishedFinal[i + 1];
      const strategy = polishedSlot?.strategy;
      const frameworkLabel = strategy?.framework
        ? ` · ${strategy.framework}`
        : "";
      return {
        id: crypto.randomUUID(),
        label: `Versão ${String.fromCharCode(66 + i)} — ${labelForMood(s.moodKey)}${frameworkLabel}`,
        body: s.text,
        generated_at: new Date().toISOString(),
        // Salva a estratégia usada — sinal pro aprendizado quando o líder
        // promover essa variação ou der feedback.
        strategy: strategy
          ? {
              framework: strategy.framework,
              mood: strategy.mood,
              hook_style: effectiveHookStyle,
            }
          : undefined,
      };
    });

    // Salva versão A no histórico
    await supabase.from("draft_versions").insert({
      content_draft_id: draftId,
      user_id: user.id,
      body: primary.text,
      reason: `Geração inicial — Versão A (${labelForMood(primary.moodKey)})${
        primary.repaired ? " · auto-revisado" : ""
      }`,
    });

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({
        draft_markdown: primary.text,
        alt_versions: alts,
        meta: {
          ...((insertRes.data.meta as Record<string, unknown>) ?? {}),
          plan,
          review: primary.review ?? null,
          self_repaired: primary.repaired,
          // Trilha de decisão editorial — útil pro líder ver o que o
          // motor escolheu quando ele deixou em automático.
          effective_hook_style: effectiveHookStyle,
          effective_content_type: effectiveContentType,
          hook_chosen_by: parsed.data.hook_style
            ? "leader"
            : plan.recommended_hook_style
              ? "planner"
              : "default",
          content_type_chosen_by: parsed.data.content_type
            ? "leader"
            : plan.recommended_content_type
              ? "planner"
              : "default",
        },
      })
      .eq("id", draftId)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ draft: updated });
  } catch (err) {
    await supabase
      .from("content_drafts")
      .update({
        meta: {
          error: err instanceof Error ? err.message : "generation_failed",
        },
      })
      .eq("id", draftId);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation_failed" },
      { status: 500 }
    );
  }
}
