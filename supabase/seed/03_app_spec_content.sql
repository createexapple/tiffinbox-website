-- seed/03_app_spec_content.sql
-- Applies the 23 Nov 2026 "Full Spec to Match the App" (change request CR-004) on top of seed 01: the new pricing rule
-- (plan meal = old meal price + Rs 50 service + Rs 150 delivery), five plans with Starter first, the delivery and
-- late-night prices, and the 12-question FAQ.
--
-- Meant to be pasted into the Supabase SQL Editor or run with psql by the operator, after migration
-- 20261123000013_app_spec_fields.sql:   psql -f seed/03_app_spec_content.sql
-- It is NOT run by CI against the hosted project.
--
-- Content only: no customers, no personal data. Writes DRAFT tables only; nothing is published (use Publish in the admin).
-- Idempotent: re-running restores these rows to the values below.
-- Deliberately NOT set (the client has not supplied them): WhatsApp number, order hours, legal name and address,
-- delivery boundary, "our story". Dishes and add-ons already match the spec (prices unchanged) and are left alone.

update public.pricing_rules set
  breakfast_addon_price = 550,
  delivery_charge       = 150,
  late_night_meal_price = 650,
  late_night_surcharge  = 100
where id = 1;

-- Plans: the four from seed 01 keep their ids; Starter is new. Student shows a range (Rs 750-800 a meal).
-- weekly_price holds the total for the plan's period (Starter: 3 days, see period_label).
insert into public.plans (id, name, audience, meals_included, price_unit, unit_price, unit_price_to, weekly_price,
                          is_most_popular, is_active, sort_order, price_note, tag, period_label) values
  ('10000000-0000-4000-8000-000000000005', 'Starter',      'Try us for 3 days',              'Lunch + dinner, full menu, 3 days',            'per_meal', 800,  null, 4800,  false, true, 1, '', 'New',      'for 3 days'),
  ('10000000-0000-4000-8000-000000000001', 'Budget',       'Hostel students',                'Lunch + dinner, daal or sabzi + 2 roti',       'per_meal', 500,  null, 7000,  false, true, 2, '', 'Cheapest', ''),
  ('10000000-0000-4000-8000-000000000002', 'Student',      'Students wanting the full menu', 'Lunch + dinner, full weekly menu',             'per_meal', 750,  800,  10850, true,  true, 3, '', '',         ''),
  ('10000000-0000-4000-8000-000000000003', 'Office Lunch', 'Offices and working people',     'Lunch only, Mon–Sat, by 1 PM',                 'per_meal', 750,  null, 4500,  false, true, 4, '', '',         ''),
  ('10000000-0000-4000-8000-000000000004', 'All 3 Meals',  'People who don''t cook at all',  'Breakfast + lunch + dinner',                   'per_day',  2100, null, 14700, false, true, 5, 'Priced per day, not per meal.', '', '')
on conflict (id) do update set name = excluded.name, audience = excluded.audience, meals_included = excluded.meals_included,
  price_unit = excluded.price_unit, unit_price = excluded.unit_price, unit_price_to = excluded.unit_price_to,
  weekly_price = excluded.weekly_price, is_most_popular = excluded.is_most_popular, is_active = excluded.is_active,
  sort_order = excluded.sort_order, price_note = excluded.price_note, tag = excluded.tag, period_label = excluded.period_label;

-- FAQ: the 12 questions of the spec, in order. Seven ids come from seed 01; five are new.
insert into public.faq_entries (id, question, answer, sort_order, is_hidden) values
  ('13000000-0000-4000-8000-000000000001', 'Where do you deliver?', 'Johar Town, Lahore, including hostels and offices around UMT. More areas soon.', 1, false),
  ('13000000-0000-4000-8000-000000000002', 'When does food arrive?', 'Breakfast by 8 AM, lunch by 1 PM, dinner by 8 PM, late night 11 PM – 1 AM.', 2, false),
  ('13000000-0000-4000-8000-000000000008', 'Why is there a delivery charge?', 'We bring every meal door to door. Rs 150 per delivery is already included in plan prices.', 3, false),
  ('13000000-0000-4000-8000-000000000009', 'Can I try before a full week?', 'Yes. The Starter plan is 3 days of lunch and dinner for Rs 4,800.', 4, false),
  ('13000000-0000-4000-8000-00000000000a', 'Can I order for my family?', 'Yes. Everyone at one address shares one Rs 150 delivery; each extra person pays the meal price only.', 5, false),
  ('13000000-0000-4000-8000-00000000000b', 'Guests are coming. Can you cater?', 'Yes. Order 1 day ahead, pick dishes from the Customize list, and pay one Rs 150 delivery.', 6, false),
  ('13000000-0000-4000-8000-00000000000c', 'Do you deliver late at night?', 'Yes, 11 PM to 1 AM, Rs 900 a night. Order before 9 PM.', 7, false),
  ('13000000-0000-4000-8000-000000000003', 'Can I change a dish I don''t like?', 'Yes. Swap it for any dish on the Customize list; Rs 150 delivery is added.', 8, false),
  ('13000000-0000-4000-8000-000000000004', 'What if I go home for a few days?', 'Skip up to 3 meals a week, or pause your plan on WhatsApp.', 9, false),
  ('13000000-0000-4000-8000-000000000005', 'How do I pay?', 'JazzCash, Easypaisa or bank transfer, before your days start.', 10, false),
  ('13000000-0000-4000-8000-000000000006', 'Is there a discount for offices?', 'Yes. Teams of 10 or more get a discount and one monthly bill.', 11, false),
  ('13000000-0000-4000-8000-000000000007', 'How do I start?', 'Send "HI" on WhatsApp. Your first meal can arrive the next day.', 12, false)
on conflict (id) do update set question = excluded.question, answer = excluded.answer,
  sort_order = excluded.sort_order, is_hidden = excluded.is_hidden;
