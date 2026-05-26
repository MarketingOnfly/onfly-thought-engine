-- ============================================================
-- Migration 014 — foundation pras features inteligentes
-- - variações de draft
-- - score de aderência ao estilo
-- - histórico de revisões com restore
-- - detecção de post de alto desempenho (auto-feedback)
-- Idempotente.
-- ============================================================

-- 1. Variações geradas em paralelo + histórico de revisões.
-- Vivemos no meta JSONB que content_drafts já tem, mas adicionamos colunas
-- dedicadas pra performance de query e clareza.
alter table public.content_drafts
  add column if not exists alt_versions jsonb not null default '[]'::jsonb,
  add column if not exists style_score jsonb;

comment on column public.content_drafts.alt_versions is
  'Array de versões alternativas geradas no mesmo prompt. Cada item: {id, label, body, generated_at}.';
comment on column public.content_drafts.style_score is
  'Auto-avaliação do draft contra o estilo do líder. {overall: 0-100, matches: [bullets], gaps: [bullets], computed_at}.';

-- 2. Tabela de versões anteriores do draft (pra restaurar)
create table if not exists public.draft_versions (
  id uuid primary key default uuid_generate_v4(),
  content_draft_id uuid not null references public.content_drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  reason text, -- "revisão: X" ou "edição manual" ou "geração inicial"
  created_at timestamptz not null default now()
);

create index if not exists idx_draft_versions_draft
  on public.draft_versions(content_draft_id, created_at desc);

alter table public.draft_versions enable row level security;

drop policy if exists "draft_versions self all" on public.draft_versions;
create policy "draft_versions self all" on public.draft_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Flag pra evitar reanálise duplicada de post alto desempenho
alter table public.post_metrics
  add column if not exists learned_from boolean not null default false;

comment on column public.post_metrics.learned_from is
  'TRUE depois do motor extrair aprendizado desse post de alto desempenho e gravar em learned_preferences. Evita reanálise.';

notify pgrst, 'reload schema';
