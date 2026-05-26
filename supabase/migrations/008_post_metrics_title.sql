-- ============================================================
-- Migration 008 — armazena o título do post no post_metrics
-- pra exibir no ranking de analytics sem depender só da URL.
-- Idempotente.
-- ============================================================

alter table public.post_metrics
  add column if not exists title text;

comment on column public.post_metrics.title is
  'Título / texto inicial do post, lido do export do LinkedIn (Conteúdo da publicação).';
