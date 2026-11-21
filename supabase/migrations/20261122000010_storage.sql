-- 20261122000010_storage.sql
-- Storage buckets and policies (architecture 7 table "Storage", 8.5; FR-21).
--   media           PUBLIC bucket of sanitised masters (food photos only). Anyone may read objects;
--                   only active admins may write.
--   media-incoming  PRIVATE bucket for uploads before server-side validation/re-encoding. No public
--                   access; an admin may write and read ONLY their own uploads.
-- Needs the Supabase `storage` schema. This migration could NOT be run against real Supabase Storage in
-- this environment (no Supabase project, no Docker); it was run against a local emulation of the two
-- tables (supabase/tests/local-shim.sql). Verify on the first staging project (docs/database.md).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media',          'media',          true,  2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('media-incoming', 'media-incoming', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- media (public read, admin write)
create policy "media_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');
create policy "media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select app.is_admin()));
create policy "media_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and (select app.is_admin()))
  with check (bucket_id = 'media' and (select app.is_admin()));
create policy "media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select app.is_admin()));

-- media-incoming (private; an admin sees and removes only their own uploads)
create policy "incoming_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media-incoming' and (select app.is_admin()) and owner_id = (select auth.uid())::text);
create policy "incoming_admin_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'media-incoming' and (select app.is_admin()) and owner_id = (select auth.uid())::text);
create policy "incoming_admin_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media-incoming' and (select app.is_admin()) and owner_id = (select auth.uid())::text);
