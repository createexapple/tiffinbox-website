-- 20261122000005_rls_and_grants.sql
-- Row-level security on EVERY table, default deny, plus the narrow grants of architecture section 7.
--
--   anon          : no grants on any table, view or sequence. (It may execute get_public_content() only,
--                   granted in migration 7.) RLS is enabled and no policy names anon.
--   authenticated : grants are only the ceiling; every policy requires app.is_admin(), so a signed-in
--                   user who is not an active admin sees nothing and can change nothing.
--   service_role  : bypasses RLS by design (Supabase). The application never uses it at runtime.
--
-- Stricter than the architecture table where that is safer (documented in docs/database.md):
--   * menu_weeks, menu_slots, content_releases, site_state: read-only for admins; written only by the
--     publish/menu functions, so a snapshot or release cannot be edited by hand.
--   * customers, subscriptions, subscription_periods, payments: no DELETE for anyone (archive / void instead).
--   * payments, subscriptions: column-level UPDATE; void fields change only through void_payment().

-- Start from nothing for the public role, whatever Supabase's defaults granted.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ---------------------------------------------------------------------------------------------
-- Enable RLS everywhere (default deny: a table with RLS and no matching policy returns nothing).
-- ---------------------------------------------------------------------------------------------
alter table public.admin_users          enable row level security;
alter table public.site_settings        enable row level security;
alter table public.pricing_rules        enable row level security;
alter table public.ops_settings         enable row level security;
alter table public.media                enable row level security;
alter table public.plans                enable row level security;
alter table public.dishes               enable row level security;
alter table public.addons               enable row level security;
alter table public.faq_entries          enable row level security;
alter table public.page_images          enable row level security;
alter table public.menu_weeks           enable row level security;
alter table public.menu_slots           enable row level security;
alter table public.content_releases     enable row level security;
alter table public.site_state           enable row level security;
alter table public.customers            enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.subscription_periods enable row level security;
alter table public.payments             enable row level security;
alter table public.audit_log            enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Grants to authenticated (ceiling) -- start by removing the Supabase defaults, then add back.
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from authenticated;

grant select on public.admin_users, public.audit_log, public.content_releases, public.site_state,
                public.menu_weeks, public.menu_slots to authenticated;

grant select, update on public.site_settings, public.pricing_rules, public.ops_settings to authenticated;

grant select, insert, update, delete on public.media, public.plans, public.dishes, public.addons,
                                        public.faq_entries, public.page_images to authenticated;

grant select on public.customers to authenticated;
grant insert (type, name, phone_e164, address_text, org_name, contact_person, member_count, notes)
  on public.customers to authenticated;
grant update (type, name, phone_e164, address_text, org_name, contact_person, member_count, notes,
              archived_at)
  on public.customers to authenticated;

-- Subscriptions are created by create_subscription() (it also creates the first period).
grant select on public.subscriptions to authenticated;
grant update (plan_id, term, start_date, end_date, breakfast_addon, amount_per_period, amount_note,
              manual_state, manual_state_on, notes)
  on public.subscriptions to authenticated;

grant select, insert, update on public.subscription_periods to authenticated;

grant select on public.payments to authenticated;
grant insert (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference, note)
  on public.payments to authenticated;
grant update (subscription_id, amount, method, paid_on, covers_from, covers_to, reference, note)
  on public.payments to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policies. One predicate everywhere: (select app.is_admin()) -- evaluated once per statement.
-- ---------------------------------------------------------------------------------------------
-- admin_users: a user may read only their own row (the app checks is_active); no writes through the API.
create policy admin_users_select_own on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

-- audit_log: admins read; nobody inserts or changes through the API.
create policy audit_log_admin_select on public.audit_log
  for select to authenticated using ((select app.is_admin()));

-- Read-only for admins (written by functions)
create policy content_releases_admin_select on public.content_releases
  for select to authenticated using ((select app.is_admin()));
