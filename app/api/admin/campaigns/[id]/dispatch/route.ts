import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getAnthropic, MODEL } from "@/lib/anthropic/client";
import { loadLeaderContext } from "@/lib/anthropic/context";
import {
  buildContentUserPrompt,
  buildLeaderSystemPrompt,
} from "@/lib/anthropic/prompts";
import type { Campaign, ContentFormat, LeaderProfile } from "@/lib/db/types";

export const maxDuration = 300; // up to 5 min on Vercel Pro; locally unbounded.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: campaignData, error: campaignErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (campaignErr || !campaignData) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }
  const campaign = campaignData as Campaign;

  // Find every leader who finished onboarding (precisamos de role+area pra targeting).
  const { data: leadersData, error: leadersErr } = await supabase
    .from("leader_profiles")
    .select("user_id, full_name, role, area")
    .eq("onboarding_completed", true);
  if (leadersErr) {
    return NextResponse.json({ error: leadersErr.message }, { status: 500 });
  }
  const allLeaders = (leadersData ?? []) as Pick<
    LeaderProfile,
    "user_id" | "full_name" | "role" | "area"
  >[];

  // Aplica audience_filter pra escolher quem recebe.
  const filter = (campaign.audience_filter ?? { mode: "all" }) as
    | { mode: "all" }
    | { mode: "specific_users"; user_ids: string[] }
    | { mode: "by_area"; areas: string[] }
    | { mode: "by_role"; roles: string[] };

  const leaders = (() => {
    if (filter.mode === "specific_users") {
      const set = new Set(filter.user_ids);
      return allLeaders.filter((l) => set.has(l.user_id));
    }
    if (filter.mode === "by_area") {
      const set = new Set(filter.areas.map((a) => a.toLowerCase()));
      return allLeaders.filter((l) => set.has((l.area ?? "").toLowerCase()));
    }
    if (filter.mode === "by_role") {
      const set = new Set(filter.roles.map((r) => r.toLowerCase()));
      return allLeaders.filter((l) => set.has((l.role ?? "").toLowerCase()));
    }
    return allLeaders;
  })();

  if (!leaders.length) {
    return NextResponse.json(
      {
        error:
          "Nenhum líder selecionado pelo filtro da campanha. Reveja o público-alvo.",
      },
      { status: 400 }
    );
  }

  // Carrega anexos da campanha — só textuais entram no prompt. Imagens ficam de referência visual no admin.
  const { data: attachmentsData } = await supabase
    .from("campaign_attachments")
    .select("name, content, kind")
    .eq("campaign_id", campaign.id);
  const textAttachments = (attachmentsData ?? []).filter((a) => a.kind !== "image");
  const attachmentsBlob = textAttachments.length
    ? textAttachments
        .map(
          (a) => `### ANEXO (${a.kind}): ${a.name}\n${a.content.slice(0, 4000)}`
        )
        .join("\n\n---\n\n")
    : "";

  // Mark dispatching
  await supabase
    .from("campaigns")
    .update({ status: "dispatching", dispatched_at: new Date().toISOString() })
    .eq("id", id);

  // Pre-create placeholder campaign_drafts (pending) for visibility.
  // Limpa error_message + draft_id pra dispatches anteriores que falharam
  // virem do zero. Batch upsert pra evitar N round-trips.
  await supabase.from("campaign_drafts").upsert(
    leaders.map((leader) => ({
      campaign_id: campaign.id,
      user_id: leader.user_id,
      status: "pending" as const,
      error_message: null,
      draft_id: null,
    })),
    { onConflict: "campaign_id,user_id" }
  );

  const anthropic = getAnthropic();
  const results: { leader_id: string; status: string; error?: string }[] = [];

  // Paraleliza em chunks de 4 — Anthropic Sonnet aguenta esse fan-out
  // tranquilo, e mantém o dispatch dentro do maxDuration=300s mesmo
  // com 20-30 líderes. Sem isso o loop serial estourava no Vercel.
  const CHUNK_SIZE = 4;
  const chunks: typeof leaders[] = [];
  for (let i = 0; i < leaders.length; i += CHUNK_SIZE) {
    chunks.push(leaders.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map((leader) => dispatchOneLeader(leader))
    );
    chunkResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        results.push({
          leader_id: chunk[i].user_id,
          status: "failed",
          error: r.reason instanceof Error ? r.reason.message : "unknown",
        });
      }
    });
  }

  // Função interna que processa 1 líder — mantém o mesmo escopo de
  // variáveis (supabase, anthropic, campaign, etc.).
  async function dispatchOneLeader(
    leader: Pick<LeaderProfile, "user_id" | "full_name" | "role" | "area">
  ): Promise<{ leader_id: string; status: string; error?: string }> {
    try {
      await supabase
        .from("campaign_drafts")
        .update({ status: "generating" })
        .eq("campaign_id", campaign.id)
        .eq("user_id", leader.user_id);

      const ctx = await loadLeaderContext(leader.user_id);
      if (!ctx) {
        await supabase
          .from("campaign_drafts")
          .update({ status: "failed", error_message: "leader profile missing" })
          .eq("campaign_id", campaign.id)
          .eq("user_id", leader.user_id);
        return {
          leader_id: leader.user_id,
          status: "failed",
          error: "profile missing",
        };
      }

      const system = buildLeaderSystemPrompt(ctx);
      const briefWithAttachments =
        [
          campaign.brief ?? "",
          attachmentsBlob
            ? `\n\nMATERIAL DE APOIO DA CAMPANHA (referência factual; não copie texto cru, use como base):\n${attachmentsBlob}`
            : "",
        ]
          .filter(Boolean)
          .join("")
          .trim() || null;

      const userPrompt = buildContentUserPrompt({
        format: campaign.format as ContentFormat,
        topic: campaign.theme,
        brief: briefWithAttachments,
        extraInstructions:
          "Esta é uma pauta vinda do time de marketing da Onfly — você está produzindo seu ângulo autoral sobre o tema. Não pode soar como release; precisa ter SUA opinião e voz característica. Se a pauta não combinar com seu posicionamento, ajuste o ângulo pra fazer sentido com sua autoridade.",
      });

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: campaign.format === "linkedin_post" ? 2000 : 6000,
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

      // Build scheduled_at from campaign.target_publish_date (10am SP local)
      const scheduledAt = campaign.target_publish_date
        ? new Date(`${campaign.target_publish_date}T10:00:00-03:00`).toISOString()
        : null;

      // Insert draft for that leader
      const { data: draftData, error: draftErr } = await supabase
        .from("content_drafts")
        .insert({
          user_id: leader.user_id,
          format: campaign.format,
          topic: campaign.theme,
          brief: campaign.brief ?? null,
          scheduled_at: scheduledAt,
          draft_markdown: text,
          status: "draft",
          meta: {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
          },
        })
        .select()
        .single();

      if (draftErr || !draftData) {
        await supabase
          .from("campaign_drafts")
          .update({ status: "failed", error_message: draftErr?.message ?? "insert failed" })
          .eq("campaign_id", campaign.id)
          .eq("user_id", leader.user_id);
        return {
          leader_id: leader.user_id,
          status: "failed",
          error: draftErr?.message ?? "insert",
        };
      }

      await supabase
        .from("campaign_drafts")
        .update({ status: "ready", draft_id: draftData.id, error_message: null })
        .eq("campaign_id", campaign.id)
        .eq("user_id", leader.user_id);

      // Notifica o líder no sininho
      await supabase.from("notifications").insert({
        target_user_id: leader.user_id,
        kind: "campaign_ready",
        title: `Nova campanha: ${campaign.name}`,
        body: `Seu draft personalizado sobre "${campaign.theme.slice(0, 80)}" tá pronto pra revisar.`,
        link: `/dashboard/content/${draftData.id}`,
      });

      return { leader_id: leader.user_id, status: "ready" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      await supabase
        .from("campaign_drafts")
        .update({ status: "failed", error_message: msg })
        .eq("campaign_id", campaign.id)
        .eq("user_id", leader.user_id);
      return { leader_id: leader.user_id, status: "failed", error: msg };
    }
  }

  const anyFailed = results.some((r) => r.status === "failed");
  const allFailed = results.every((r) => r.status === "failed");

  await supabase
    .from("campaigns")
    .update({
      status: allFailed ? "failed" : "sent",
    })
    .eq("id", campaign.id);

  return NextResponse.json({
    campaign_id: campaign.id,
    total: leaders.length,
    ready: results.filter((r) => r.status === "ready").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
    has_failures: anyFailed,
  });
}
