-- Rollback of 20261122000001_foundation.sql
drop table if exists public.admin_users;
drop function if exists app.set_updated_at();
drop function if exists app.normalise_pk_phone(text);
drop function if exists app.valid_hhmm(text);
drop function if exists app.is_blank_or_placeholder(text);
drop function if exists app.actor_label(uuid);
drop function if exists app.is_owner();
drop function if exists app.is_admin();
drop function if exists app.karachi_today(timestamptz);
drop schema if exists app;
-- Default-privilege changes are left as they are (they only REMOVE anon defaults; re-granting them would weaken security).
