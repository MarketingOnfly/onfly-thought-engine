import { redirect } from "next/navigation";
import { createSupabaseServerClient, getServerUser, isAdminEmail } from "@/lib/supabase/server";
import { NotificationBell } from "@/components/notification-bell";
import { DashboardSidebar, MobileNav } from "@/components/dashboard-sidebar";
import { CommandPalette } from "@/components/command-palette";

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
    .select("full_name, role, onboarding_completed, avatar_url")
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

  const slim = {
    full_name: profile.full_name,
    role: profile.role,
    avatar_url: profile.avatar_url,
  };

  return (
    <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
      <DashboardSidebar profile={slim} isAdmin={isAdmin} />

      <main className="min-w-0">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-md md:justify-end md:px-6">
          <MobileNav profile={slim} isAdmin={isAdmin} />
          <NotificationBell />
        </div>
        {children}
      </main>

      {/* Cmd+K command palette — fica disponível em qualquer página de /dashboard */}
      <CommandPalette />
    </div>
  );
}
