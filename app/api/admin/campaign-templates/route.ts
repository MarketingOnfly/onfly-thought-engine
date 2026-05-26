import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaign_templates")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/campaign-templates
 * Body: { name, description?, theme_template, brief_template?, format, category? }
 * Cria um template novo, geralmente derivado de uma campanha bem-sucedida.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const themeTemplate =
    typeof body?.theme_template === "string" ? body.theme_template.trim() : "";
  const briefTemplate =
    typeof body?.brief_template === "string" ? body.brief_template.trim() : null;
  const description =
    typeof body?.description === "string" ? body.description.trim() : null;
  const format =
    body?.format === "article" ? "article" : "linkedin_post";
  const category =
    typeof body?.category === "string" ? body.category.trim() : "saved";

  if (name.length < 2 || themeTemplate.length < 10) {
    return NextResponse.json(
      { error: "name e theme_template são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaign_templates")
    .insert({
      name,
      description,
      theme_template: themeTemplate,
      brief_template: briefTemplate,
      format,
      category,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
