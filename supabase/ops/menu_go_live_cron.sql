-- supabase/ops/menu_go_live_cron.sql
-- OPTIONAL, ENVIRONMENT-SPECIFIC, NOT A MIGRATION, NOT EXERCISED. UNTESTED: pg_cron, pg_net and Vault do not
-- exist in the local PostgreSQL used for Stage 3 and there is no Supabase project yet.
--
-- Purpose (architecture 8.4): every minute, tell the web app to refresh its cached pages once a scheduled menu's
-- go-live time has passed. The data is already correct at go-live (the live menu is DERIVED from time); this job only
-- refreshes the cache. If it never runs, the 60-second timed re-check in the app is the backstop.
--
-- To enable on a Supabase project (staging first), by whoever owns that project:
--   1. Dashboard > Database > Extensions: enable pg_cron and pg_net.
--   2. Dashboard > Database > Vault: create two secrets
--        app_revalidate_url    e.g. https://<staging-host>/api/revalidate
--        app_revalidate_secret the shared secret (the SAME value as the web host's REVALIDATE_SECRET setting)
--      (never put either value in this file or in git)
--   3. Run this file in the SQL editor.
-- [verify] pg_net's net.http_post signature and Vault's vault.decrypted_secrets view on the chosen plan.

create or replace function app.notify_menu_go_live()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  r        record;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'app_revalidate_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'app_revalidate_secret';
  if v_url is null or v_secret is null then return; end if;   -- not configured: do nothing

  for r in select * from app.pending_go_live_notifications() loop
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
      body    := jsonb_build_object('reason', 'menu_go_live'));
    perform app.mark_go_live_notified(r.menu_week_id);
  end loop;
end $$;
revoke all on function app.notify_menu_go_live() from public, anon, authenticated;

select cron.schedule('menu-go-live-notifier', '* * * * *', $$select app.notify_menu_go_live()$$);

-- To disable:  select cron.unschedule('menu-go-live-notifier');
