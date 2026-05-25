import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { orgDocumentSchema } from "@/lib/validation";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_documents")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = orgDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 422 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_documents")
    .insert({ ...parsed.data, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
