import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { z } from "zod";

const personalSchema = z.object({
  full_name: z.string().min(2),
  role: z.string().min(2),
  area: z.string().min(2),
  bio: z.string().nullable().optional(),
  linkedin_url: z
    .string()
    .url("URL inválida")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? null : v)),
  twitter_url: z
    .string()
    .url("URL inválida")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? null : v)),
  website_url: z
    .string()
    .url("URL inválida")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? null : v)),
  timezone: z.string().default("America/Sao_Paulo"),
  notification_email: z.boolean().default(true),
  notification_digest: z.enum(["never", "daily", "weekly"]).default("weekly"),
});

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = personalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leader_profiles")
    .update(parsed.data)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
