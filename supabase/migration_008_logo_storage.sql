-- Migration 008: proper file storage for school logos.
-- Run once in Supabase → SQL Editor.
--
-- Creates a PUBLIC bucket called "school-logos" (logos appear on printed
-- result slips and the top bar, so anyone with the link may view them; they
-- are not secret). Only the owner of a school may add, replace, list or
-- delete files inside that school's own folder (the folder is named after the
-- school id). The bucket accepts only small PNG/JPEG/WebP images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', true, 524288, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 524288,
      allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "logos owner select" on storage.objects;
drop policy if exists "logos owner insert" on storage.objects;
drop policy if exists "logos owner update" on storage.objects;
drop policy if exists "logos owner delete" on storage.objects;

create policy "logos owner select" on storage.objects for select to authenticated
  using (bucket_id = 'school-logos' and (storage.foldername(name))[1] in
         (select id::text from public.schools where owner_id = auth.uid()));

create policy "logos owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'school-logos' and (storage.foldername(name))[1] in
         (select id::text from public.schools where owner_id = auth.uid()));

create policy "logos owner update" on storage.objects for update to authenticated
  using (bucket_id = 'school-logos' and (storage.foldername(name))[1] in
         (select id::text from public.schools where owner_id = auth.uid()));

create policy "logos owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'school-logos' and (storage.foldername(name))[1] in
         (select id::text from public.schools where owner_id = auth.uid()));
