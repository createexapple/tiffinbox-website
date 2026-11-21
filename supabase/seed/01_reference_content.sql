-- seed/01_reference_content.sql
-- REFERENCE CONTENT from the client brief (docs/PRD.md "Reference data from the brief"; values mirror
-- src/content/mock.ts). UNCONFIRMED: prices and menu are sample content until the client answers
-- Q-07, Q-08, Q-10, Q-26; bracketed values are placeholders for facts we do not have (Q-04 WhatsApp number,
-- Q-06 order hours, Q-11 delivery boundary, Q-27 legal name/address).
--
-- Content only: no customers, no personal data. Safe for local, staging AND (by the CEO, not by agents)
-- production as a starting draft. It writes DRAFT tables only; nothing is published, and publishing stays
-- blocked until the placeholders and the Student price are resolved (FR-10, Q-08), which is intended.
-- Idempotent: re-running restores these rows to the reference values.
-- Run as a role that bypasses RLS (postgres / the migration role), e.g.:  psql -f seed/01_reference_content.sql

update public.site_settings set
  business_name          = 'Tiffin Box',
  tagline                = 'Ghar ka khana, Ammi ke pyaar jaisa',
  whatsapp_number        = '[WhatsApp number]',
  instagram_handle       = 'tiffinbox.lhr',
  order_hours            = '[order hours]',
  last_order_time        = '',
  area_served            = 'Johar Town, Lahore',
  delivery_area_text     = 'Johar Town, Lahore, including hostels, offices and homes around UMT. Other areas will be added later.',
  delivery_boundary_text = '[delivery area text, Q-11]',
  legal_name_and_address = '[Business legal name / address]',
  delivery_times         = '{"breakfast":"08:00","lunch":"13:00","dinner":"20:00"}',
  skip_cutoffs           = '{"breakfast":"22:00","lunch":"10:00","dinner":"17:00"}',
  skip_cutoff_days       = '{"breakfast":"night_before","lunch":"same_day","dinner":"same_day"}',
  skips_per_week         = 3,
  payment_methods        = '["JazzCash","Easypaisa","bank transfer"]'
where id = 1;

update public.pricing_rules set
  monthly_saving_percent = 5,
  breakfast_addon_price  = 350,
  team_deal_text         = 'a team discount and one monthly invoice',
  team_min_people        = 10
where id = 1;

update public.ops_settings set renewal_window_days = 7, overdue_grace_days = 0,
  monthly_period_rule = '4_weeks', menu_go_live_time = '18:00' where id = 1;

-- Plans. Student: the brief prints Rs 550-600 per meal (Q-08); unit_price stays NULL until the client
-- confirms ONE figure, so publishing is blocked, as FR-07 requires. weekly_price 8,050 = 575 x 14.
insert into public.plans (id, name, audience, meals_included, price_unit, unit_price, weekly_price, is_most_popular, is_active, sort_order, price_note) values
  ('10000000-0000-4000-8000-000000000001', 'Budget',       'Hostel students',                'Lunch + dinner, daal or sabzi + 2 roti', 'per_meal', 300,  4200,  false, true, 1, ''),
  ('10000000-0000-4000-8000-000000000002', 'Student',      'Students wanting the full menu', 'Lunch + dinner, full weekly menu',       'per_meal', null, 8050,  true,  true, 2, 'The brief prints a range (Rs 550-600 per meal). Client to confirm one price (Q-08); the plan cannot be published until then.'),
  ('10000000-0000-4000-8000-000000000003', 'Office Lunch', 'Offices and working people',     'Lunch only, Mon-Sat, by 1 PM',           'per_meal', 550,  3300,  false, true, 3, ''),
  ('10000000-0000-4000-8000-000000000004', 'All 3 Meals',  'People who don''t cook at all',  'Breakfast + lunch + dinner',             'per_day',  1500, 10500, false, true, 4, 'Priced per day, not per meal.')
on conflict (id) do update set name = excluded.name, audience = excluded.audience, meals_included = excluded.meals_included,
  price_unit = excluded.price_unit, unit_price = excluded.unit_price, weekly_price = excluded.weekly_price,
  is_most_popular = excluded.is_most_popular, is_active = excluded.is_active, sort_order = excluded.sort_order,
  price_note = excluded.price_note;

