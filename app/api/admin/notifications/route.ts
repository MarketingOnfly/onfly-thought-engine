import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(2),
  body: z.string().optional().nullable(),
  link: z.string().url().optional().nullable().or(z.literal("")),
  kind: z
    .enum([
      "admin_broadcast",
      "release",
      "best_practice",
      "reminder",
      "metric_alert",
    ])
    .default("admin_broadcast"),
  icon: z.string().optional().nullable(),
  target_user_id: z.string().uuid().optional().nullable(),
});

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 422 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      link: parsed.data.link ? parsed.data.link : null,
      kind: parsed.data.kind,
      icon: parsed.data.icon ?? null,
      target_user_id: parsed.data.target_user_id ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
