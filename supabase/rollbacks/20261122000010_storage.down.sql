-- Rollback of 20261122000010_storage.sql: removes the policies. Buckets are NOT deleted here: on a real Supabase
-- project, SQL deletes from storage.* are blocked (use the dashboard or Storage API after emptying the bucket),
-- and deleting a bucket with objects would lose photos.
drop policy if exists "media_public_read"          on storage.objects;
drop policy if exists "media_admin_insert"         on storage.objects;
drop policy if exists "media_admin_update"         on storage.objects;
drop policy if exists "media_admin_delete"         on storage.objects;
drop policy if exists "incoming_admin_insert"      on storage.objects;
drop policy if exists "incoming_admin_select_own"  on storage.objects;
drop policy if exists "incoming_admin_delete_own"  on storage.objects;
