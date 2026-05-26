"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client-fetch";
import { useConfirm } from "@/components/confirm";
import { initials, formatDate, cn } from "@/lib/utils";

interface AdminRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  invited_email: string | null;
  added_by: string | null;
  created_at: string;
  is_env_pinned: boolean;
}

export default function AdminsPanel({ currentUserId }: { currentUserId: string }) {
  const [items, setItems] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/org-admins");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Falha ao carregar admins.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ item: AdminRow }>("/api/admin/org-admins", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setItems([...items, res.data.item]);
        setEmail("");
        setOpen(false);
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: AdminRow) {
    const ok = await confirm({
      title: "Remover este admin?",
      description: `${row.full_name ?? row.email} perde acesso ao painel admin imediatamente.`,
      destructive: true,
      confirmText: "Remover",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/org-admins/${row.user_id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setItems(items.filter((x) => x.user_id !== row.user_id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Falha ao remover.");
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <h2 className="font-display text-xl tracking-tight">
                Admins do painel
              </h2>
            </div>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Quem aparece aqui tem acesso a campanhas, guidelines, avisos,
              líderes e Analytics globais. O usuário precisa ter feito login na
              ferramenta antes de virar admin.
            </p>
          </div>
          {!open && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <UserPlus className="h-4 w-4" /> Novo admin
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
            <Label>Email do novo admin</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@onfly.com.br"
                className="flex-1 min-w-[260px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void add();
                  }
                }}
              />
              <Button
                variant="primary"
                onClick={add}
                disabled={busy || email.trim().length < 5}
              >
                {busy ? "Adicionando…" : "Adicionar"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEmail("");
                  setError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              A pessoa precisa ter logado pelo menos uma vez antes de virar
              admin. Se ela ainda não logou, peça pra ela entrar e tenta de
              novo.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando admins…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Nenhum admin cadastrado ainda. Estranho — você deveria estar nessa
          lista.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={it.user_id || `${it.email}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    it.user_id
                      ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white"
                      : "border border-dashed border-border bg-secondary text-muted-foreground"
                  )}
                >
                  {it.user_id ? (
                    initials(it.full_name ?? it.email ?? "?")
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">
                      {it.full_name ?? it.email ?? it.invited_email}
                    </p>
                    {it.user_id === currentUserId && (
                      <Badge variant="brand" className="text-[10px]">
                        você
                      </Badge>
                    )}
                    {it.is_env_pinned && (
                      <Badge
                        variant="outline"
                        className="inline-flex items-center gap-1 text-[10px]"
                        title="Admin fixado via ADMIN_EMAILS. Pra mexer, alterar variável de ambiente."
                      >
                        <Lock className="h-3 w-3" /> fixo via env
                      </Badge>
                    )}
                    {!it.user_id && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground"
                        title="Esse email está na lista de admins mas o usuário ainda não fez login na ferramenta."
                      >
                        aguardando login
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.email ?? it.invited_email}
                    {it.created_at && ` · adicionado em ${formatDate(it.created_at)}`}
                  </p>
                </div>
              </div>
              {it.user_id &&
                it.user_id !== currentUserId &&
                !it.is_env_pinned && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(it)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
