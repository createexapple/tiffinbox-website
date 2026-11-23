-- Rollback of 20261122000008_menu_functions.sql
drop function if exists app.mark_go_live_notified(uuid);
drop function if exists app.pending_go_live_notifications();
drop function if exists public.release_menu_week(uuid, text, timestamptz);
drop function if exists public.copy_menu_week(uuid, date);
drop function if exists public.save_menu_week(date, jsonb);
drop function if exists app.menu_slot_errors(jsonb, boolean);
drop function if exists app.menu_week_json(uuid);
