import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { publishPost } from "@/lib/linkedin/client";

export const maxDuration = 30;
export const runtime = "nodejs";

/**
 * POST /api/content/[id]/publish — publica o draft no LinkedIn em
 * tempo real usando o token OAuth do próprio usuário.
 *
 * Requer:
 *  - conexão LinkedIn ativa (linkedin_connections existe e token válido)
 *  - draft.draft_markdown ou final_markdown não vazio
 *  - format === "linkedin_post" (artigos requerem outro endpoint, fora de escopo)
 *
 * Marca o draft com published_at + linkedin_post_urn + linkedin_post_url.
 * Não muda o status — o líder pode continuar editando, mas o post já foi.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Carrega draft + conexão em paralelo
  const [{ data: draft, error: draftErr }, { data: conn }] = await Promise.all([
    supabase
      .from("content_drafts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("linkedin_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (draftErr || !draft) {
    return NextResponse.json({ error: "Draft não encontrado" }, { status: 404 });
  }
  if (!conn) {
    return NextResponse.json(
      {
        error:
          "LinkedIn não conectado. Vai em Analytics → Conectar LinkedIn primeiro.",
      },
      { status: 412 }
    );
  }
  if (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date()) {
    return NextResponse.json(
      {
        error:
          "Token do LinkedIn expirou. Reconecta sua conta na aba Analytics.",
      },
      { status: 401 }
    );
  }
  if (draft.format !== "linkedin_post") {
    return NextResponse.json(
      {
        error:
          "Por enquanto só publica POSTS. Artigos precisam ir pelo editor nativo do LinkedIn.",
      },
      { status: 400 }
    );
  }
  if (draft.published_at) {
    return NextResponse.json(
      {
        error:
          "Esse draft já foi publicado. Veja o link no editor ou apague o registro de publicação pra publicar de novo.",
      },
      { status: 409 }
    );
  }

  const text = (draft.final_markdown ?? draft.draft_markdown ?? "").trim();
  if (!text || text.length < 10) {
    return NextResponse.json(
      { error: "Texto vazio ou muito curto pra publicar." },
      { status: 400 }
    );
  }
  if (text.length > 3000) {
    return NextResponse.json(
      {
        error:
          "LinkedIn limita posts a 3000 caracteres. Esse texto tem " +
          text.length +
          ". Encurta antes de publicar.",
      },
      { status: 400 }
    );
  }

  try {
    const { urn, url } = await publishPost({
      accessToken: conn.access_token as string,
      linkedinUserId: conn.linkedin_user_id as string,
      text,
    });

    // Se LinkedIn aceitou (200) mas não devolveu URN, o post foi pro ar
    // mas a gente não consegue rastrear. Marcamos como publicado pra
    // EVITAR republicação duplicada e setamos um aviso em publish_error.
    const publishedAt = new Date().toISOString();
    const trackingNote = urn
      ? null
      : "Publicado mas LinkedIn não devolveu o URN do post — não dá pra linkar direto. Confira no seu perfil.";

    const { data: updated, error: updErr } = await supabase
      .from("content_drafts")
      .update({
        published_at: publishedAt,
        linkedin_post_urn: urn,
        linkedin_post_url: url,
        publish_error: trackingNote,
        status: "approved",
        // Grava em ambos os campos pra UI ficar consistente — antes o
        // editor lia draft_markdown enquanto a publicação ia pra
        // final_markdown, desincronizando após publicar.
        final_markdown: text,
        draft_markdown: text,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updErr) {
      // Publicou mas não conseguiu gravar local — devolve sucesso parcial
      return NextResponse.json(
        {
          published: true,
          warning:
            "Publicado no LinkedIn mas falhou ao salvar local: " + updErr.message,
          linkedin_post_url: url,
          linkedin_post_urn: urn,
        },
        { status: 200 }
      );
    }

    // Notifica o sininho — null guard em topic + log de erro em vez
    // de fire-and-forget silencioso
    const topicSnippet = (draft.topic ?? "post").slice(0, 80);
    const { error: notifErr } = await supabase.from("notifications").insert({
      target_user_id: user.id,
      kind: "campaign_ready",
      title: "Post publicado no LinkedIn",
      body: `"${topicSnippet}" tá no ar.`,
      link: url ?? "/dashboard/library",
    });
    if (notifErr) {
      console.error("[publish] failed to create notification", notifErr);
    }

    return NextResponse.json({ draft: updated, url, urn });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha desconhecida";
    await supabase
      .from("content_drafts")
      .update({ publish_error: msg })
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
