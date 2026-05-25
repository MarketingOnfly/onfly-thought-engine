import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  content: z.string().min(10).optional(),
  kind: z.string().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_documents")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("org_documents").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
