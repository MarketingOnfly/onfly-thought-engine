-- ============================================================
-- Migration 013 — catch-up de reference_profiles
-- Garante que todas as colunas referenciadas pelo código existem.
-- Esse banco pulou a migration 001, então analysis_status / analyzed_at /
-- style_notes faltam. Idempotente.
-- ============================================================

alter table public.reference_profiles
  add column if not exists style_notes text,
  add column if not exists analyzed_at timestamptz,
  add column if not exists analysis_status text not null default 'pending';

-- migration 009 — re-aplica defensivamente caso o banco tenha alguma divergência
alter table public.reference_profiles
  add column if not exists tone_signals text[] not null default '{}',
  add column if not exists positioning text,
  add column if not exists topics_recurring text[] not null default '{}',
  add column if not exists vocab_notes text,
  add column if not exists analysis_error text;

-- comentários úteis
comment on column public.reference_profiles.analysis_status is
  'pending = não analisado; ok = analisado a partir de URL pública; unfetchable = não consegui acessar (LinkedIn etc.); analyzed_with_sample = líder colou exemplos manualmente.';
comment on column public.reference_profiles.style_notes is
  'Análise automática gerada por Claude: voz, padrões de ritmo, estrutura recorrente.';

-- força PostgREST a recarregar o schema cache
notify pgrst, 'reload schema';
