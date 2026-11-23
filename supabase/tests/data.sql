-- Shared minimal data set (superuser). Included by tests that need rows in every table. All synthetic.
select tt.as_postgres();

update public.site_settings set whatsapp_number = '920000000001', instagram_handle = 'test.handle',
  order_hours = '9am to 9pm', delivery_area_text = 'Test area',
  delivery_times = '{"breakfast":"08:00","lunch":"13:00","dinner":"20:00"}',
  skip_cutoffs = '{"breakfast":"22:00","lunch":"10:00","dinner":"17:00"}' where id = 1;

insert into public.media (id, storage_path, file_name, alt_text, width, height, bytes)
values ('a0000000-0000-4000-8000-000000000001', 'test/hash-1.webp', 'one.webp', 'Alt one', 1600, 1200, 100000);
insert into public.page_images (slot_key, media_id) values ('home_hero', 'a0000000-0000-4000-8000-000000000001');

insert into public.plans (id, name, audience, meals_included, price_unit, unit_price, weekly_price, is_most_popular, is_active, sort_order)
values ('b0000000-0000-4000-8000-000000000001', 'Plan One', 'aud', 'meals', 'per_meal', 300, 4200, true, true, 1),
       ('b0000000-0000-4000-8000-000000000002', 'Plan Two', 'aud', 'meals', 'per_day', 1500, 10500, false, true, 2);
insert into public.dishes (id, name, comes_with, price, media_id, sort_order)
values ('c0000000-0000-4000-8000-000000000001', 'Dish One', 'rice', 400, 'a0000000-0000-4000-8000-000000000001', 1);
insert into public.addons (id, name, price, sort_order) values ('d0000000-0000-4000-8000-000000000001', 'Addon One', 30, 1);
insert into public.faq_entries (id, question, answer, sort_order) values ('e0000000-0000-4000-8000-000000000001', 'Q one?', 'A one.', 1);

insert into public.customers (id, type, name, phone_e164, address_text)
values ('f0000000-0000-4000-8000-000000000001', 'student', 'Student Test 1', '03001111111', 'Test hostel');
insert into public.subscriptions (id, customer_id, plan_id, term, start_date, end_date, amount_per_period)
values ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-11-16', '2026-11-22', 4200);
insert into public.subscription_periods (id, subscription_id, period_start, period_end, amount_due, due_date)
values ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', '2026-11-16', '2026-11-22', 4200, '2026-11-15');
insert into public.payments (id, customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference)
values ('f3000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
        'f1000000-0000-4000-8000-000000000001', 1000, 'jazzcash', '2026-11-15', '2026-11-16', '2026-11-22', 'JC-T1');

-- a menu week with 21 slots, released now so it is live
insert into public.menu_weeks (id, week_start) values ('f4000000-0000-4000-8000-000000000001', '2026-11-16');
insert into public.menu_slots (menu_week_id, day_of_week, meal, dish_text)
select 'f4000000-0000-4000-8000-000000000001', d, m, 'Dish d' || d || ' ' || m
from generate_series(1, 7) d cross join unnest(array['breakfast','lunch','dinner']) m;
update public.menu_weeks set go_live_at = now() - interval '1 hour', live_payload = app.menu_snapshot(id), live_set_at = now()
 where id = 'f4000000-0000-4000-8000-000000000001';

select app.do_publish('test release', null);
