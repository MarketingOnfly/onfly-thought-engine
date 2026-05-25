import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leader_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const finishOnboarding = body.finish_onboarding === true;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leader_profiles")
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        ...(finishOnboarding ? { onboarding_completed: true } : {}),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
