import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["new", "saved", "dismissed"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("topic_suggestions")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ idea: data });
}
