-- ============================================================
-- Migration 006 — campaign audience targeting + image attachments
-- Idempotente.
-- ============================================================

-- 1. Audience targeting per campaign
alter table public.campaigns
  add column if not exists audience_filter jsonb not null default '{"mode":"all"}'::jsonb;

comment on column public.campaigns.audience_filter is
  'Modo de seleção dos líderes: {"mode":"all"} | {"mode":"specific_users","user_ids":[...]} | {"mode":"by_area","areas":[...]} | {"mode":"by_role","roles":[...]}';


-- 2. Attachment kind allows image now (já é text, então só atualiza comment + add MIME col)
alter table public.campaign_attachments
  add column if not exists mime_type text;

alter table public.campaign_attachments
  add column if not exists size_bytes int;

comment on column public.campaign_attachments.kind is
  'reference | brief | data | press_release | image';

comment on column public.campaign_attachments.content is
  'Texto extraído quando documento; data URL base64 quando kind=image.';
