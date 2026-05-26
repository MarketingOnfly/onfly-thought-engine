"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/recuperar-senha/nova-senha`,
      });
      if (error) throw error;
      setStatus("sent");
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
          <h1 className="font-display text-3xl tracking-tight">Recuperar senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>

          {status === "sent" ? (
            <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-800">
              <p className="font-medium">E-mail enviado!</p>
              <p className="mt-1 text-brand-700">
                Confira <span className="font-mono">{email}</span> e clique no link para criar uma nova senha.
              </p>
            </div>
          ) : (
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
                {status === "loading" ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link href="/login" className="text-foreground hover:underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
