-- ============================================================
-- Migration 004 — Style Studio
-- Adiciona configurações estruturadas (multi-select) no perfil do líder.
-- Idempotente.
-- ============================================================

alter table public.leader_profiles
  add column if not exists objectives text[] not null default '{}',
  add column if not exists preferred_formats text[] not null default '{}',
  add column if not exists content_types text[] not null default '{}',
  add column if not exists themes text[] not null default '{}',
  add column if not exists preferred_hook_styles text[] not null default '{}',
  add column if not exists audience_segments text[] not null default '{}';

comment on column public.leader_profiles.objectives is
  'Objetivos de comunicação (brand_awareness, lead_gen, recruitment, thought_leadership, product_release).';
comment on column public.leader_profiles.preferred_formats is
  'Formatos preferidos (linkedin_post, article, newsletter, twitter_thread, press_release, talk_script).';
comment on column public.leader_profiles.content_types is
  'Tipos de conteúdo (newsjacking, bastidor, contrarian, comparative, learnings, manifesto).';
comment on column public.leader_profiles.themes is
  'Pilares/temas que o líder cobre regularmente.';
comment on column public.leader_profiles.preferred_hook_styles is
  'Estilos de hook (number_punch, contradiction, confessional, provocative_question, short_punch, quote, list_promise, story_open).';
comment on column public.leader_profiles.audience_segments is
  'Segmentos de audiência (cfo_mid_market, head_hr, founder_early, growth_lead, etc).';

notify pgrst, 'reload schema';
