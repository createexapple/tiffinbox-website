-- 01_rls.sql : access rules per role on EVERY table, view and function (architecture sec. 7, NFR-07, NFR-12).
-- Roles: anon | admin A (owner) | admin B (staff) | C (inactive admin row) | D (signed in, not an admin).
\i :ROOT/supabase/tests/data.sql

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''bbbbbbbb-0000-4000-8000-00000000000b'''
\set C '''cccccccc-0000-4000-8000-00000000000c'''
\set D '''dddddddd-0000-4000-8000-00000000000d'''

select tt.as_postgres();
-- =============================== catalogue checks ===============================
select tt.is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r','p')), 19::bigint, 'public schema has the 19 expected tables');
select tt.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity),
             'RLS is enabled on every public table');
select tt.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
                and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
                     or (c.relkind <> 'S' and has_any_column_privilege('anon', c.oid, 'select,insert,update,references')))),
             'anon has NO privilege of any kind on any table, view or sequence in public');
with seqs as materialized (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
                           where n.nspname = 'public' and c.relkind = 'S')
select tt.ok(not exists (select 1 from seqs where has_sequence_privilege('anon', seqs.oid, 'usage,select,update')),
             'anon has no privilege on any sequence');
select tt.is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'execute')),
             array['get_public_content'], 'anon may execute exactly one function: get_public_content');
select tt.is((select count(*) from pg_policies where schemaname = 'public' and (roles && array['anon'::name, 'public'::name])),
             0::bigint, 'no RLS policy in public names anon or public');
select tt.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false)),
             'every view in public is security_invoker (RLS of the caller applies)');
select tt.is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'app' and has_function_privilege('authenticated', p.oid, 'execute')),
             array['customer_summary_at','dashboard_overview_at','image_json','is_admin','karachi_today','live_menu_week_at',
                   'menu_snapshot','menu_week_status_at','normalise_pk_phone','period_payment_status_at','slots_signature','subscription_status_at'],
             'authenticated may execute only the caller-privilege app.* helpers, not the SECURITY DEFINER internals');
select tt.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'app') and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
             'every function in public and app has a fixed search_path');
select tt.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'app') and p.prosecdef and p.proowner <> (select relowner from pg_class where oid = 'public.plans'::regclass)),
             'every SECURITY DEFINER function is owned by the table owner (so RLS bypass is intended and limited to that role)');
select tt.ok(not has_schema_privilege('anon', 'app', 'usage'), 'anon has no USAGE on schema app');
select tt.ok(not has_table_privilege('authenticated', 'public.audit_log', 'insert,update,delete,truncate'), 'nobody can write audit_log (no grants)');
select tt.ok(not has_table_privilege('authenticated', 'public.payments', 'delete'), 'payments cannot be deleted (void instead)');
select tt.ok(not has_table_privilege('authenticated', 'public.customers', 'delete'), 'customers cannot be deleted (archive instead)');
select tt.ok(not has_table_privilege('authenticated', 'public.subscriptions', 'insert,delete'), 'subscriptions are created only by create_subscription()');
select tt.ok(not has_table_privilege('authenticated', 'public.content_releases', 'insert,update,delete'), 'releases are written only by publish_content()');
select tt.ok(not has_table_privilege('authenticated', 'public.menu_weeks', 'insert,update,delete'), 'menu weeks are written only by the menu functions');
select tt.ok(not has_column_privilege('authenticated', 'public.payments', 'voided_at', 'update'), 'void fields are not directly updatable');

-- Every table has at least one row in the fixture, so "0 rows" below is RLS at work, not an empty table.
select tt.ok((select bool_and(tt.count_rows('select 1 from public.' || quote_ident(tablename)) > 0)
              from pg_tables where schemaname = 'public'), 'fixture: every table has at least one row');

-- =============================== anon: nothing but get_public_content ===============================
select tt.as_anon();
select tt.denied('select * from public.' || quote_ident(t) || ' limit 1', 'anon cannot SELECT ' || t)
  from unnest(array['admin_users','site_settings','pricing_rules','ops_settings','media','plans','dishes','addons','faq_entries',
                    'page_images','menu_weeks','menu_slots','content_releases','site_state','customers','subscriptions',
                    'subscription_periods','payments','audit_log',
                    'subscription_status','period_payment_status','customer_summary','menu_week_status','dashboard_overview',
                    'subscription_balance','change_history']) t;
select tt.throws('insert into public.plans (name) values (''x'')', '42501', 'anon cannot INSERT plans');
select tt.throws('insert into public.customers (type, name, phone_e164) values (''home'', ''x'', ''+923001234567'')', '42501', 'anon cannot INSERT customers');
select tt.throws('update public.plans set name = ''x''', '42501', 'anon cannot UPDATE plans');
select tt.throws('delete from public.plans', '42501', 'anon cannot DELETE plans');
select tt.throws('update public.site_state set current_release_id = null', '42501', 'anon cannot repoint the live release');
select tt.throws('select public.publish_content()', '42501', 'anon cannot execute publish_content');
select tt.throws('select public.draft_status()', '42501', 'anon cannot execute draft_status');
select tt.throws('select public.get_draft_content()', '42501', 'anon cannot execute get_draft_content');
select tt.throws('select public.rollback_release(1)', '42501', 'anon cannot execute rollback_release');
select tt.throws('select public.void_payment(''f3000000-0000-4000-8000-000000000001'', ''x'')', '42501', 'anon cannot execute void_payment');
select tt.throws('select public.anonymise_customer(''f0000000-0000-4000-8000-000000000001'')', '42501', 'anon cannot execute anonymise_customer');
select tt.throws('select app.is_admin()', '42501', 'anon cannot reach the app schema');
select tt.lives('select public.get_public_content()', 'anon CAN execute get_public_content');
select tt.ok((select public.get_public_content()) is not null, 'get_public_content returns the published release to anon');
select tt.is((select public.get_public_content() #>> '{release,version}'), '1', 'public content reports release version 1');
select tt.is((select array_agg(k order by k) from jsonb_object_keys(public.get_public_content()) k),
             array['addons','dishes','faq','menu','page_images','plans','pricing_rules','release','schema_version','settings'],
             'public content has exactly the documented top-level keys');
select tt.ok((select public.get_public_content()::text) !~* '(customer|subscription|phone_e164|audit|admin_user|"draft"|Student Test)',
             'public content contains no customer, subscription, audit or draft data');
select tt.is((select jsonb_array_length(public.get_public_content() #> '{menu,slots}')), 21, 'public content carries the 21 live menu slots');

-- anon storage: read the public media bucket only
select tt.as_postgres();
insert into storage.objects (bucket_id, name, owner_id) values
  ('media', 'test/pub.webp', null), ('media-incoming', 'test/incoming-A.webp', 'aaaaaaaa-0000-4000-8000-00000000000a');
select tt.as_anon();
select tt.is(tt.count_rows('select 1 from storage.objects where bucket_id = ''media'''), 1::bigint, 'anon can read objects of the public media bucket');
select tt.is(tt.count_rows('select 1 from storage.objects where bucket_id = ''media-incoming'''), 0::bigint, 'anon cannot see media-incoming objects');
select tt.throws('insert into storage.objects (bucket_id, name) values (''media'', ''evil.webp'')', '42501', 'anon cannot upload to media');

-- =============================== D: signed in but NOT an admin; C: inactive admin ===============================
select tt.as_user(:D::uuid);
select tt.is(tt.count_rows('select 1 from public.' || quote_ident(t)), 0::bigint, 'non-admin sees 0 rows in ' || t)
  from unnest(array['admin_users','site_settings','pricing_rules','ops_settings','media','plans','dishes','addons','faq_entries',
                    'page_images','menu_weeks','menu_slots','content_releases','site_state','customers','subscriptions',
                    'subscription_periods','payments','audit_log',
                    'subscription_status','period_payment_status','customer_summary','menu_week_status','dashboard_overview',
                    'subscription_balance','change_history']) t;
select tt.throws('insert into public.plans (name) values (''x'')', '42501', 'non-admin cannot INSERT plans');
select tt.throws('insert into public.media (storage_path, alt_text, width, height, bytes) values (''p'', ''a'', 1, 1, 1)', '42501', 'non-admin cannot INSERT media');
select tt.throws('insert into public.customers (type, name, phone_e164) values (''home'', ''x'', ''+923001234567'')', '42501', 'non-admin cannot INSERT customers');
select tt.denied('insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values (''f0000000-0000-4000-8000-000000000001'', ''f1000000-0000-4000-8000-000000000001'', 5, ''jazzcash'', ''2026-11-20'', ''2026-11-20'', ''2026-11-20'')', 'non-admin cannot INSERT payments (refused by the invoker-privilege trigger/RLS)');
select tt.throws('insert into public.admin_users (user_id, display_name) values (' || quote_literal(:D) || ', ''self-made admin'')', '42501', 'non-admin cannot make themselves an admin');
select tt.blocked('update public.plans set name = ''hacked''', 'non-admin UPDATE plans changes nothing');
select tt.blocked('update public.site_settings set whatsapp_number = ''1''', 'non-admin UPDATE site_settings changes nothing');
select tt.blocked('update public.customers set name = ''hacked''', 'non-admin UPDATE customers changes nothing');
select tt.blocked('update public.payments set amount = 1', 'non-admin UPDATE payments changes nothing');
select tt.blocked('delete from public.plans', 'non-admin DELETE plans changes nothing');
select tt.blocked('delete from public.media', 'non-admin DELETE media changes nothing');
select tt.blocked('delete from public.audit_log', 'non-admin DELETE audit_log refused');
select tt.is((select count(*) from public.get_public_content() x where x is not null), 1::bigint, 'a signed-in non-admin can still read the published content');
select tt.throws('select public.publish_content()', 'PT403', 'non-admin: publish_content is forbidden');
select tt.throws('select public.rollback_release(1)', 'PT403', 'non-admin: rollback_release is forbidden');
select tt.throws('select public.get_draft_content()', 'PT403', 'non-admin: get_draft_content is forbidden');
select tt.throws('select public.draft_status()', 'PT403', 'non-admin: draft_status is forbidden');
select tt.throws('select public.save_menu_week(''2026-11-23'', ''[]'')', 'PT403', 'non-admin: save_menu_week is forbidden');
select tt.throws('select public.copy_menu_week(''f4000000-0000-4000-8000-000000000001'', ''2026-11-30'')', 'PT403', 'non-admin: copy_menu_week is forbidden');
select tt.throws('select public.release_menu_week(''f4000000-0000-4000-8000-000000000001'', ''publish_now'')', 'PT403', 'non-admin: release_menu_week is forbidden');
select tt.throws('select public.create_subscription(''f0000000-0000-4000-8000-000000000001'', ''b0000000-0000-4000-8000-000000000001'', ''weekly'', ''2026-12-01'', ''2026-12-07'', 100)', 'PT403', 'non-admin: create_subscription is forbidden');
select tt.throws('select public.void_payment(''f3000000-0000-4000-8000-000000000001'', ''x'')', 'PT403', 'non-admin: void_payment is forbidden');
select tt.throws('select public.anonymise_customer(''f0000000-0000-4000-8000-000000000001'')', 'PT403', 'non-admin: anonymise_customer is forbidden');
select tt.is(tt.count_rows('select 1 from storage.objects where bucket_id = ''media-incoming'''), 0::bigint, 'non-admin cannot see media-incoming objects');
select tt.throws('insert into storage.objects (bucket_id, name, owner_id) values (''media'', ''evil.webp'', ' || quote_literal(:D) || ')', '42501', 'non-admin cannot upload to media');
select tt.throws('insert into storage.objects (bucket_id, name, owner_id) values (''media-incoming'', ''evil.webp'', ' || quote_literal(:D) || ')', '42501', 'non-admin cannot upload to media-incoming');

select tt.as_user(:C::uuid);
select tt.is(tt.count_rows('select 1 from public.' || quote_ident(t)), case t when 'admin_users' then 1::bigint else 0::bigint end,
             'inactive admin sees ' || case t when 'admin_users' then '1 row (own, flagged inactive)' else '0 rows' end || ' in ' || t)
  from unnest(array['admin_users','site_settings','plans','media','customers','subscriptions','payments','audit_log','menu_weeks','content_releases','dashboard_overview']) t;
select tt.throws('insert into public.plans (name) values (''x'')', '42501', 'inactive admin cannot INSERT plans');
select tt.throws('select public.publish_content()', 'PT403', 'inactive admin: publish_content is forbidden');
select tt.throws('select public.void_payment(''f3000000-0000-4000-8000-000000000001'', ''x'')', 'PT403', 'inactive admin: void_payment is forbidden');

-- =============================== admins ===============================
select tt.as_user(:A::uuid);
select tt.ok(tt.count_rows('select 1 from public.' || quote_ident(t)) > 0, 'admin A can read ' || t)
  from unnest(array['site_settings','pricing_rules','ops_settings','media','plans','dishes','addons','faq_entries','page_images',
                    'menu_weeks','menu_slots','content_releases','site_state','customers','subscriptions','subscription_periods',
                    'payments','audit_log','subscription_status','period_payment_status','customer_summary','menu_week_status',
                    'subscription_balance','change_history']) t;
select tt.is(tt.count_rows('select 1 from public.admin_users'), 1::bigint, 'admin A reads only their own admin_users row');
select tt.is(tt.count_rows('select 1 from public.dashboard_overview'), 1::bigint, 'admin A gets the dashboard overview row');
select tt.is(tt.count_rows('select 1 from storage.objects where bucket_id = ''media-incoming'''), 1::bigint, 'admin A sees own incoming upload');
select tt.lives('insert into public.plans (name, unit_price, weekly_price) values (''A plan'', 100, 700)', 'admin can INSERT plans');
select tt.is(tt.affected('update public.plans set audience = ''aud2'' where name = ''A plan'''), 1::bigint, 'admin can UPDATE plans');
select tt.is(tt.affected('delete from public.plans where name = ''A plan'''), 1::bigint, 'admin can DELETE plans');
select tt.is(tt.affected('update public.site_settings set tagline = ''hello'''), 1::bigint, 'admin can UPDATE site_settings');
select tt.is(tt.affected('update public.pricing_rules set team_min_people = 12'), 1::bigint, 'admin can UPDATE pricing_rules');
select tt.is(tt.affected('update public.ops_settings set renewal_window_days = 5'), 1::bigint, 'admin can UPDATE ops_settings');
select tt.lives('insert into public.dishes (name, price) values (''D2'', 450)', 'admin can INSERT dishes');
select tt.lives('insert into public.addons (name, price) values (''A2'', 25)', 'admin can INSERT addons');
select tt.lives('insert into public.faq_entries (question, answer) values (''Q2?'', ''A2.'')', 'admin can INSERT faq_entries');
select tt.lives('insert into public.media (storage_path, alt_text, width, height, bytes) values (''test/two.webp'', ''Alt two'', 800, 600, 5000)', 'admin can INSERT media');
select tt.lives('insert into public.customers (type, name, phone_e164) values (''home'', ''Home Test 2'', ''03002222222'')', 'admin can INSERT customers');
select tt.is(tt.affected('update public.customers set notes = ''n'' where name = ''Home Test 2'''), 1::bigint, 'admin can UPDATE customers');
select tt.lives('insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values (''f0000000-0000-4000-8000-000000000001'', ''f1000000-0000-4000-8000-000000000001'', 500, ''easypaisa'', ''2026-11-20'', ''2026-11-16'', ''2026-11-22'')', 'admin can INSERT payments');
select tt.is(tt.affected('update public.payments set note = ''edited'' where reference = ''JC-T1'''), 1::bigint, 'admin can edit a payment (note)');
-- what admins still cannot do
select tt.throws('delete from public.payments', '42501', 'admin cannot DELETE payments');
select tt.throws('delete from public.customers', '42501', 'admin cannot DELETE customers');
select tt.throws('delete from public.audit_log', '42501', 'admin cannot DELETE audit_log');
select tt.throws('update public.audit_log set actor_label = ''x''', '42501', 'admin cannot UPDATE audit_log');
select tt.throws('insert into public.audit_log (actor_label, action, table_name) values (''forged'', ''x'', ''x'')', '42501', 'admin cannot forge audit_log rows');
select tt.throws('update public.payments set voided_at = now(), void_reason = ''x''', '42501', 'admin cannot void by direct UPDATE (void_payment only)');
select tt.throws('update public.customers set anonymised_at = now()', '42501', 'admin cannot set anonymised_at directly');
select tt.throws('update public.subscriptions set customer_id = ''f0000000-0000-4000-8000-000000000001''', '42501', 'admin cannot reassign a subscription to another customer');
select tt.throws('insert into public.subscriptions (customer_id, plan_id, term, start_date, end_date, amount_per_period) values (''f0000000-0000-4000-8000-000000000001'', ''b0000000-0000-4000-8000-000000000001'', ''weekly'', ''2026-12-01'', ''2026-12-07'', 1)', '42501', 'admin cannot INSERT subscriptions directly');
select tt.throws('update public.content_releases set note = ''x''', '42501', 'admin cannot edit a release');
select tt.throws('update public.site_state set current_release_id = null', '42501', 'admin cannot repoint site_state directly');
select tt.throws('update public.menu_weeks set go_live_at = now()', '42501', 'admin cannot set a go-live time directly');
select tt.throws('insert into public.menu_slots (menu_week_id, day_of_week, meal) values (''f4000000-0000-4000-8000-000000000001'', 1, ''lunch'')', '42501', 'admin cannot write menu slots directly');
select tt.throws('update public.admin_users set role = ''owner''', '42501', 'admin cannot edit admin_users through the API');
select tt.throws('insert into public.admin_users (user_id, display_name) values (' || quote_literal(:D) || ', ''x'')', '42501', 'admin cannot add admins through the API (v1: Supabase dashboard)');
-- storage as admin
select tt.lives('insert into storage.objects (bucket_id, name, owner_id) values (''media'', ''test/by-admin.webp'', ' || quote_literal(:A) || ')', 'admin can write to media');
select tt.lives('insert into storage.objects (bucket_id, name, owner_id) values (''media-incoming'', ''test/mine.webp'', ' || quote_literal(:A) || ')', 'admin can write own incoming upload');
select tt.throws('insert into storage.objects (bucket_id, name, owner_id) values (''media-incoming'', ''test/forged.webp'', ' || quote_literal(:B) || ')', '42501', 'admin cannot write an incoming upload owned by someone else');

select tt.as_user(:B::uuid);
select tt.is(tt.count_rows('select 1 from public.admin_users'), 1::bigint, 'staff admin B reads only own admin_users row');
select tt.is(tt.count_rows('select 1 from storage.objects where bucket_id = ''media-incoming'''), 0::bigint, 'admin B cannot see admin A incoming uploads');
select tt.lives('insert into public.plans (name, unit_price, weekly_price) values (''B plan'', 100, 700)', 'staff admin B can INSERT plans (v1: all admins equal, A-06)');
select tt.lives('select public.draft_status()', 'staff admin B can call draft_status');
