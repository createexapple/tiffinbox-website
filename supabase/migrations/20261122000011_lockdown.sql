-- 20261122000011_lockdown.sql
-- Final sweep of function privileges. Whatever default privileges Supabase applied to objects created
-- by earlier migrations, the end state is:
--   anon          : EXECUTE on public.get_public_content() and nothing else.
--   authenticated : EXECUTE on the public RPC functions (granted where each is created; every one starts
--                   with an admin check) and on the app.* functions that RLS policies, views and
--                   triggers call AS THE CALLER (listed below). Not on the SECURITY DEFINER internals
--                   (do_publish, write_audit, build_content_document, ...), so even if the `app` schema
--                   were ever exposed they could not be called by a signed-in user.
-- tests/01_rls.sql re-checks this from the catalogue.

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
revoke all on all functions in schema app    from anon, public, authenticated;
revoke all on schema app from anon, public;

grant execute on function public.get_public_content() to anon;

-- app.* functions that run with the caller's privileges (policies, views, triggers, column defaults).
grant execute on function
    app.karachi_today(timestamptz),
    app.is_admin(),
    app.normalise_pk_phone(text),
    app.subscription_status_at(date),
    app.period_payment_status_at(date),
    app.customer_summary_at(date),
    app.menu_week_status_at(timestamptz),
    app.dashboard_overview_at(date, timestamptz),
    app.live_menu_week_at(timestamptz),
    app.menu_snapshot(uuid),
    app.slots_signature(jsonb),
    app.image_json(uuid)
  to authenticated;
