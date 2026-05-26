-- ============================================================
-- Migration 001 — auto-analysis fields for reference_profiles
-- Rode no SQL Editor do Supabase.
-- ============================================================

alter table public.reference_profiles
  add column if not exists style_notes text,
  add column if not exists analyzed_at timestamptz,
  add column if not exists analysis_status text not null default 'pending';

-- analysis_status: pending | ok | unfetchable | analyzed_with_sample
comment on column public.reference_profiles.style_notes is
  'Análise automática gerada por Claude: voz, padrões de ritmo, estrutura recorrente.';
comment on column public.reference_profiles.hook_examples is
  'Hooks extraídos automaticamente do conteúdo público OU colados manualmente pelo líder.';
comment on column public.reference_profiles.analysis_status is
  'pending = não analisado; ok = analisado a partir de URL pública; unfetchable = não consegui acessar (LinkedIn etc.); analyzed_with_sample = líder colou exemplos manualmente.';
