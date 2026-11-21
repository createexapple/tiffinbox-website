-- 03_payments.sql : payment allocation (oldest period first), partial and multi-period payments (Q-35),
-- void, balances/credit, money and customer constraints, create_subscription (architecture 6.5, 9.2, 9.4;
-- FR-24, FR-26, FR-28, FR-29; A-20, A-25).
select tt.as_postgres();
insert into public.plans (id, name, unit_price, weekly_price) values ('b0000000-0000-4000-8000-000000000001', 'Plan Original', 100, 700);
insert into public.customers (id, type, name, phone_e164) values
  ('11000000-0000-4000-8000-000000000001', 'student', 'Pay Sample 1', '03000000001'),
  ('11000000-0000-4000-8000-000000000002', 'student', 'Pay Sample 2', '03000000002');
-- three monthly-style periods on one subscription (Q-10/Q-35: more periods on the same subscription); inserted OUT of date order on purpose
insert into public.subscriptions (id, customer_id, plan_id, term, start_date, end_date, amount_per_period)
  values ('12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'monthly', '2026-11-01', '2027-01-28', 1000);
insert into public.subscription_periods (id, subscription_id, period_start, period_end, amount_due, due_date) values
  ('13000000-0000-4000-8000-000000000003', '12000000-0000-4000-8000-000000000001', '2026-12-30', '2027-01-28', 1000, '2026-12-29'),
  ('13000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-28', 1000, '2026-10-31'),
  ('13000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000001', '2026-11-29', '2026-12-29', 1000, '2026-11-28');

create function tt.pp(p_n int) returns table (paid int, balance int, status text) language sql stable as $$
  select paid, balance, status from app.period_payment_status_at('2026-12-01') where period_id = ('13000000-0000-4000-8000-00000000000' || p_n)::uuid $$;
create function tt.pay(p_amount int, p_ref text) returns void language sql as $$
  insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference)
  values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', p_amount, 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-28', p_ref) $$;

-- no payments: nothing paid; period 1 and 2 are past due on 1 Dec, period 3 is not
select tt.is((select status from tt.pp(1)), 'overdue', 'no payment: period 1 overdue on 1 Dec');
select tt.is((select status from tt.pp(2)), 'overdue', 'no payment: period 2 overdue on 1 Dec (due 28 Nov)');
select tt.is((select status from tt.pp(3)), 'unpaid',  'no payment: period 3 not yet due');

-- a part payment goes to the OLDEST period first (A-25; arch 9.2)
select tt.pay(400, 'P-1');
select tt.is((select paid from tt.pp(1)), 400, 'part payment 400 lands on the oldest period');
select tt.is((select balance from tt.pp(1)), 600, 'oldest period shows the remaining balance 600');
select tt.is((select paid from tt.pp(2)), 0, 'later periods get nothing until the oldest is covered');
-- a second payment completes period 1 and spills into period 2 (order of insertion of periods does not matter)
select tt.pay(1100, 'P-2');
select tt.is((select paid from tt.pp(1)), 1000, '400 + 1100 = 1500: oldest period fully paid');
select tt.is((select status from tt.pp(1)), 'paid', 'oldest period is paid');
select tt.is((select paid from tt.pp(2)), 500, 'the remaining 500 spills into the second period');
select tt.is((select balance from tt.pp(2)), 500, 'second period balance 500');
select tt.is((select status from tt.pp(2)), 'overdue', 'second period is part paid and past due: overdue');
select tt.is((select paid from tt.pp(3)), 0, 'third period untouched');
-- one payment covering two periods at once (Q-35)
select tt.pay(1500, 'P-3');
select tt.is((select status from tt.pp(2)), 'paid', 'one big payment pays period 2 ...');
select tt.is((select paid from tt.pp(3)), 1000, '... and fully covers period 3 (3000 total)');
select tt.is((select status from tt.pp(3)), 'paid', 'all three periods paid');
select tt.is((select balance from public.subscription_balance where subscription_id = '12000000-0000-4000-8000-000000000001'), 0::bigint, 'subscription balance is 0 when fully paid');
-- overpayment becomes credit, never lost and never assigned to a period
select tt.pay(250, 'P-4');
select tt.is((select credit from public.subscription_balance where subscription_id = '12000000-0000-4000-8000-000000000001'), 250::bigint, 'overpayment of 250 is reported as credit');
select tt.is((select paid from tt.pp(3)), 1000, 'overpayment is not added to any period (paid is capped at the amount due)');