create policy site_state_admin_select on public.site_state
  for select to authenticated using ((select app.is_admin()));
create policy menu_weeks_admin_select on public.menu_weeks
  for select to authenticated using ((select app.is_admin()));
create policy menu_slots_admin_select on public.menu_slots
  for select to authenticated using ((select app.is_admin()));

-- Single-row settings: read and update
create policy site_settings_admin_select on public.site_settings
  for select to authenticated using ((select app.is_admin()));
create policy site_settings_admin_update on public.site_settings
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy pricing_rules_admin_select on public.pricing_rules
  for select to authenticated using ((select app.is_admin()));
create policy pricing_rules_admin_update on public.pricing_rules
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy ops_settings_admin_select on public.ops_settings
  for select to authenticated using ((select app.is_admin()));
create policy ops_settings_admin_update on public.ops_settings
  for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

-- Content tables: admin read / insert / update / delete
create policy media_admin_select on public.media for select to authenticated using ((select app.is_admin()));
create policy media_admin_insert on public.media for insert to authenticated with check ((select app.is_admin()));
create policy media_admin_update on public.media for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy media_admin_delete on public.media for delete to authenticated using ((select app.is_admin()));

create policy plans_admin_select on public.plans for select to authenticated using ((select app.is_admin()));
create policy plans_admin_insert on public.plans for insert to authenticated with check ((select app.is_admin()));
create policy plans_admin_update on public.plans for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy plans_admin_delete on public.plans for delete to authenticated using ((select app.is_admin()));

create policy dishes_admin_select on public.dishes for select to authenticated using ((select app.is_admin()));
create policy dishes_admin_insert on public.dishes for insert to authenticated with check ((select app.is_admin()));
create policy dishes_admin_update on public.dishes for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy dishes_admin_delete on public.dishes for delete to authenticated using ((select app.is_admin()));

create policy addons_admin_select on public.addons for select to authenticated using ((select app.is_admin()));
create policy addons_admin_insert on public.addons for insert to authenticated with check ((select app.is_admin()));
create policy addons_admin_update on public.addons for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy addons_admin_delete on public.addons for delete to authenticated using ((select app.is_admin()));

create policy faq_admin_select on public.faq_entries for select to authenticated using ((select app.is_admin()));
create policy faq_admin_insert on public.faq_entries for insert to authenticated with check ((select app.is_admin()));
create policy faq_admin_update on public.faq_entries for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy faq_admin_delete on public.faq_entries for delete to authenticated using ((select app.is_admin()));

create policy page_images_admin_select on public.page_images for select to authenticated using ((select app.is_admin()));
create policy page_images_admin_insert on public.page_images for insert to authenticated with check ((select app.is_admin()));
create policy page_images_admin_update on public.page_images for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));
create policy page_images_admin_delete on public.page_images for delete to authenticated using ((select app.is_admin()));

-- Operations: no delete policy exists for any of these (and no DELETE grant)
create policy customers_admin_select on public.customers for select to authenticated using ((select app.is_admin()));
create policy customers_admin_insert on public.customers for insert to authenticated with check ((select app.is_admin()));
create policy customers_admin_update on public.customers for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy subscriptions_admin_select on public.subscriptions for select to authenticated using ((select app.is_admin()));
create policy subscriptions_admin_update on public.subscriptions for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy periods_admin_select on public.subscription_periods for select to authenticated using ((select app.is_admin()));
create policy periods_admin_insert on public.subscription_periods for insert to authenticated with check ((select app.is_admin()));
create policy periods_admin_update on public.subscription_periods for update to authenticated using ((select app.is_admin())) with check ((select app.is_admin()));

create policy payments_admin_select on public.payments for select to authenticated using ((select app.is_admin()));
create policy payments_admin_insert on public.payments for insert to authenticated with check ((select app.is_admin()));
create policy payments_admin_update on public.payments for update to authenticated using ((select app.is_admin()) and voided_at is null) with check ((select app.is_admin()));
