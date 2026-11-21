-- Rollback of 20261122000005_rls_and_grants.sql
-- DANGEROUS ON ITS OWN: it removes the policies, disables RLS and withdraws the grants, leaving whatever
-- Supabase's default privileges grant. Only run as part of a full teardown (followed by the later-numbered rollbacks
-- in reverse order), never to "temporarily" open data.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('alter table public.%I disable row level security', r.relname);
  end loop;
end $$;
revoke all on all tables in schema public from authenticated;
