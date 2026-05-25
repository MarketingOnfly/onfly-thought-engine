-- ============================================================
-- Onfly Thought Engine — Postgres schema (Supabase)
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- helpers
-- ------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- leader_profiles
-- one row per Onfly leader
-- ------------------------------------------------------------

create table if not exists public.leader_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null,
  area text not null,
  linkedin_url text,
  target_audience text not null,
  tone_traits text[] not null default '{}',
  tone_avoid text[] not null default '{}',
  tone_examples text,
  main_objective text not null,
  custom_briefing text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leader_profiles_updated_at on public.leader_profiles;
create trigger trg_leader_profiles_updated_at
before update on public.leader_profiles
for each row execute procedure public.set_updated_at();

alter table public.leader_profiles enable row level security;

drop policy if exists "leader_profiles self read" on public.leader_profiles;
create policy "leader_profiles self read" on public.leader_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "leader_profiles self upsert" on public.leader_profiles;
create policy "leader_profiles self upsert" on public.leader_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "leader_profiles self update" on public.leader_profiles;
create policy "leader_profiles self update" on public.leader_profiles
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- reference_profiles
-- LinkedIn (or other) profiles the leader wants to learn style from
-- ------------------------------------------------------------

create table if not exists public.reference_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  why_relevant text,
  hook_examples text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reference_profiles_user on public.reference_profiles(user_id);

alter table public.reference_profiles enable row level security;

drop policy if exists "reference_profiles self all" on public.reference_profiles;
create policy "reference_profiles self all" on public.reference_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- reference_links
-- substacks, newsletters, blogs, portals — agent will browse these
-- ------------------------------------------------------------

create type public.reference_link_kind as enum (
  'substack', 'newsletter', 'blog', 'portal', 'podcast', 'youtube', 'other'
);

create table if not exists public.reference_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  kind public.reference_link_kind not null default 'blog',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reference_links_user on public.reference_links(user_id);

alter table public.reference_links enable row level security;

drop policy if exists "reference_links self all" on public.reference_links;
create policy "reference_links self all" on public.reference_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- leader_documents
-- arbitrary base content uploaded by the leader (background, cases, data)
-- ------------------------------------------------------------

create table if not exists public.leader_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content text not null,
  kind text not null default 'background',
  created_at timestamptz not null default now()
);

create index if not exists idx_leader_documents_user on public.leader_documents(user_id);

alter table public.leader_documents enable row level security;

drop policy if exists "leader_documents self all" on public.leader_documents;
create policy "leader_documents self all" on public.leader_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- org_documents
-- maintained by admins; injected into every leader's prompts
-- (voice guidelines, narrative pillars, Onfly facts, things to avoid)
-- ------------------------------------------------------------

create table if not exists public.org_documents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  content text not null,
  kind text not null default 'voice_guidelines',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

drop trigger if exists trg_org_documents_updated_at on public.org_documents;
create trigger trg_org_documents_updated_at
before update on public.org_documents
for each row execute procedure public.set_updated_at();

alter table public.org_documents enable row level security;

-- everyone authenticated can READ active org documents (injected into prompts)
drop policy if exists "org_documents authed read" on public.org_documents;
create policy "org_documents authed read" on public.org_documents
  for select using (auth.role() = 'authenticated' and is_active);

-- only org_admins can write
create table if not exists public.org_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.org_admins enable row level security;

drop policy if exists "org_admins self read" on public.org_admins;
create policy "org_admins self read" on public.org_admins
  for select using (auth.uid() = user_id);

drop policy if exists "org_documents admin write" on public.org_documents;
create policy "org_documents admin write" on public.org_documents
  for all using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- content_drafts
-- generated posts and articles
-- ------------------------------------------------------------

create type public.content_format as enum ('linkedin_post', 'article');
create type public.content_status as enum ('draft', 'refining', 'approved');

create table if not exists public.content_drafts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format public.content_format not null,
  topic text not null,
  brief text,
  draft_markdown text,
  final_markdown text,
  status public.content_status not null default 'draft',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_drafts_user on public.content_drafts(user_id, created_at desc);

drop trigger if exists trg_content_drafts_updated_at on public.content_drafts;
create trigger trg_content_drafts_updated_at
before update on public.content_drafts
for each row execute procedure public.set_updated_at();

alter table public.content_drafts enable row level security;

drop policy if exists "content_drafts self all" on public.content_drafts;
create policy "content_drafts self all" on public.content_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- topic_suggestions
-- output of the discovery agent — ranked ideas to write about
-- ------------------------------------------------------------

create type public.topic_status as enum ('new', 'saved', 'dismissed');

create table if not exists public.topic_suggestions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text,
  source_title text,
  title text not null,
  angle text not null,
  why_now text,
  relevance_score int not null default 50,
  status public.topic_status not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_topic_suggestions_user on public.topic_suggestions(user_id, created_at desc);

alter table public.topic_suggestions enable row level security;

drop policy if exists "topic_suggestions self all" on public.topic_suggestions;
create policy "topic_suggestions self all" on public.topic_suggestions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- seed: starter org_documents (idempotent)
-- ------------------------------------------------------------

insert into public.org_documents (name, kind, content)
select
  'Onfly — Voz da Marca',
  'voice_guidelines',
  $$Onfly é a plataforma de gestão de viagens corporativas líder no Brasil.

VOZ:
- Direta, sem floreio, sem "no mundo dinâmico de hoje".
- Cita números quando há números. Conecta argumento a impacto de negócio.
- Tom de operador: explica como funciona na prática, não como funciona em teoria.
- Brasileira, sem traduzir jargão americano cru.

NUNCA:
- "Sinergia", "ecossistema disruptivo", "no fim do dia", "venha conosco".
- Hooks tipo "🚀 3 lições que aprendi em 10 anos".
- Listas-itens sem corpo. Sem dado, sem opinião, sem aposta.
- Soar como AI: paralelismos negativos, três adjetivos em fila, "isto não é X, é Y".

PILARES DE NARRATIVA:
- Eficiência de viagem corporativa como vantagem competitiva, não como custo de back-office.
- Travel como dado: o que a viagem revela sobre a operação.
- Por que sistemas que parecem só "operacionais" definem cultura.
- Bastidor de quem opera (não quem teoriza).

OBJETIVO:
- Construir autoridade pessoal do líder com posição autoral.
- CTA, quando houver, deve ser sutil — convite a continuar a conversa, não pitch.
$$
where not exists (select 1 from public.org_documents);
