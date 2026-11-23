-- Rollback of 20261122000006_status_views.sql
drop view if exists public.dashboard_overview;
drop view if exists public.menu_week_status;
drop view if exists public.customer_summary;
drop view if exists public.period_payment_status;
drop view if exists public.subscription_status;
drop view if exists public.subscription_balance;
drop function if exists app.dashboard_overview_at(date, timestamptz);
drop function if exists app.menu_week_status_at(timestamptz);
drop function if exists app.live_menu_week_at(timestamptz);
drop function if exists app.slots_signature(jsonb);
drop function if exists app.menu_snapshot(uuid);
drop function if exists app.image_json(uuid);
drop function if exists app.customer_summary_at(date);
drop function if exists app.period_payment_status_at(date);
drop function if exists app.subscription_status_at(date);
