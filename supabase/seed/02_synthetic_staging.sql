-- seed/02_synthetic_staging.sql
-- SYNTHETIC DATA for LOCAL and STAGING ONLY. NEVER run on production. NEVER real people (NFR-12).
-- Mirrors the Stage 2 sample set (src/admin/mock/seed.ts): names "Student Sample 01", phones 0300-000000x,
-- reference numbers EP-0001... all obviously fake. Requires seed/01_reference_content.sql first.
-- Run as a role that bypasses RLS (postgres / the migration role). Audit rows are written as actor "system".
--
-- "Sample today" in the Stage 2 mock is Sunday 22 Nov 2026. Statuses here are computed against the REAL
-- date, so as time passes these sample subscriptions become expired/overdue, as they would in reality.

do $$
begin
  if exists (select 1 from public.customers where name !~ 'Sample') then
    raise exception 'Refusing to seed synthetic data: this database has customers that are not synthetic samples. Is this production?';
  end if;
end $$;

-- Make the site publishable with obviously synthetic values, and resolve the Student price for staging.
update public.site_settings set whatsapp_number = '920000000000', order_hours = 'Sample hours (placeholder)',
  delivery_boundary_text = 'Sample boundary (placeholder)', legal_name_and_address = 'Sample legal name, sample address (placeholder)'
where id = 1;
update public.plans set unit_price = 550, price_note = 'SYNTHETIC: Q-08 resolved arbitrarily for staging only.'
where id = '10000000-0000-4000-8000-000000000002';

