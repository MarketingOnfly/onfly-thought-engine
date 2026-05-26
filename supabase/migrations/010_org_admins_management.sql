-- ============================================================
-- Migration 010 — gestão de admins direto na UI.
-- Adiciona colunas de auditoria e policies de leitura/escrita.
-- Idempotente.
-- ============================================================

-- Garante que a tabela existe (caso o ambiente não tenha rodado o schema base).
create table if not exists public.org_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.org_admins
  add column if not exists added_by uuid references auth.users(id) on delete set null,
  add column if not exists invited_email text;

comment on column public.org_admins.added_by is
  'Admin que adicionou esse user. NULL pra os admins iniciais semeados via ADMIN_EMAILS.';
comment on column public.org_admins.invited_email is
  'Email do admin no momento da adição. Cache pra mostrar na UI sem precisar buscar auth.users.';

alter table public.org_admins enable row level security;

-- "self read" continua: cada admin enxerga ao menos a si mesmo (necessário pra isAdmin()).
drop policy if exists "org_admins self read" on public.org_admins;
create policy "org_admins self read" on public.org_admins
  for select using (auth.uid() = user_id);

-- Writes + leitura cross-row ficam pra service_role: a UI vai sempre via
-- API que usa createSupabaseAdminClient(). Não criamos policy de insert/delete
-- nem de "ver todos" — só service_role passa, anon key não consegue mexer.

-- Função utilitária pra "semear" admins via ADMIN_EMAILS — pode ser chamada
-- pelo backend pra garantir que os admins iniciais existam.
create or replace function public.ensure_admin_for_email(p_email text)
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is null then return; end if;
  insert into public.org_admins (user_id, invited_email)
  values (v_uid, p_email)
  on conflict (user_id) do nothing;
end;
$$;
