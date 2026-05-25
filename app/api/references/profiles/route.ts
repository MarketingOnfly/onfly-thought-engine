import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { referenceProfileSchema } from "@/lib/validation";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reference_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = referenceProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reference_profiles")
    .insert({ user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