-- void (via the function, as an admin): the row stays, totals update, history keeps the original values
select tt.as_user('aaaaaaaa-0000-4000-8000-00000000000a'::uuid);
select tt.lives($$select public.void_payment((select id from public.payments where reference = 'P-3'), 'entered twice')$$, 'admin can void a payment with a reason');
select tt.as_postgres();
select tt.is((select count(*) from public.payments where reference = 'P-3'), 1::bigint, 'a voided payment row is kept');
select tt.is((select void_reason from public.payments where reference = 'P-3'), 'entered twice', 'void reason is stored');
select tt.is((select amount from public.payments where reference = 'P-3'), 1500, 'voided payment keeps its original amount');
select tt.is((select paid from tt.pp(2)), 750, 'after voiding 1500: 1750 remain, period 2 is back to 750 paid');
select tt.is((select status from tt.pp(3)), 'unpaid', 'after voiding: period 3 is unpaid again (due 29 Dec, not yet overdue on 1 Dec)');
select tt.is((select credit from public.subscription_balance where subscription_id = '12000000-0000-4000-8000-000000000001'), 0::bigint, 'credit disappears when the overpayment is voided');
select tt.is((select balance from public.subscription_balance where subscription_id = '12000000-0000-4000-8000-000000000001'), 1250::bigint, 'subscription balance after void: 3000 due - 1750 paid');
select tt.as_user('aaaaaaaa-0000-4000-8000-00000000000a'::uuid);
select tt.throws($$select public.void_payment((select id from public.payments where reference = 'P-3'), 'again')$$, 'PT400', 'a payment cannot be voided twice');
select tt.throws($$select public.void_payment((select id from public.payments where reference = 'P-1'), '   ')$$, 'PT400', 'void requires a reason');
select tt.throws($$select public.void_payment('00000000-0000-4000-8000-000000000000', 'x')$$, 'PT404', 'voiding an unknown payment is a 404');
select tt.blocked($$update public.payments set note = 'edit' where reference = 'P-3'$$, 'a voided payment cannot be edited by an admin (RLS hides it from UPDATE)');
select tt.as_postgres();
select tt.throws($$update public.payments set note = 'edit' where reference = 'P-3'$$, '42501', 'a voided payment cannot be edited by anyone (trigger)');

-- allocation is per subscription: another subscription's payments do not leak across
insert into public.subscriptions (id, customer_id, plan_id, term, start_date, end_date, amount_per_period)
  values ('12000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-11-16', '2026-11-22', 500);
insert into public.subscription_periods (id, subscription_id, period_start, period_end, amount_due, due_date)
  values ('13000000-0000-4000-8000-0000000000a1', '12000000-0000-4000-8000-000000000002', '2026-11-16', '2026-11-22', 500, '2026-11-15');
select tt.is((select paid from app.period_payment_status_at('2026-12-01') where period_id = '13000000-0000-4000-8000-0000000000a1'), 0, 'payments of another subscription do not pay this period');
-- a zero amount due is paid
insert into public.subscription_periods (id, subscription_id, period_start, period_end, amount_due, due_date)
  values ('13000000-0000-4000-8000-0000000000a2', '12000000-0000-4000-8000-000000000002', '2026-11-23', '2026-11-29', 0, '2026-11-22');
select tt.is((select status from app.period_payment_status_at('2026-12-01') where period_id = '13000000-0000-4000-8000-0000000000a2'), 'paid', 'a period with 0 due (waived) is paid');

