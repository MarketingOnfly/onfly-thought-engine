-- Migration 015 — bucket de Storage temporário pra upload de documentos
-- ====================================================================
-- Problema: route handlers do Next.js no Vercel têm limite de body
-- ~4.5MB. PDF de 5MB explode com "Falha no upload". Solução: cliente
-- sobe direto no Supabase Storage, server lê de lá, parseia e apaga.
-- ====================================================================

-- 1. Bucket privado pra documentos do líder (transitório — só pra parse)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leader-documents',
  'leader-documents',
  false,
  15728640, -- 15MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. RLS — cada líder só escreve/lê/apaga sob a sua própria pasta
drop policy if exists "leader-docs owner insert" on storage.objects;
create policy "leader-docs owner insert" on storage.objects
  for insert with check (
    bucket_id = 'leader-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "leader-docs owner read" on storage.objects;
create policy "leader-docs owner read" on storage.objects
  for select using (
    bucket_id = 'leader-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "leader-docs owner delete" on storage.objects;
create policy "leader-docs owner delete" on storage.objects
  for delete using (
    bucket_id = 'leader-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
