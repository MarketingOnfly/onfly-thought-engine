"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Command as CmdIcon,
  Compass,
  FilePenLine,
  LayoutDashboard,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Action {
  label: string;
  hint?: string;
  href: string;
  icon: typeof Search;
  keywords?: string[];
}

const ACTIONS: Action[] = [
  {
    label: "Criar conteúdo",
    hint: "Novo post ou artigo",
    href: "/dashboard/create",
    icon: FilePenLine,
    keywords: ["novo", "post", "artigo", "criar", "escrever"],
  },
  {
    label: "Descobrir pautas",
    hint: "Notícias do dia + ideias",
    href: "/dashboard/discover",
    icon: Compass,
    keywords: ["pauta", "ideia", "noticia", "discover"],
  },
  {
    label: "Calendário",
    hint: "Conteúdos agendados",
    href: "/dashboard/calendar",
    icon: CalendarDays,
    keywords: ["agendar", "data"],
  },
  {
    label: "Analytics",
    hint: "Métricas dos posts",
    href: "/dashboard/analytics",
    icon: BarChart3,
    keywords: ["metricas", "impressoes", "engajamento"],
  },
  {
    label: "Biblioteca",
    hint: "Conteúdos + referências",
    href: "/dashboard/library",
    icon: Library,
    keywords: ["biblioteca", "drafts", "referencias"],
  },
  {
    label: "Perfil e estilo",
    hint: "Tom, hooks, temas",
    href: "/dashboard/profile",
    icon: User,
    keywords: ["perfil", "tom", "estilo", "calibrar"],
  },
  {
    label: "Dashboard",
    hint: "Visão geral",
    href: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["home", "inicio"],
  },
  {
    label: "Admin",
    hint: "Campanhas, líderes, guidelines",
    href: "/admin",
    icon: ShieldCheck,
    keywords: ["admin", "campanha", "lider", "guideline"],
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Cmd+K / Ctrl+K abre. ESC fecha (Dialog já trata).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      // "n" quando nada está focado abre o create
      if (
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key === "n" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !(document.activeElement as HTMLElement | null)?.isContentEditable
      ) {
        e.preventDefault();
        router.push("/dashboard/create");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const nq = normalize(query);
  const filtered = nq
    ? ACTIONS.filter((a) => {
        const hay = normalize(
          [a.label, a.hint, ...(a.keywords ?? [])].filter(Boolean).join(" ")
        );
        return hay.includes(nq);
      })
    : ACTIONS;

  function pick(action: Action) {
    setOpen(false);
    setQuery("");
    router.push(action.href);
  }

  return (
    <>
      {/* Floating button discreto no canto, só visível em desktop */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur transition hover:bg-secondary md:inline-flex"
        title="Abrir paleta de comandos (Cmd+K)"
      >
        <CmdIcon className="h-3.5 w-3.5" />
        <span>K</span>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-[15%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-border bg-background shadow-2xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95"
            )}
          >
            <DialogPrimitive.Title className="sr-only">
              Paleta de comandos
            </DialogPrimitive.Title>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter" && filtered[activeIndex]) {
                    e.preventDefault();
                    pick(filtered[activeIndex]);
                  }
                }}
                placeholder="Pra onde vai? Ex: criar, analytics, perfil…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-block">
                Esc
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Nada encontrado.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {filtered.map((a, i) => {
                    const Icon = a.icon;
                    const active = i === activeIndex;
                    return (
                      <li key={a.href}>
                        <button
                          type="button"
                          onClick={() => pick(a)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                            active
                              ? "bg-brand-50 text-brand-700"
                              : "text-foreground hover:bg-secondary"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {a.label}
                            </p>
                            {a.hint && (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {a.hint}
                              </p>
                            )}
                          </div>
                          {active && (
                            <Sparkles className="h-3 w-3 text-brand-600" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
              <kbd className="rounded border border-border px-1">↑↓</kbd> navegar ·{" "}
              <kbd className="rounded border border-border px-1">Enter</kbd>{" "}
              abrir ·{" "}
              <kbd className="rounded border border-border px-1">N</kbd> novo
              conteúdo
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
