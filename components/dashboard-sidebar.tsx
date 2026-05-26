"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Sparkles,
  LayoutDashboard,
  FilePenLine,
  Compass,
  Library,
  ShieldCheck,
  LogOut,
  CalendarDays,
  BarChart3,
  User,
  Menu,
} from "lucide-react";
import { initials, cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type Profile = {
  full_name: string;
  role: string | null;
  avatar_url: string | null;
};

interface SidebarProps {
  profile: Profile;
  isAdmin: boolean;
}

type Item = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
};

const PRIMARY: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
  { href: "/dashboard/create", label: "Criar conteúdo", icon: FilePenLine },
  { href: "/dashboard/discover", label: "Descobrir pautas", icon: Compass },
  { href: "/dashboard/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/library", label: "Biblioteca", icon: Library },
];

const SECONDARY: Item[] = [
  {
    href: "/dashboard/profile",
    label: "Perfil e estilo",
    icon: User,
    match: (p) => p.startsWith("/dashboard/profile") || p.startsWith("/dashboard/studio"),
  },
];

function isActive(item: Item, pathname: string) {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardSidebar({ profile, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="hidden border-r border-border bg-card/40 backdrop-blur md:flex md:flex-col">
      <SidebarBody pathname={pathname} profile={profile} isAdmin={isAdmin} />
    </aside>
  );
}

export function MobileNav({ profile, isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Abrir menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navegação</SheetTitle>
        <SidebarBody pathname={pathname} profile={profile} isAdmin={isAdmin} />
      </SheetContent>
    </Sheet>
  );
}

function SidebarBody({
  pathname,
  profile,
  isAdmin,
}: {
  pathname: string;
  profile: Profile;
  isAdmin: boolean;
}) {
  const adminItem: Item | null = isAdmin
    ? { href: "/admin", label: "Admin", icon: ShieldCheck }
    : null;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-6 py-5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-display text-lg tracking-tight">Thought Engine</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
        ))}
        <div className="my-3 border-t border-border/60" />
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item, pathname)} />
        ))}
        {adminItem && (
          <NavLink item={adminItem} active={isActive(adminItem, pathname)} />
        )}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2">
          <Link
            href="/dashboard/profile"
            className="flex min-w-0 flex-1 items-center gap-3"
            title="Editar perfil"
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-9 w-9 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-medium text-white">
                {initials(profile.full_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.role}</p>
            </div>
          </Link>
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
    </div>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4",
          active ? "text-brand-600" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {item.label}
    </Link>
  );
}
