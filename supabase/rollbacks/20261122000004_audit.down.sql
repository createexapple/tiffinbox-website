-- Rollback of 20261122000004_audit.sql (drops the change history: destructive, full teardown only)
drop view if exists public.change_history;
do $$
declare r record;
begin
  for r in select event_object_table as t, trigger_name as n from information_schema.triggers
           where trigger_schema = 'public' and trigger_name like 'audit\_%' escape '\' group by 1, 2 loop
    execute format('drop trigger if exists %I on public.%I', r.n, r.t);
  end loop;
end $$;
drop function if exists app.audit_row_change();
drop function if exists app.write_audit(text, text, text, jsonb, jsonb, uuid, uuid);
drop table if exists public.audit_log;
drop function if exists app.audit_log_guard();
