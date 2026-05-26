-- ============================================================
-- Migration 009 — análise rica de perfis de referência
-- Adiciona campos pra tom, posicionamento, temas e vocabulário
-- extraídos automaticamente. Idempotente.
-- ============================================================

alter table public.reference_profiles
  add column if not exists tone_signals text[] not null default '{}',
  add column if not exists positioning text,
  add column if not exists topics_recurring text[] not null default '{}',
  add column if not exists vocab_notes text,
  add column if not exists analysis_error text;

comment on column public.reference_profiles.tone_signals is
  'Lista curta de traços de tom identificados (ex: provocativo, analítico, bem-humorado).';
comment on column public.reference_profiles.positioning is
  'Tese/posicionamento recorrente — o que essa pessoa defende publicamente.';
comment on column public.reference_profiles.topics_recurring is
  'Temas/assuntos que ela aborda com mais frequência.';
comment on column public.reference_profiles.vocab_notes is
  'Notas sobre vocabulário recorrente, jargões, expressões características.';
comment on column public.reference_profiles.analysis_error is
  'Última mensagem de erro da análise (pra debug e exibição na UI).';
