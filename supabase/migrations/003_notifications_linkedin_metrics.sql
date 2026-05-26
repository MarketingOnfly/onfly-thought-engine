-- ============================================================
-- Migration 003 — notifications, LinkedIn integration, post metrics,
-- content tags, campaign attachments + templates
--
-- Idempotente — pode rodar várias vezes sem efeito colateral.
-- ============================================================

-- 1. NOTIFICATIONS
do $$ begin
  create type public.notification_kind as enum (
    'campaign_ready', 'campaign_failed', 'admin_broadcast',
    'release', 'best_practice', 'reminder', 'metric_alert'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  target_user_id uuid references auth.users(id) on delete cascade,
  kind public.notification_kind not null default 'admin_broadcast',
  title text not null,
  body text,
  link text,
  icon text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_target
  on public.notifications(target_user_id, created_at desc);
create index if not exists idx_notifications_broadcast
  on public.notifications(created_at desc) where target_user_id is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications self read" on public.notifications;
create policy "notifications self read" on public.notifications
  for select using (target_user_id is null or target_user_id = auth.uid());

drop policy if exists "notifications admin write" on public.notifications;
create policy "notifications admin write" on public.notifications
  for all using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.notification_reads enable row level security;

drop policy if exists "notification_reads self all" on public.notification_reads;
create policy "notification_reads self all" on public.notification_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 2. LINKEDIN
create table if not exists public.linkedin_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  linkedin_user_id text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz not null,
  scope text,
  profile_data jsonb not null default '{}',
  linkedin_url text,
  followers_count int,
  last_synced_at timestamptz,
  marketing_api_status text not null default 'not_requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_linkedin_updated_at on public.linkedin_connections;
create trigger trg_linkedin_updated_at
before update on public.linkedin_connections
for each row execute procedure public.set_updated_at();

alter table public.linkedin_connections enable row level security;

drop policy if exists "linkedin self all" on public.linkedin_connections;
create policy "linkedin self all" on public.linkedin_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "linkedin admin read" on public.linkedin_connections;
create policy "linkedin admin read" on public.linkedin_connections
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );


-- 3. POST METRICS
create table if not exists public.post_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_draft_id uuid references public.content_drafts(id) on delete set null,
  linkedin_post_urn text,
  linkedin_post_url text,
  posted_at timestamptz,
  impressions int not null default 0,
  unique_impressions int,
  likes int not null default 0,
  comments int not null default 0,
  reposts int not null default 0,
  clicks int not null default 0,
  engagement_rate numeric(5,4),
  source text not null default 'manual',
  fetched_at timestamptz not null default now(),
  unique (user_id, linkedin_post_urn)
);

create index if not exists idx_post_metrics_user_posted
  on public.post_metrics(user_id, posted_at desc);
create index if not exists idx_post_metrics_draft
  on public.post_metrics(content_draft_id);

alter table public.post_metrics enable row level security;

drop policy if exists "post_metrics self all" on public.post_metrics;
create policy "post_metrics self all" on public.post_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "post_metrics admin read" on public.post_metrics;
create policy "post_metrics admin read" on public.post_metrics
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );


-- 4. TAGS em content_drafts
alter table public.content_drafts
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_content_drafts_tags
  on public.content_drafts using gin(tags);


-- 5. CAMPAIGN ATTACHMENTS
create table if not exists public.campaign_attachments (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  content text not null,
  kind text not null default 'reference',
  created_at timestamptz not null default now()
);

create index if not exists idx_campaign_attachments_campaign
  on public.campaign_attachments(campaign_id);

alter table public.campaign_attachments enable row level security;

drop policy if exists "campaign_attachments admin all" on public.campaign_attachments;
create policy "campaign_attachments admin all" on public.campaign_attachments
  for all using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

drop policy if exists "campaign_attachments leader read" on public.campaign_attachments;
create policy "campaign_attachments leader read" on public.campaign_attachments
  for select using (
    exists (
      select 1 from public.campaign_drafts cd
      where cd.campaign_id = campaign_attachments.campaign_id
        and cd.user_id = auth.uid()
    )
  );


