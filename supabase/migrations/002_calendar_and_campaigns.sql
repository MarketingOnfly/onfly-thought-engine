-- ============================================================
-- Migration 002 — calendar + campaigns + visuals
-- Idempotente.
-- ============================================================

-- 1. Calendar pin
alter table public.content_drafts
  add column if not exists scheduled_at timestamptz;

create index if not exists idx_content_drafts_scheduled
  on public.content_drafts (user_id, scheduled_at)
  where scheduled_at is not null;

-- 2. Campaigns
do $$ begin
  create type public.campaign_status as enum (
    'draft', 'queued', 'dispatching', 'sent', 'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  theme text not null,
  brief text,
  format public.content_format not null default 'linkedin_post',
  status public.campaign_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  notes text
);

alter table public.campaigns enable row level security;

drop policy if exists "campaigns admin all" on public.campaigns;
create policy "campaigns admin all" on public.campaigns
  for all using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

-- 3. Per-leader campaign outputs
do $$ begin
  create type public.campaign_draft_status as enum (
    'pending', 'generating', 'ready', 'failed', 'dismissed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.campaign_drafts (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.content_drafts(id) on delete set null,
  status public.campaign_draft_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

drop trigger if exists trg_campaign_drafts_updated_at on public.campaign_drafts;
create trigger trg_campaign_drafts_updated_at
before update on public.campaign_drafts
for each row execute procedure public.set_updated_at();

create index if not exists idx_campaign_drafts_user
  on public.campaign_drafts(user_id, created_at desc);
create index if not exists idx_campaign_drafts_campaign
  on public.campaign_drafts(campaign_id);

alter table public.campaign_drafts enable row level security;

drop policy if exists "campaign_drafts leader read" on public.campaign_drafts;
create policy "campaign_drafts leader read" on public.campaign_drafts
  for select using (auth.uid() = user_id);

drop policy if exists "campaign_drafts leader update own" on public.campaign_drafts;
create policy "campaign_drafts leader update own" on public.campaign_drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "campaign_drafts admin all" on public.campaign_drafts;
create policy "campaign_drafts admin all" on public.campaign_drafts
  for all using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

-- 4. Visuals
create table if not exists public.content_visuals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.content_drafts(id) on delete cascade,
  kind text not null check (kind in ('mindmap','infographic')),
  payload text not null,
  prompt_used text,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_visuals_draft
  on public.content_visuals(draft_id);

alter table public.content_visuals enable row level security;

drop policy if exists "content_visuals self all" on public.content_visuals;
create policy "content_visuals self all" on public.content_visuals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
