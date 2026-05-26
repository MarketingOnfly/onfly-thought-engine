"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      window.location.href = next;
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 font-display text-lg tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          Onfly Thought Engine
        </Link>

        <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="font-display text-3xl tracking-tight">Entrar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use seu e-mail e senha Onfly.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nome@onfly.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2"
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/cadastro" className="text-muted-foreground hover:text-foreground">
              Criar conta
            </Link>
            <Link href="/recuperar-senha" className="text-muted-foreground hover:text-foreground">
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Apenas líderes Onfly têm acesso. Problemas? Fale com o time de marketing.
        </p>
      </div>
    </main>
  );
}
