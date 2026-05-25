import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient, getServerUser, isAdminEmail } from "@/lib/supabase/server";
import { Sparkles, LayoutDashboard, FilePenLine, Compass, Library, ShieldCheck, LogOut } from "lucide-react";
import { initials } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("leader_profiles")
    .select("full_name, role, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  let isAdmin = isAdminEmail(user.email);
  if (!isAdmin) {
    const { data: adm } = await supabase
      .from("org_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = !!adm;
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-border bg-card/40 backdrop-blur md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-border px-6 py-5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg tracking-tight">Thought Engine</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          <NavItem href="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
          <NavItem href="/dashboard/create" icon={FilePenLine}>Criar conteúdo</NavItem>
          <NavItem href="/dashboard/discover" icon={Compass}>Descobrir pautas</NavItem>
          <NavItem href="/dashboard/library" icon={Library}>Biblioteca</NavItem>
          {isAdmin && (
            <NavItem href="/admin" icon={ShieldCheck}>Admin</NavItem>
          )}
        </nav>

        <div className="border-t border-border px-3 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-medium text-white">
              {initials(profile.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.role}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                className="rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                type="submit"
                aria-label="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-4 w-4" /> {children}
    </Link>
  );
}