-- ------------------------------ money and payment constraints (whole PKR) ------------------------------
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 0, 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-02')$$, '23514', 'payment amount 0 is rejected');
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', -5, 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-02')$$, '23514', 'negative payment amount is rejected');
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', '10.5', 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-02')$$, '22P02', 'a fractional amount ("10.5") is rejected: whole PKR only');
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 5, 'cash', '2026-11-01', '2026-11-01', '2026-11-02')$$, '23514', 'an unknown payment method is rejected');
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 5, 'jazzcash', '2026-11-01', '2026-11-10', '2026-11-02')$$, '23514', 'covers_to before covers_from is rejected');
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000001', 5, 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-02')$$, '23514', 'a payment cannot name a subscription of another customer');
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, voided_at) values ('11000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 5, 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-02', now())$$, '23514', 'a payment cannot be created already voided without a reason');
select tt.throws($$insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date) values ('12000000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-05', 10, '2026-10-31')$$, '23505', 'two periods of one subscription cannot start on the same day');
select tt.throws($$insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date) values ('12000000-0000-4000-8000-000000000001', '2027-02-01', '2027-02-05', -1, '2027-01-31')$$, '23514', 'a negative amount due is rejected');
select tt.throws($$insert into public.subscriptions (customer_id, plan_id, term, start_date, end_date, amount_per_period) values ('11000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-11-10', '2026-11-09', 1)$$, '23514', 'a subscription ending before it starts is rejected');
select tt.throws($$insert into public.subscriptions (customer_id, plan_id, term, start_date, end_date, amount_per_period) values ('11000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'daily', '2026-11-10', '2026-11-12', 1)$$, '23514', 'an unknown term is rejected');
select tt.throws($$insert into public.subscriptions (customer_id, plan_id, term, start_date, end_date, amount_per_period) values ('11000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-11-10', '2026-11-12', -1)$$, '23514', 'a negative amount per period is rejected');

-- ------------------------------ customers (FR-24) ------------------------------
select tt.is((select phone_e164 from public.customers where id = '11000000-0000-4000-8000-000000000001'), '+923000000001', 'local 03.. phone is stored normalised as +92');
insert into public.customers (type, name, phone_e164) values ('home', 'Dup Phone Sample', '+92 300-0000001');
select tt.is((select count(*) from public.customers where phone_e164 = '+923000000001'), 2::bigint, 'a duplicate phone is allowed (warning only, FR-24); +92 with spaces/dashes is normalised');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('home', 'Bad Phone', '12345')$$, '23514', 'an invalid phone is rejected');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('home', 'Landline', '04235761234')$$, '23514', 'a landline-looking number is rejected');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('home', 'No Phone', null)$$, '23514', 'a customer needs a phone number');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('home', '   ', '03005550000')$$, '23514', 'a blank name is rejected');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('home', 'Evil <script>', '03005550000')$$, '23514', 'markup in a name is rejected (plain text only)');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('office', 'Office No Fields', '03005550000')$$, '23514', 'an office needs organisation, contact person and member count');
select tt.throws($$insert into public.customers (type, name, phone_e164, org_name, contact_person, member_count) values ('office', 'Office Zero', '03005550000', 'O', 'P', 0)$$, '23514', 'office member count must be at least 1');
select tt.lives($$insert into public.customers (type, name, phone_e164, org_name, contact_person, member_count) values ('office', 'Office Ok', '03005550001', 'O', 'P', 5)$$, 'a complete office customer is accepted');
select tt.throws($$insert into public.customers (type, name, phone_e164, member_count) values ('student', 'Student With Members', '03005550002', 5)$$, '23514', 'only offices have a member count');
select tt.throws($$insert into public.customers (type, name, phone_e164) values ('company', 'Bad Type', '03005550003')$$, '23514', 'an unknown customer type is rejected');
update public.customers set archived_at = now() where id = '11000000-0000-4000-8000-000000000002';
select tt.throws($$insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to) values ('11000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 5, 'jazzcash', '2026-11-01', '2026-11-01', '2026-11-02')$$, '23514', 'no new payment can be recorded for an archived customer');
update public.customers set archived_at = null where id = '11000000-0000-4000-8000-000000000002';

-- ------------------------------ create_subscription (FR-26, A-20, A-22) ------------------------------
select tt.as_user('aaaaaaaa-0000-4000-8000-00000000000a'::uuid);
create temp table cs on commit drop as
  select public.create_subscription('11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-12-07', '2026-12-13', 700) as r;
select tt.is((select r ->> 'status' from cs), 'upcoming', 'create_subscription returns the computed status');
select tt.is((select r ->> 'payment_status' from cs), 'unpaid', 'a new subscription starts unpaid (due the day before it starts)');
select tt.is((select (r ->> 'balance')::int from cs), 700, 'a new subscription owes its amount per period');
select tt.is((select count(*) from public.subscription_periods where subscription_id = (select (r ->> 'id')::uuid from cs)), 1::bigint, 'exactly one period is created with the subscription');
select tt.is((select due_date from public.subscription_periods where subscription_id = (select (r ->> 'id')::uuid from cs)), date '2026-12-06', 'due date defaults to the day before the start (A-22)');
select tt.is((select amount_due from public.subscription_periods where subscription_id = (select (r ->> 'id')::uuid from cs)), 700, 'period amount due = amount per period');
select tt.is((select plan_name_snapshot from public.subscriptions where id = (select (r ->> 'id')::uuid from cs)), 'Plan Original', 'the plan name is copied at creation');
select tt.lives($$select public.create_subscription('11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'monthly', '2026-12-14', '2027-01-10', 2660, true, 'discount agreed', '2026-12-10', (select (r ->> 'id')::uuid from cs), 'renewal')$$, 'renewal with a custom due date and renewed_from_id');
select tt.is((select due_date from public.subscription_periods p join public.subscriptions s on s.id = p.subscription_id where s.notes = 'renewal'), date '2026-12-10', 'a given due date is used');
select tt.is((select renewed_from_id is not null from public.subscriptions where notes = 'renewal'), true, 'renewed_from_id is stored');
select tt.throws($$select public.create_subscription('11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-12-13', '2026-12-07', 700)$$, 'PT400', 'end date before start date -> PT400, nothing created');
select tt.throws($$select public.create_subscription('11000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000000', 'weekly', '2026-12-07', '2026-12-13', 700)$$, 'PT400', 'unknown plan -> PT400');
select tt.throws($$select public.create_subscription('00000000-0000-4000-8000-000000000000', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-12-07', '2026-12-13', 700)$$, 'PT404', 'unknown customer -> PT404');
select tt.throws($$select public.create_subscription('11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-12-07', '2026-12-13', -1)$$, 'PT400', 'negative amount -> PT400');
select tt.throws($$select public.create_subscription('11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-12-07', '2026-12-13', 100, false, '', null, '12000000-0000-4000-8000-000000000001')$$, 'PT400', 'renewed_from must belong to the same customer');
select tt.as_postgres();
update public.customers set archived_at = now() where id = '11000000-0000-4000-8000-000000000002';
select tt.as_user('aaaaaaaa-0000-4000-8000-00000000000a'::uuid);
select tt.throws($$select public.create_subscription('11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-12-20', '2026-12-26', 700)$$, 'PT400', 'no new subscription for an archived customer');
select tt.as_postgres();
select tt.is((select count(*) from public.subscriptions where customer_id = '11000000-0000-4000-8000-000000000002'), 3::bigint, 'failed creations left no partial rows (2 created above + 1 earlier)');

-- A-20: later plan price/name changes do not alter an existing subscription
update public.plans set unit_price = 999, weekly_price = 6993, name = 'Plan Renamed' where id = 'b0000000-0000-4000-8000-000000000001';
select tt.is((select amount_per_period from public.subscriptions where id = (select (r ->> 'id')::uuid from cs)), 700, 'A-20: a plan price change does not change an existing subscription amount');
select tt.is((select plan_name_snapshot from public.subscriptions where id = (select (r ->> 'id')::uuid from cs)), 'Plan Original', 'A-20: a plan rename does not rewrite subscription history');
select tt.is((select plan_name from app.subscription_status_at('2026-12-07') where id = (select (r ->> 'id')::uuid from cs)), 'Plan Original', 'status views show the snapshot name');

-- single-period subscription follows edits to its dates/amount; a hand-set due date and multi-period subscriptions are left alone
update public.subscriptions set end_date = '2026-12-14', amount_per_period = 800, start_date = '2026-12-08' where id = (select (r ->> 'id')::uuid from cs);
select tt.is((select (period_start, period_end, amount_due, due_date)::text from public.subscription_periods where subscription_id = (select (r ->> 'id')::uuid from cs)),
             '(2026-12-08,2026-12-14,800,2026-12-07)', 'editing a single-period subscription keeps its period in step (due date moves with the default)');
update public.subscription_periods set due_date = '2026-12-01' where subscription_id = (select (r ->> 'id')::uuid from cs);
update public.subscriptions set start_date = '2026-12-09' where id = (select (r ->> 'id')::uuid from cs);
select tt.is((select due_date from public.subscription_periods where subscription_id = (select (r ->> 'id')::uuid from cs)), date '2026-12-01', 'a due date set by hand is not overwritten');
update public.subscriptions set amount_per_period = 1 where id = '12000000-0000-4000-8000-000000000001';
select tt.is((select amount_due from public.subscription_periods where id = '13000000-0000-4000-8000-000000000001'), 1000, 'a subscription with several periods does not rewrite them');

-- plan "most popular" is single
update public.plans set is_most_popular = true where id = 'b0000000-0000-4000-8000-000000000001';
insert into public.plans (id, name, unit_price, weekly_price, is_most_popular) values ('b0000000-0000-4000-8000-000000000009', 'Second', 10, 70, true);
select tt.is((select count(*) from public.plans where is_most_popular), 1::bigint, 'at most one plan is "most popular"');
select tt.is((select id from public.plans where is_most_popular), 'b0000000-0000-4000-8000-000000000009'::uuid, 'the newest "most popular" flag wins');
