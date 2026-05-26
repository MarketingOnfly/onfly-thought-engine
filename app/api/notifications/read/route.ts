import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid" }, { status: 422 });

  const supabase = await createSupabaseServerClient();
  const rows = parsed.data.ids.map((id) => ({
    notification_id: id,
    user_id: user.id,
  }));

  // upsert para idempotência
  const { error } = await supabase
    .from("notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
