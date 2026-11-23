-- 07_seeds.sql : the seed files load cleanly, are idempotent/guarded, and reproduce the Stage 2 sample overview
-- (tests/unit/admin-mock-repository.test.ts: 4 active + 22 office members, 2 unpaid Rs 12,250, 3 overdue Rs 21,240,
-- 3 renewals due) when evaluated on the sample "today" (Sunday 22 Nov 2026).
select tt.as_postgres();
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\i :ROOT/supabase/seed/01_reference_content.sql

select tt.is((select count(*) from public.plans), 4::bigint, 'reference seed: 4 plans');
select tt.is((select count(*) from public.dishes), 6::bigint, 'reference seed: 6 custom dishes');
select tt.is((select count(*) from public.addons), 6::bigint, 'reference seed: 6 add-ons');
select tt.is((select count(*) from public.faq_entries), 7::bigint, 'reference seed: 7 FAQ entries');
select tt.is((select count(*) from public.menu_slots), 21::bigint, 'reference seed: a 21-slot sample menu week');
select tt.is((select status from public.menu_week_status), 'draft', 'reference seed: the sample week is a draft (not released)');
select tt.is((select count(*) from public.customers), 0::bigint, 'reference seed: no customers, no personal data');
select tt.is((select count(*) from public.content_releases), 0::bigint, 'reference seed: nothing is published');
select tt.is((select weekly_price from public.plans where name = 'Student'), 8050, 'reference seed: Student weekly price 8,050 (= 575 x 14)');
select tt.is((select unit_price from public.plans where name = 'Student'), null::int, 'reference seed: Student per-meal price left unresolved (Q-08)');
select tt.as_user(:A::uuid);
select tt.ok(tt.err('select public.publish_content()') like 'PT400%', 'reference seed alone cannot be published (placeholders + unresolved Student price), as FR-10 / FR-07 require');
select tt.ok(tt.err('select public.publish_content()') like '%plans.10000000-0000-4000-8000-000000000002%', 'the Student plan is named in the publish error');
select tt.ok(tt.err('select public.publish_content()') like '%settings.whatsapp_number%', 'the WhatsApp placeholder is named in the publish error');
select tt.as_postgres();

-- idempotent
\i :ROOT/supabase/seed/01_reference_content.sql
select tt.is((select count(*) from public.plans), 4::bigint, 'reference seed is idempotent (plans)');
select tt.is((select count(*) from public.faq_entries), 7::bigint, 'reference seed is idempotent (faq)');
select tt.is((select count(*) from public.menu_slots), 21::bigint, 'reference seed is idempotent (slots)');