insert into public.dishes (id, name, comes_with, price, sort_order) values
  ('11000000-0000-4000-8000-000000000001', 'Daal or sabzi',   '2 roti',         400, 1),
  ('11000000-0000-4000-8000-000000000002', 'Daal chawal',     'Full plate',     550, 2),
  ('11000000-0000-4000-8000-000000000003', 'Chicken qorma',   'Half + 2 roti',  650, 3),
  ('11000000-0000-4000-8000-000000000004', 'Aloo qeema',      'Half + 2 roti',  650, 4),
  ('11000000-0000-4000-8000-000000000005', 'Chicken biryani', 'Full plate',     700, 5),
  ('11000000-0000-4000-8000-000000000006', 'Fried fish',      '250 g + 2 roti', 750, 6)
on conflict (id) do update set name = excluded.name, comes_with = excluded.comes_with, price = excluded.price, sort_order = excluded.sort_order;

insert into public.addons (id, name, price, sort_order) values
  ('12000000-0000-4000-8000-000000000001', 'Achaar',      30, 1),
  ('12000000-0000-4000-8000-000000000002', 'Ketchup',     20, 2),
  ('12000000-0000-4000-8000-000000000003', 'Raita',       80, 3),
  ('12000000-0000-4000-8000-000000000004', 'Salad',       80, 4),
  ('12000000-0000-4000-8000-000000000005', 'Extra roti',  30, 5),
  ('12000000-0000-4000-8000-000000000006', 'Shami kebab', 90, 6)
on conflict (id) do update set name = excluded.name, price = excluded.price, sort_order = excluded.sort_order;

insert into public.faq_entries (id, question, answer, sort_order) values
  ('13000000-0000-4000-8000-000000000001', 'Where do you deliver?', 'Johar Town, Lahore, including hostels and offices around UMT. More areas are coming soon.', 1),
  ('13000000-0000-4000-8000-000000000002', 'When does food arrive?', 'Breakfast by 8 AM, lunch by 1 PM and dinner by 8 PM.', 2),
  ('13000000-0000-4000-8000-000000000003', 'Can I change a dish I don''t like?', 'Yes. Swap it for any dish on our Customize list; custom dishes cost a little more.', 3),
  ('13000000-0000-4000-8000-000000000004', 'What if I go home for a few days?', 'Skip up to 3 meals a week, or pause your plan on WhatsApp. Skipped meals are added to the end of your plan.', 4),
  ('13000000-0000-4000-8000-000000000005', 'How do I pay?', 'JazzCash, Easypaisa or bank transfer, before your week or month starts.', 5),
  ('13000000-0000-4000-8000-000000000006', 'Is there a discount for offices?', 'Yes. Teams of 10 or more get a discount and one monthly bill.', 6),
  ('13000000-0000-4000-8000-000000000007', 'How do I start?', 'Send "HI" on WhatsApp. Your first meal can arrive the next day.', 7)
on conflict (id) do update set question = excluded.question, answer = excluded.answer, sort_order = excluded.sort_order;

-- Sample menu week from the brief (Mon 23 Nov 2026), as a DRAFT (not released).
insert into public.menu_weeks (id, week_start) values ('14000000-0000-4000-8000-000000000001', '2026-11-23')
on conflict (id) do nothing;

insert into public.menu_slots (menu_week_id, day_of_week, meal, dish_text)
select '14000000-0000-4000-8000-000000000001', d.day_of_week, m.meal, d.dishes[m.ord]
from (values
  (1, array['Aloo paratha, raita, chai',   'Aloo qeema + roti',   'Chicken biryani + raita']),
  (2, array['Omelette, paratha, chai',     'Daal chana + roti',   'Chicken qorma + roti']),
  (3, array['Mooli paratha, raita, chai',  'Mix sabzi + roti',    'Daal chawal']),
  (4, array['Fried egg, paratha, chai',    'Karhi pakora',        'Aloo qeema + shami kebab']),
  (5, array['Aloo paratha, raita, chai',   'Chicken biryani',     'Maash daal + roti']),
  (6, array['Omelette, paratha, chai',     'White chanay + roti', 'Fried fish + salad']),
  (7, array['Boiled eggs, paratha, chai',  'Saag + roti',         'Chicken qorma + roti'])
) as d(day_of_week, dishes)
cross join (values (1, 'breakfast'), (2, 'lunch'), (3, 'dinner')) as m(ord, meal)
on conflict (menu_week_id, day_of_week, meal) do update set dish_text = excluded.dish_text;
