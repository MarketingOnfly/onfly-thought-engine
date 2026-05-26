import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";

const metricSchema = z.object({
  content_draft_id: z.string().uuid().optional().nullable(),
  linkedin_post_url: z.string().url().optional().nullable(),
  linkedin_post_urn: z.string().optional().nullable(),
  posted_at: z.string().datetime().optional().nullable(),
  impressions: z.number().int().nonnegative().default(0),
  likes: z.number().int().nonnegative().default(0),
  comments: z.number().int().nonnegative().default(0),
  reposts: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  source: z.enum(["manual", "csv", "linkedin_api"]).default("manual"),
});

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("post_metrics")
    .select("*, content_draft:content_drafts(id, topic, tags, format)")
    .eq("user_id", user.id)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .order("fetched_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = metricSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 422 });

  const data = parsed.data;
  const engagement =
    data.impressions > 0
      ? Number(
          (
            (data.likes + data.comments + data.reposts + data.clicks) /
            data.impressions
          ).toFixed(4)
        )
      : null;

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("post_metrics")
    .insert({
      user_id: user.id,
      ...data,
      engagement_rate: engagement,
      fetched_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: row });
}
