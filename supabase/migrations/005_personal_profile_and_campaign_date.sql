-- ============================================================
-- Migration 005 — perfil pessoal + data nas campanhas
-- Idempotente.
-- ============================================================

-- 1. Campos pessoais no leader_profiles
alter table public.leader_profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists twitter_url text,
  add column if not exists website_url text,
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists notification_email boolean not null default true,
  add column if not exists notification_digest text not null default 'weekly'
    check (notification_digest in ('never', 'daily', 'weekly'));

-- 2. Data alvo de publicação nas campanhas
alter table public.campaigns
  add column if not exists target_publish_date date;

comment on column public.campaigns.target_publish_date is
  'Data em que os drafts gerados por essa campanha devem ser publicados pelos líderes. Setada como scheduled_at em cada draft durante o dispatch.';

-- 3. Storage bucket pra avatares (público read, write só do dono)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- policies do bucket avatars
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars owner write" on storage.objects;
create policy "avatars owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4. Atualizar leader_overview pra incluir avatar e bio
-- (drop + create porque create-or-replace não permite mudar ordem/nomes de colunas)
drop view if exists public.leader_overview;
create view public.leader_overview as
select
  lp.user_id,
  lp.full_name,
  lp.role,
  lp.area,
  lp.target_audience,
  lp.tone_traits,
  lp.main_objective,
  lp.onboarding_completed,
  lp.avatar_url,
  lp.bio,
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

notify pgrst, 'reload schema';
