"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim().toLowerCase().endsWith("@onfly.com.br")) {
      setErrorMsg("Apenas e-mails @onfly.com.br são permitidos.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirm) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setStatus("loading");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setStatus("success");
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
          <h1 className="font-display text-3xl tracking-tight">Criar conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apenas e-mails @onfly.com.br são aceitos.
          </p>

          {status === "success" ? (
            <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-800">
              <p className="font-medium">Conta criada!</p>
              <p className="mt-1 text-brand-700">
                Você já pode{" "}
                <Link href="/login" className="underline">
                  entrar com seu e-mail e senha
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">E-mail Onfly</Label>
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
                  autoComplete="new-password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {status === "loading" ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="text-foreground hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
