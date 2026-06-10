-- 019: Story Bank — banco de histórias e números REAIS do líder
--
-- Benchmark: Supergrow (Content DNA + stories), Boldfy ("histórias que
-- ela conta"). Resolve a tensão central do motor: "seja específico"
-- (bom post precisa de número/caso concreto) vs "nunca invente"
-- (REGRA ZERO). O líder registra UMA VEZ os casos/números verdadeiros
-- dele; o motor passa a ter estoque de especificidade VERDADEIRA.
--
-- times_used permite anti-repetição: o motor prefere histórias menos
-- usadas, e o líder vê quais já gastou.
--
-- Idempotente.

create table if not exists leader_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  story text not null,
  facts text, -- números/dados reais associados (opcional, livre)
  times_used int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table leader_stories enable row level security;

drop policy if exists "stories self all" on leader_stories;
create policy "stories self all" on leader_stories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_stories_user
  on leader_stories(user_id, created_at desc);

comment on table leader_stories is
  'Histórias, casos e números REAIS do líder, registrados por ele. Única fonte legítima de especificidade além do input da geração — mata a fabricação dando estoque de fato verdadeiro.';
