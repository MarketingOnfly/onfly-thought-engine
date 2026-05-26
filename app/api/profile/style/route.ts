import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { profileStyleSchema } from "@/lib/validation";

/**
 * Atualização parcial do estilo do líder.
 * Não toca em campos de identidade (nome, cargo, área, LinkedIn, avatar) —
 * isso fica em /api/profile/personal.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = profileStyleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Monta apenas os campos definidos — evita sobrescrever com undefined/null.
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ profile: null });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leader_profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
