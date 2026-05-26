import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [campaignRes, draftsRes] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("campaign_drafts")
      .select("*, content_draft:content_drafts(id,topic,status,draft_markdown,created_at)")
      .eq("campaign_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (campaignRes.error || !campaignRes.data)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    campaign: campaignRes.data,
    drafts: draftsRes.data ?? [],
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
