-- Migration 016 — publicação real no LinkedIn
-- ============================================
-- Adiciona colunas em content_drafts pra rastrear quando o post foi
-- publicado no LinkedIn e o URN/URL retornados pela API.

alter table public.content_drafts
  add column if not exists published_at timestamptz,
  add column if not exists linkedin_post_urn text,
  add column if not exists linkedin_post_url text,
  add column if not exists publish_error text;

create index if not exists idx_content_drafts_published
  on public.content_drafts(user_id, published_at desc)
  where published_at is not null;

-- Reload schema cache pra PostgREST enxergar as colunas
notify pgrst, 'reload schema';
