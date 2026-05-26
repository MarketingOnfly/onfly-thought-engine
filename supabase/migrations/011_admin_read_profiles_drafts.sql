-- ============================================================
-- Migration 011 — admins enxergam perfis e drafts de todos os líderes.
-- Sem isso a página /admin/leaders/[user_id] dá 404 porque o RLS de
-- "self read" bloqueia o admin de ler perfil/drafts alheios.
-- Idempotente.
-- ============================================================

-- leader_profiles: admin read all
drop policy if exists "leader_profiles admin read" on public.leader_profiles;
create policy "leader_profiles admin read" on public.leader_profiles
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

-- content_drafts: admin read all (read-only — edição continua só do dono)
drop policy if exists "content_drafts admin read" on public.content_drafts;
create policy "content_drafts admin read" on public.content_drafts
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

-- topic_suggestions: admin read all (opcional, pra debug futuro)
drop policy if exists "topic_suggestions admin read" on public.topic_suggestions;
create policy "topic_suggestions admin read" on public.topic_suggestions
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );

-- reference_profiles: admin read all (debug futuro)
drop policy if exists "reference_profiles admin read" on public.reference_profiles;
create policy "reference_profiles admin read" on public.reference_profiles
  for select using (
    exists (select 1 from public.org_admins where user_id = auth.uid())
  );