-- Release 1 as live (like the mock's live version), then leave drafts slightly ahead of it so the
-- "unpublished changes" indicator has something to show: Student price 575 and an FAQ answer.
select app.do_publish('synthetic seed: first release', null);
update public.plans set unit_price = 575 where id = '10000000-0000-4000-8000-000000000002';
update public.faq_entries set answer = 'JazzCash, Easypaisa or bank transfer.' where id = '13000000-0000-4000-8000-000000000005';

-- Customers (8) ------------------------------------------------------------------------------
insert into public.customers (id, type, name, phone_e164, address_text, org_name, contact_person, member_count) values
  ('20000000-0000-4000-8000-000000000001', 'student', 'Student Sample 01', '03000000001', 'Hostel Sample A, Room 12, Johar Town', '', '', null),
  ('20000000-0000-4000-8000-000000000002', 'student', 'Student Sample 02', '03000000002', 'Hostel Sample B, Room 3, Johar Town',  '', '', null),
  ('20000000-0000-4000-8000-000000000003', 'home',    'Home Sample 03',    '03000000003', 'House Sample 3, Street 4, Johar Town',  '', '', null),
  ('20000000-0000-4000-8000-000000000004', 'office',  'Office Sample Ltd.','03000000004', 'Ltd Sample Building, Block B', 'Office Sample Ltd.', 'Contact Person 04 (sample)', 12),
  ('20000000-0000-4000-8000-000000000005', 'student', 'Student Sample 05', '03000000005', 'Hostel Sample A, Room 21, Johar Town', '', '', null),
  ('20000000-0000-4000-8000-000000000006', 'office',  'Office Sample Traders', '03000000006', 'Traders Sample Building, Block C', 'Office Sample Traders', 'Contact Person 06 (sample)', 10),
  ('20000000-0000-4000-8000-000000000007', 'home',    'Home Sample 07',    '03000000007', 'House Sample 7, Street 9, Johar Town',  '', '', null),
  ('20000000-0000-4000-8000-000000000008', 'student', 'Student Sample 08', '03000000008', 'Hostel Sample C, Room 5, Johar Town',  '', '', null);

-- Subscriptions and their single period each (due the day before the start, A-22) ----------------
insert into public.subscriptions (id, customer_id, plan_id, term, start_date, end_date, amount_per_period, manual_state, manual_state_on) values
  ('30000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'monthly', '2026-11-09', '2026-12-06', 30590, 'active', null),
  ('30000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-16', '2026-11-22', 4200,  'paused', '2026-11-20'),
  ('30000000-0000-4000-8000-0000000000a3', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'weekly',  '2026-11-16', '2026-11-22', 10500, 'active', null),
  ('30000000-0000-4000-8000-0000000000a4', '20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'monthly', '2026-11-01', '2026-11-28', 12540, 'active', null),
  ('30000000-0000-4000-8000-0000000000a5', '20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'weekly',  '2026-11-23', '2026-11-29', 8050,  'active', null),
  ('30000000-0000-4000-8000-0000000000a6', '20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'monthly', '2026-11-01', '2026-11-28', 12540, 'active', null),
  ('30000000-0000-4000-8000-0000000000a7', '20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-23', '2026-11-29', 4200,  'active', null),
  ('30000000-0000-4000-8000-0000000000a8', '20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-09', '2026-11-15', 4200,  'active', null);

insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date)
select s.id, s.start_date, s.end_date, s.amount_per_period, s.start_date - 1
from public.subscriptions s where s.id::text like '30000000-0000-4000-8000-0000000000a%';

-- Payments (4): two full, one part payment (6,000 of 12,540), the rest unpaid ----------------------
insert into public.payments (id, customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference) values
  ('50000000-0000-4000-8000-0000000000b1', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-0000000000a1', 30590, 'easypaisa',     '2026-11-08', '2026-11-09', '2026-12-06', 'EP-0001'),
  ('50000000-0000-4000-8000-0000000000b2', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-0000000000a2', 4200,  'jazzcash',      '2026-11-15', '2026-11-16', '2026-11-22', 'JC-0002'),
  ('50000000-0000-4000-8000-0000000000b3', '20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-0000000000a4', 12540, 'bank_transfer', '2026-10-31', '2026-11-01', '2026-11-28', 'BT-0003'),
  ('50000000-0000-4000-8000-0000000000b4', '20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-0000000000a6', 6000,  'bank_transfer', '2026-10-31', '2026-11-01', '2026-11-28', 'BT-0004');

-- Menu: week of 23 Nov released at 22 Nov 18:00 (+05:00); week of 30 Nov scheduled for 29 Nov 18:00 ----
update public.menu_weeks set go_live_at = '2026-11-22T18:00:00+05:00',
       live_payload = app.menu_snapshot(id), live_set_at = '2026-11-22T18:00:00+05:00'
 where id = '14000000-0000-4000-8000-000000000001';
-- one slot edited since release (a pending menu change): Friday dinner
update public.menu_slots set dish_text = 'Maash daal'
 where menu_week_id = '14000000-0000-4000-8000-000000000001' and day_of_week = 5 and meal = 'dinner';
update public.menu_weeks set live_payload = app.menu_snapshot(id)
 where id = '14000000-0000-4000-8000-000000000001';
update public.menu_slots set dish_text = 'Maash daal + roti'
 where menu_week_id = '14000000-0000-4000-8000-000000000001' and day_of_week = 5 and meal = 'dinner';

insert into public.menu_weeks (id, week_start) values ('14000000-0000-4000-8000-000000000002', '2026-11-30');
insert into public.menu_slots (menu_week_id, day_of_week, meal, dish_text)
select '14000000-0000-4000-8000-000000000002', d.day_of_week, m.meal, d.dishes[m.ord]
from (values
  (1, array['Aloo paratha, raita, chai',  'Chicken pulao + raita', 'Daal mash + roti']),
  (2, array['Omelette, paratha, chai',    'Mix sabzi + roti',      'Chicken karahi + roti']),
  (3, array['Halwa puri',                 'Daal chana + roti',     'Aloo gobi + roti']),
  (4, array['Fried egg, paratha, chai',   'Kofta + roti',          'Chicken biryani + raita']),
  (5, array['Aloo paratha, raita, chai',  'Karhi pakora',          'Daal chawal']),
  (6, array['Omelette, paratha, chai',    'White chanay + roti',   'Fried fish + salad']),
  (7, array['Boiled eggs, paratha, chai', 'Saag + roti',           'Chicken qorma + roti'])
) as d(day_of_week, dishes)
cross join (values (1, 'breakfast'), (2, 'lunch'), (3, 'dinner')) as m(ord, meal);
update public.menu_weeks set go_live_at = '2026-11-29T18:00:00+05:00',
       live_payload = app.menu_snapshot(id), live_set_at = '2026-11-22T18:30:00+05:00'
 where id = '14000000-0000-4000-8000-000000000002';