-- synthetic seed
\i :ROOT/supabase/seed/02_synthetic_staging.sql
select tt.is((select count(*) from public.customers), 8::bigint, 'synthetic seed: 8 customers');
select tt.is((select count(*) from public.customers where name !~ 'Sample'), 0::bigint, 'synthetic seed: every customer name is obviously synthetic');
select tt.is((select count(*) from public.customers where phone_e164 !~ '^\+92300000000[0-9]$'), 0::bigint, 'synthetic seed: every phone is 0300-000000x');
select tt.is((select count(*) from public.subscriptions), 8::bigint, 'synthetic seed: 8 subscriptions');
select tt.is((select count(*) from public.subscription_periods), 8::bigint, 'synthetic seed: one period each');
select tt.is((select count(*) from public.payments), 4::bigint, 'synthetic seed: 4 payments');
select tt.is((select count(*) from public.content_releases), 1::bigint, 'synthetic seed: release 1 published (publishing is possible once placeholders are filled)');
select tt.is((public.get_public_content() #>> '{release,version}')::int, 1, 'synthetic seed: visitors see release 1');
select tt.is((public.get_public_content() #>> '{plans,1,unit_price}')::int, 550, 'synthetic seed: release 1 has the Student price 550');
select tt.as_user(:A::uuid);
select tt.is((public.draft_status() ->> 'has_unpublished_changes')::boolean, true, 'synthetic seed: drafts are ahead of the release (Student 575, FAQ), so the indicator shows');
select tt.is((public.draft_status() -> 'changed_areas'), '["Plans", "FAQ"]'::jsonb, 'synthetic seed: pending areas are Plans and FAQ (as in the Stage 2 sample)');
create temp table ov on commit drop as select * from app.dashboard_overview_at('2026-11-22', '2026-11-22 12:00+05');
select tt.is((select active_subscribers from ov), 4, 'Stage 2 parity: 4 active subscribers');
select tt.is((select office_members from ov), 22, 'Stage 2 parity: 22 office members');
select tt.is((select unpaid_count || '/' || unpaid_total from ov), '2/12250', 'Stage 2 parity: 2 unpaid, Rs 12,250');
select tt.is((select overdue_count || '/' || overdue_total from ov), '3/21240', 'Stage 2 parity: 3 overdue, Rs 21,240');
select tt.is((select renewal_due_count from ov), 3, 'Stage 2 parity: 3 renewals due');
select tt.is((select total_customers from ov), 8, 'Stage 2 parity: 8 customers');
select tt.is((select live_menu_week_start from app.dashboard_overview_at('2026-11-22', '2026-11-22 19:00+05')), date '2026-11-23', 'sample Sunday 19:00: the 23 Nov week has gone live (released 22 Nov 18:00)');
select tt.is((select scheduled_menu_week_start from app.dashboard_overview_at('2026-11-22', '2026-11-22 19:00+05')), date '2026-11-30', 'sample Sunday 19:00: the 30 Nov week is the scheduled one');
select tt.is((select live_menu_week_start from app.dashboard_overview_at('2026-11-22', '2026-11-22 12:00+05')), null::date, 'sample Sunday 12:00: nothing is live yet (the 23 Nov week goes live at 18:00)');
select tt.is((select count(*) from app.menu_week_status_at('2026-11-22 19:00+05') where status = 'scheduled' and differs_from_released), 0::bigint, 'seed: the scheduled week''s snapshot equals its working copy');
select tt.is((select differs_from_released from app.menu_week_status_at('2026-11-23 12:00+05') where week_start = '2026-11-23'), true, 'sample: the live week has one pending edit (Friday dinner), like the Stage 2 sample');
select tt.as_postgres();

-- seed 03 (CR-004): the 23 Nov 2026 app spec applied on top of seeds 01 and 02 (appended last so the assertions above keep their state)
create temp table s_before on commit drop as select to_jsonb(s) as j from public.site_settings s;
create temp table menu_before on commit drop as select count(*) as n from public.menu_slots;
\i :ROOT/supabase/seed/03_app_spec_content.sql
select tt.is((select count(*) from public.plans where is_active), 5::bigint, 'app-spec seed: 5 active plans');
select tt.is((select name from public.plans order by sort_order, id limit 1), 'Starter', 'app-spec seed: Starter is first');
select tt.is((select tag || '/' || period_label from public.plans where name = 'Starter'), 'New/for 3 days', 'app-spec seed: Starter has the New tag and the "for 3 days" period');
select tt.is((select unit_price || '-' || unit_price_to from public.plans where name = 'Student'), '750-800', 'app-spec seed: Student is the range 750-800');
select tt.is((select weekly_price from public.plans where name = 'Student'), 10850, 'app-spec seed: Student weekly price 10,850');
select tt.is((select price_note from public.plans where name = 'Student'), '', 'app-spec seed: the old Student price note is cleared');
select tt.is((select count(*) from public.plans where is_most_popular), 1::bigint, 'app-spec seed: exactly one most-popular plan');
select tt.is((select count(*) from public.faq_entries where not is_hidden), 12::bigint, 'app-spec seed: 12 FAQ entries');
select tt.is((select question from public.faq_entries order by sort_order limit 1 offset 2), 'Why is there a delivery charge?', 'app-spec seed: the FAQ follows the spec order');
select tt.is((select breakfast_addon_price || '/' || delivery_charge || '/' || late_night_meal_price || '/' || late_night_surcharge from public.pricing_rules), '550/150/650/100', 'app-spec seed: breakfast 550, delivery 150, late-night meal 650 plus 100');
select tt.is((select count(*) from public.dishes), 6::bigint, 'app-spec seed leaves the 6 dishes alone');
select tt.is((select to_jsonb(s) from public.site_settings s), (select j from s_before), 'app-spec seed leaves every site setting alone (no invented WhatsApp number, hours, name, boundary)');
select tt.is((select count(*) from public.content_releases), 1::bigint, 'app-spec seed publishes nothing');
select tt.is((public.get_public_content() #>> '{plans,0,name}'), 'Budget', 'app-spec seed: visitors still see the old release until a publish');
select tt.is((app.build_content_document() #>> '{plans,0,tag}'), 'New', 'draft document carries the plan tag');
select tt.is((app.build_content_document() #>> '{plans,2,unit_price_to}')::int, 800, 'draft document carries the price range end');
select tt.is((app.build_content_document() #>> '{plans,0,period_label}'), 'for 3 days', 'draft document carries the period label');
select tt.is((app.build_content_document() #>> '{pricing_rules,late_night_meal_price}')::int, 650, 'draft document carries the late-night meal price');
select tt.is((app.build_content_document() #>> '{pricing_rules,delivery_charge}')::int, 150, 'draft document carries the delivery charge');
select tt.throws('update public.plans set unit_price_to = unit_price where name = ''Student''', '23514', 'a price range end must be above the start');
-- idempotent
\i :ROOT/supabase/seed/03_app_spec_content.sql
select tt.is((select count(*) from public.plans), 5::bigint, 'app-spec seed is idempotent (plans)');
select tt.is((select count(*) from public.faq_entries), 12::bigint, 'app-spec seed is idempotent (faq)');
select tt.is((select count(*) from public.menu_slots), (select n from menu_before), 'app-spec seed leaves the menu alone');
