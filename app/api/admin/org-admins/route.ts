import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseAdminClient,
  getServerUser,
  isAdminEmail,
} from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

interface AdminRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  invited_email: string | null;
  added_by: string | null;
  created_at: string;
  /** True quando o admin está fixo via env (ADMIN_EMAILS) — não pode ser removido pela UI. */
  is_env_pinned: boolean;
}

/**
 * Lista os admins: junta org_admins + auth.users (email) + leader_profiles (nome).
 * Inclui também emails do ADMIN_EMAILS que ainda não fizeram login (mostrados
 * com user_id null, pra dar visibilidade).
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "service role missing" },
      { status: 500 }
    );
  }

  // 1. Admins do banco
  const { data: rows, error } = await admin
    .from("org_admins")
    .select("user_id, invited_email, added_by, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Pra cada um, busca email atual + nome
  const items: AdminRow[] = [];
  for (const r of rows ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(r.user_id);
    const { data: p } = await admin
      .from("leader_profiles")
      .select("full_name")
      .eq("user_id", r.user_id)
      .maybeSingle();
    items.push({
      user_id: r.user_id,
      email: u?.user?.email ?? null,
      full_name: p?.full_name ?? null,
      invited_email: r.invited_email,
      added_by: r.added_by,
      created_at: r.created_at,
      is_env_pinned: isAdminEmail(u?.user?.email ?? r.invited_email ?? ""),
    });
  }

  // 3. Emails do env que ainda não estão na tabela
  const envEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const knownEmails = new Set(items.map((i) => i.email?.toLowerCase() ?? ""));
  for (const email of envEmails) {
    if (knownEmails.has(email)) continue;
    items.push({
      user_id: "",
      email,
      full_name: null,
      invited_email: email,
      added_by: null,
      created_at: "",
      is_env_pinned: true,
    });
  }

  return NextResponse.json({ items });
}

/**
 * Adiciona um novo admin pelo email. O usuário precisa já ter feito login
 * pelo menos uma vez (pra existir em auth.users).
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(user)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  const email = emailRaw.toLowerCase();

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "service role missing" },
      { status: 500 }
    );
  }

  // Procura o user em auth.users. listUsers traz só os primeiros 1000 —
  // suficiente pra um time interno.
  const { data: usersData, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const target = usersData?.users.find(
    (u) => u.email?.toLowerCase() === email
  );
  if (!target) {
    return NextResponse.json(
      {
        error:
          "Esse email ainda não fez login na ferramenta. Peça pra essa pessoa entrar uma vez (mesmo sem onboarding) e tenta de novo.",
      },
      { status: 404 }
    );
  }

  // Já é admin?
  const { data: existing } = await admin
    .from("org_admins")
    .select("user_id")
    .eq("user_id", target.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Esse usuário já é admin." }, { status: 409 });
  }

  const { data: inserted, error: insErr } = await admin
    .from("org_admins")
    .insert({
      user_id: target.id,
      added_by: user.id,
      invited_email: email,
    })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Pega nome do perfil pra retornar
  const { data: profile } = await admin
    .from("leader_profiles")
    .select("full_name")
    .eq("user_id", target.id)
    .maybeSingle();

  return NextResponse.json({
    item: {
      user_id: target.id,
      email: target.email,
      full_name: profile?.full_name ?? null,
      invited_email: email,
      added_by: user.id,
      created_at: inserted.created_at,
      is_env_pinned: isAdminEmail(target.email ?? ""),
    },
  });
}
