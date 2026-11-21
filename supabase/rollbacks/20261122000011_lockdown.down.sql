-- Rollback of 20261122000011_lockdown.sql
-- The lockdown only REMOVES privileges and grants one function to anon, so there is nothing safe to put back:
-- restoring "whatever Supabase's defaults gave" would re-open the public role. This script therefore only
-- withdraws the explicit grants the migration made; run the 20261122000001..10 rollbacks to remove the objects.
revoke execute on function public.get_public_content() from anon;
