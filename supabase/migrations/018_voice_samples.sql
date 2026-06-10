-- 018: textos próprios do líder + fingerprint de voz
--
-- Problema: o motor não capturava o tom REAL do líder. tone_examples
-- era um campo pequeno de texto livre. Agora o líder cola TEXTOS
-- INTEIROS que ele mesmo escreveu (posts reais do LinkedIn, e-mails,
-- artigos) e o motor extrai um "voice fingerprint": vocabulário que
-- ele usa, como abre, como fecha, opiniões que defende, histórias que
-- conta. Esses textos são a fonte SOBERANA do tom — acima de qualquer
-- regra geral.
--
-- Isolamento entre líderes: RLS self all, igual às outras per-user.
-- Idempotente: pode rodar mais de uma vez sem erro.

create table if not exists leader_voice_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Texto sem título',
  body text not null,
  created_at timestamptz not null default now()
);

alter table leader_voice_samples enable row level security;

drop policy if exists "voice_samples self all" on leader_voice_samples;
create policy "voice_samples self all" on leader_voice_samples
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_voice_samples_user
  on leader_voice_samples(user_id, created_at desc);

-- Fingerprint extraído pela IA a partir dos samples (texto estruturado
-- que entra no prompt como descrição soberana da voz).
alter table leader_profiles
  add column if not exists voice_fingerprint text;

comment on table leader_voice_samples is
  'Textos escritos PELO líder (posts reais, e-mails, artigos). Fonte soberana do tom de voz — o motor imita estes textos acima de qualquer regra.';
comment on column leader_profiles.voice_fingerprint is
  'Análise estruturada da voz extraída dos voice_samples: vocabulário-assinatura, aberturas/fechamentos típicos, opiniões recorrentes, ritmo. Recalculada quando samples mudam.';
