-- ============================================================
-- Migration 012 — feedback de conteúdo + retroalimentação + cache de notícias
-- Idempotente.
-- ============================================================

-- 1. Feedback do líder sobre cada conteúdo gerado
create table if not exists public.content_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_draft_id uuid not null references public.content_drafts(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (content_draft_id) -- 1 feedback por draft. Update no lugar de duplicar.
);

create index if not exists idx_content_feedback_user_created
  on public.content_feedback(user_id, created_at desc);

alter table public.content_feedback enable row level security;

drop policy if exists "content_feedback self all" on public.content_feedback;
create policy "content_feedback self all" on public.content_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "content_feedback admin read" on public.content_feedback;
create policy "content_feedback admin read" on public.content_feedback
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );


-- 2. Coluna pra preferências aprendidas (entra no system prompt de cada
-- geração futura — bullets curtos de "gostou de X / pediu evitar Y").
alter table public.leader_profiles
  add column if not exists learned_preferences text;

comment on column public.leader_profiles.learned_preferences is
  'Texto curto (bullets) sintetizado dos feedbacks recentes pelo Claude. Vira contexto do system prompt do líder. Atualizado a cada novo feedback.';


-- 3. Cache de notícias do dia por líder (evita rodar web_search a cada
-- abertura do /descobrir).
create table if not exists public.daily_news_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  fetched_at timestamptz not null default now()
);

alter table public.daily_news_cache enable row level security;

drop policy if exists "daily_news_cache self all" on public.daily_news_cache;
create policy "daily_news_cache self all" on public.daily_news_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