-- 6. CAMPAIGN TEMPLATES
create table if not exists public.campaign_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  theme_template text not null,
  brief_template text,
  format public.content_format not null default 'linkedin_post',
  category text not null default 'general',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.campaign_templates enable row level security;

drop policy if exists "campaign_templates authed read" on public.campaign_templates;
create policy "campaign_templates authed read" on public.campaign_templates
  for select using (auth.role() = 'authenticated' and is_active);

drop policy if exists "campaign_templates admin write" on public.campaign_templates;
create policy "campaign_templates admin write" on public.campaign_templates
  for all using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  ) with check (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

insert into public.campaign_templates (name, description, theme_template, brief_template, format, category)
select * from (values
  ('Reação a notícia/tendência',
    'Newsjacking de algo quente. Cada líder traz seu ângulo.',
    'Reação à notícia: [DESCREVA A NOTÍCIA]',
    'Notícia: [link/contexto]. Por que importa: [impacto]. O ângulo Onfly: [tese]. Não pode soar como release; precisa ter opinião própria.',
    'linkedin_post'::public.content_format,
    'newsjacking'),
  ('Posicionamento de categoria',
    'Cravar uma categoria nova ou reposicionar uma existente.',
    'Posicionamento: [CATEGORIA] não é [VISÃO ANTIGA], é [VISÃO ONFLY]',
    'Tese central: [...]. Inimigo conceitual: [...]. Prova: [dado/case]. CTA: convite a continuar conversa.',
    'linkedin_post'::public.content_format,
    'positioning'),
  ('Lançamento de feature/produto',
    'Anúncio em camadas — cada líder fala da sua lente (operação, dados, RH...).',
    'Lançamento: [NOME DA FEATURE]',
    'O que é: [...]. Problema que resolve: [...]. Para quem: [...]. Diferencial: [...]. Voz: bastidor, não release.',
    'linkedin_post'::public.content_format,
    'launch'),
  ('Bastidor de operação',
    'Mostrar o "como" — o que aprendemos operando que mudou nossa mente.',
    'Bastidor: [QUE APRENDIZADO]',
    'Contexto da operação: [...]. O que acreditávamos: [...]. O que descobrimos: [...]. Implicação maior: [...].',
    'linkedin_post'::public.content_format,
    'bts'),
  ('Reação a dado de mercado',
    'Comentário autoral sobre uma estatística/relatório novo.',
    'O que [DADO/RELATÓRIO] revela',
    'Dado: [link e número]. Leitura genérica: [...]. Leitura Onfly: [...]. Aposta: [...].',
    'linkedin_post'::public.content_format,
    'data'),
  ('Coluna de autoridade — Forbes/Exame',
    'Artigo de 1000-1500 palavras com tese forte.',
    '[TESE EM UMA FRASE]',
    'Tese: [...]. 4-6 seções com argumentos + dados. Conclusão com aposta de futuro. Tom: operador, sem floreio.',
    'article'::public.content_format,
    'authority')
) as t(name, description, theme_template, brief_template, format, category)
where not exists (select 1 from public.campaign_templates);


-- 7. VIEW: leader_overview
create or replace view public.leader_overview as
select
  lp.user_id,
  lp.full_name,
  lp.role,
  lp.area,
  lp.target_audience,
  lp.tone_traits,
  lp.main_objective,
  lp.onboarding_completed,
  lp.created_at as joined_at,
  lc.followers_count,
  lc.linkedin_url,
  lc.last_synced_at as linkedin_synced_at,
  coalesce(
    (select count(*) from public.content_drafts cd where cd.user_id = lp.user_id), 0
  ) as drafts_count,
  coalesce(
    (select count(*) from public.campaign_drafts cmd where cmd.user_id = lp.user_id), 0
  ) as campaigns_received,
  coalesce(
    (select sum(impressions) from public.post_metrics pm where pm.user_id = lp.user_id), 0
  ) as total_impressions,
  coalesce(
    (select count(*) from public.post_metrics pm where pm.user_id = lp.user_id), 0
  ) as posts_with_metrics,
  array(
    select distinct unnest(cd.tags) from public.content_drafts cd where cd.user_id = lp.user_id
  ) as topics_covered
from public.leader_profiles lp
left join public.linkedin_connections lc on lc.user_id = lp.user_id;

grant select on public.leader_overview to authenticated;
