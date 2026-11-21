-- 02_status_views.sql : subscription status, renewal window, payment status, customer summary and the dashboard
-- overview across edge dates (architecture sec. 9; FR-27, FR-29, FR-30; A-22, A-24; Q-32, Q-33).
-- The rules are SQL functions of an explicit date, so every edge date can be tested without a clock hook.
select tt.as_postgres();
insert into public.plans (id, name, unit_price, weekly_price) values ('b0000000-0000-4000-8000-000000000001', 'P', 100, 700);

-- "Today" is the Karachi calendar date (UTC+05:00, no DST)
select tt.is(app.karachi_today('2026-11-22 18:59:59+00'), date '2026-11-22', 'Karachi date at 23:59:59 PKT is still the same day');
select tt.is(app.karachi_today('2026-11-22 19:00:00+00'), date '2026-11-23', 'Karachi date at 00:00:00 PKT is the next day');
select tt.is(app.karachi_today('2026-12-31 19:00:00+00'), date '2027-01-01', 'Karachi date crosses the year boundary');
select tt.is(app.karachi_today('2026-11-22 00:00:00+05'), date '2026-11-22', 'a timestamp given in +05 keeps its Karachi date');

-- customers (synthetic)
insert into public.customers (id, type, name, phone_e164, org_name, contact_person, member_count, archived_at) values
  ('11000000-0000-4000-8000-000000000001', 'student', 'C1 Sample', '03000000001', '', '', null, null),
  ('11000000-0000-4000-8000-000000000002', 'office',  'C2 Sample', '03000000002', 'Org 2', 'P2', 12, null),
  ('11000000-0000-4000-8000-000000000003', 'student', 'C3 Sample', '03000000003', '', '', null, null),
  ('11000000-0000-4000-8000-000000000004', 'home',    'C4 Sample', '03000000004', '', '', null, null),
  ('11000000-0000-4000-8000-000000000005', 'office',  'C5 Sample', '03000000005', 'Org 5', 'P5', 10, null),
  ('11000000-0000-4000-8000-000000000006', 'student', 'C6 Sample', '03000000006', '', '', null, null),
  ('11000000-0000-4000-8000-000000000007', 'student', 'C7 Sample (archived)', '03000000007', '', '', null, null);

insert into public.subscriptions (id, customer_id, plan_id, term, start_date, end_date, amount_per_period, manual_state) values
  ('12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-16', '2026-11-22', 4200,  'active'),
  ('12000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'monthly', '2026-11-01', '2026-11-28', 12540, 'active'),
  ('12000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-23', '2026-11-29', 8050,  'active'),
  ('12000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-16', '2026-11-22', 4200,  'paused'),
  ('12000000-0000-4000-8000-000000000005', '11000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'monthly', '2026-11-01', '2026-11-28', 12540, 'active'),
  ('12000000-0000-4000-8000-000000000006', '11000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'weekly',  '2026-11-09', '2026-11-15', 4200,  'active'),
  ('12000000-0000-4000-8000-000000000007', '11000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'monthly', '2026-11-09', '2026-12-06', 30590, 'active');
insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date)
  select s.id, s.start_date, s.end_date, s.amount_per_period, s.start_date - 1 from public.subscriptions s;
insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference) values
  ('11000000-0000-4000-8000-000000000002', '12000000-0000-4000-8000-000000000002', 12540, 'bank_transfer', '2026-10-31', '2026-11-01', '2026-11-28', 'T-2'),
  ('11000000-0000-4000-8000-000000000004', '12000000-0000-4000-8000-000000000004', 4200,  'jazzcash',      '2026-11-15', '2026-11-16', '2026-11-22', 'T-4'),
  ('11000000-0000-4000-8000-000000000005', '12000000-0000-4000-8000-000000000005', 6000,  'bank_transfer', '2026-10-31', '2026-11-01', '2026-11-28', 'T-5'),
  ('11000000-0000-4000-8000-000000000007', '12000000-0000-4000-8000-000000000007', 30590, 'easypaisa',     '2026-11-08', '2026-11-09', '2026-12-06', 'T-7');
update public.customers set archived_at = '2026-11-20 10:00+05' where id = '11000000-0000-4000-8000-000000000007';

create function tt.st(p_sub text, p_day date) returns text language sql stable as $$
  select status from app.subscription_status_at(p_day) where id = ('12000000-0000-4000-8000-00000000000' || p_sub)::uuid $$;
create function tt.rd(p_sub text, p_day date) returns boolean language sql stable as $$
  select renewal_due from app.subscription_status_at(p_day) where id = ('12000000-0000-4000-8000-00000000000' || p_sub)::uuid $$;
create function tt.ps(p_sub text, p_day date) returns text language sql stable as $$
  select status from app.period_payment_status_at(p_day) where subscription_id = ('12000000-0000-4000-8000-00000000000' || p_sub)::uuid $$;

-- ------------------------------ subscription status at 22 Nov 2026 ------------------------------
select tt.is(tt.st('1', '2026-11-22'), 'active',   'ends today: still active on its last day');
select tt.is(tt.st('1', '2026-11-23'), 'expired',  'ended yesterday: expired');
select tt.is(tt.st('3', '2026-11-22'), 'upcoming', 'starts tomorrow: upcoming');
select tt.is(tt.st('3', '2026-11-23'), 'active',   'starts today: active on its first day');
select tt.is(tt.st('3', '2026-11-29'), 'active',   'last day of a week: active');
select tt.is(tt.st('3', '2026-11-30'), 'expired',  'day after the end date: expired');
select tt.is(tt.st('4', '2026-11-22'), 'paused',   'manual pause inside the dates: paused');
select tt.is(tt.st('6', '2026-11-22'), 'expired',  'ended a week ago: expired');

-- precedence paused > expired > upcoming > active (architecture 9.1)
select tt.is(tt.st('4', '2026-12-31'), 'paused',   'paused beats expired: a paused subscription past its end date stays paused');
select tt.is(tt.st('4', '2026-11-01'), 'paused',   'paused beats upcoming: a paused subscription with a future start is paused');
update public.subscriptions set manual_state = 'active' where id = '12000000-0000-4000-8000-000000000004';
select tt.is(tt.st('4', '2026-12-31'), 'expired',  'un-pausing a past subscription shows expired');
select tt.is(tt.st('4', '2026-11-01'), 'upcoming', 'un-pausing a future subscription shows upcoming');
update public.subscriptions set manual_state = 'paused' where id = '12000000-0000-4000-8000-000000000004';

-- ------------------------------ renewal window (Q-33), default 7 ------------------------------
select tt.is(tt.rd('1', '2026-11-22'), true,  'renewal due: 0 days left');
select tt.is((select days_to_end from app.subscription_status_at('2026-11-22') where id = '12000000-0000-4000-8000-000000000002'), 6, 'days_to_end counts calendar days');
select tt.is(tt.rd('2', '2026-11-22'), true,  'renewal due: 6 days left (window 7)');
select tt.is(tt.rd('2', '2026-11-21'), true,  'renewal due: exactly 7 days left is inside the window (boundary)');
select tt.is(tt.rd('2', '2026-11-20'), false, 'not renewal due: 8 days left is outside the window (boundary)');
select tt.is(tt.rd('7', '2026-11-22'), false, 'not renewal due: 14 days left');
select tt.is(tt.rd('4', '2026-11-22'), false, 'a paused subscription is never flagged renewal due');
select tt.is(tt.rd('3', '2026-11-22'), false, 'an upcoming subscription is never flagged renewal due');
select tt.is(tt.rd('1', '2026-11-23'), false, 'an expired subscription is not flagged renewal due');
update public.ops_settings set renewal_window_days = 0;
select tt.is(tt.rd('1', '2026-11-22'), true,  'window 0: due only on the last day');
select tt.is(tt.rd('2', '2026-11-27'), false, 'window 0: one day before the end is not flagged');
select tt.is(tt.rd('2', '2026-11-28'), true,  'window 0: last day is flagged');
update public.ops_settings set renewal_window_days = 14;
select tt.is(tt.rd('7', '2026-11-22'), true,  'window 14: 14 days left is flagged');
update public.ops_settings set renewal_window_days = 7;

-- ------------------------------ payment status (A-22, Q-32) ------------------------------
select tt.is(tt.ps('1', '2026-11-15'), 'unpaid',  'due date itself: still unpaid, not overdue');
select tt.is(tt.ps('1', '2026-11-14'), 'unpaid',  'before the due date: unpaid');
select tt.is(tt.ps('1', '2026-11-16'), 'overdue', 'day after the due date: overdue (grace 0)');
select tt.is(tt.ps('3', '2026-11-22'), 'unpaid',  'period starting tomorrow, due today: unpaid');
select tt.is(tt.ps('3', '2026-11-23'), 'overdue', 'period started, due yesterday: overdue');
select tt.is(tt.ps('2', '2026-12-31'), 'paid',    'fully paid stays paid after the due date');
select tt.is(tt.ps('4', '2026-12-31'), 'paid',    'a paused subscription that is fully paid is paid');
select tt.is(tt.ps('6', '2026-11-22'), 'overdue', 'an expired subscription with an unpaid period is overdue');
select tt.is(tt.ps('5', '2026-11-22'), 'overdue', 'part payment past the due date: overdue');
select tt.is((select balance from app.period_payment_status_at('2026-11-22') where subscription_id = '12000000-0000-4000-8000-000000000005'), 6540, 'part payment leaves a balance of the unpaid remainder');
select tt.is((select paid from app.period_payment_status_at('2026-11-22') where subscription_id = '12000000-0000-4000-8000-000000000005'), 6000, 'paid amount shows what was received');
-- grace days (Q-32)
update public.ops_settings set overdue_grace_days = 2;
select tt.is(tt.ps('1', '2026-11-16'), 'unpaid',  'grace 2: due date + 1 day is still unpaid');
select tt.is(tt.ps('1', '2026-11-17'), 'unpaid',  'grace 2: due date + 2 days is still unpaid (boundary)');
select tt.is(tt.ps('1', '2026-11-18'), 'overdue', 'grace 2: due date + 3 days is overdue (boundary)');
update public.ops_settings set overdue_grace_days = 0;
-- paid exactly / one rupee short
update public.payments set amount = 4199 where reference = 'T-4';
select tt.is(tt.ps('4', '2026-11-22'), 'overdue', 'one rupee short of the amount due is not paid');
select tt.is((select balance from app.period_payment_status_at('2026-11-22') where subscription_id = '12000000-0000-4000-8000-000000000004'), 1, 'one rupee short leaves a balance of 1');
update public.payments set amount = 4200 where reference = 'T-4';
select tt.is(tt.ps('4', '2026-11-22'), 'paid', 'exactly the amount due is paid');

-- ------------------------------ views use today in Asia/Karachi ------------------------------
select tt.is((select count(*) from public.subscription_status), 7::bigint, 'public view subscription_status lists all subscriptions');
select tt.is((select count(*) from public.subscription_status s where s.status = (select x.status from app.subscription_status_at(app.karachi_today()) x where x.id = s.id)), 7::bigint,
             'the view equals the function evaluated at today in Asia/Karachi');

-- ------------------------------ customer summary (FR-25 filters) ------------------------------
select tt.is((select payment_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000001'), 'overdue', 'customer payment status: overdue');
select tt.is((select payment_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000003'), 'unpaid', 'customer payment status: unpaid');
select tt.is((select payment_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000002'), 'paid', 'customer payment status: paid');
select tt.is((select current_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000004'), 'paused', 'customer current status: paused');
-- worst status wins: add an unpaid period to the fully-paid customer C2, then an overdue one
insert into public.subscriptions (id, customer_id, plan_id, term, start_date, end_date, amount_per_period)
  values ('12000000-0000-4000-8000-000000000009', '11000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-11-29', '2026-12-05', 100);
insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date)
  values ('12000000-0000-4000-8000-000000000009', '2026-11-29', '2026-12-05', 100, '2026-11-28');
select tt.is((select payment_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000002'), 'unpaid', 'worst of (paid, unpaid) is unpaid');
select tt.is((select payment_status from app.customer_summary_at('2026-11-29') where customer_id = '11000000-0000-4000-8000-000000000002'), 'overdue', 'worst of (paid, overdue) is overdue');
select tt.is((select subscription_statuses from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000002'), array['active','upcoming'], 'customer lists all subscription statuses present');
select tt.is((select current_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-000000000002'), 'active', 'current subscription prefers active over upcoming');
insert into public.customers (id, type, name, phone_e164) values ('11000000-0000-4000-8000-0000000000ff', 'home', 'No Subscription Sample', '03000000099');
select tt.is((select payment_status from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-0000000000ff'), null, 'a customer without periods has no payment status');
select tt.is((select current_subscription_id from app.customer_summary_at('2026-11-22') where customer_id = '11000000-0000-4000-8000-0000000000ff'), null, 'a customer without subscriptions has no current subscription');
delete from public.subscription_periods where subscription_id = '12000000-0000-4000-8000-000000000009';
delete from public.subscriptions where id = '12000000-0000-4000-8000-000000000009';
delete from public.customers where id = '11000000-0000-4000-8000-0000000000ff';

-- ------------------------------ dashboard overview (FR-30): same definitions as the lists ------------------------------
select tt.as_user('aaaaaaaa-0000-4000-8000-00000000000a'::uuid);
create temp table ov on commit drop as select * from app.dashboard_overview_at('2026-11-22', '2026-11-22 12:00+05');
select tt.is((select active_subscribers from ov), 3, 'overview: active subscribers = distinct non-archived customers with an active subscription (C1, C2, C5; archived C7 excluded)');
select tt.is((select office_members from ov), 22, 'overview: office head-count of active office customers (12 + 10)');
select tt.is((select unpaid_count from ov), 1, 'overview: one unpaid period');
select tt.is((select unpaid_total from ov), 8050::bigint, 'overview: unpaid total is the sum of balances');
select tt.is((select overdue_count from ov), 3, 'overview: three overdue periods');
select tt.is((select overdue_total from ov), 14940::bigint, 'overview: overdue total (4200 + 6540 + 4200)');
select tt.is((select renewal_due_count from ov), 3, 'overview: renewal due counts subscriptions (C1, C2, C5)');
select tt.is((select renewal_window_days from ov), 7, 'overview echoes the renewal window');
select tt.is((select total_customers from ov), 6, 'overview: non-archived customers');
select tt.is((select unpaid_count from ov), (select count(*)::int from app.period_payment_status_at('2026-11-22') where status = 'unpaid'), 'overview unpaid count equals the dues list count (FR-30)');
select tt.is((select overdue_total from ov), (select sum(balance) from app.period_payment_status_at('2026-11-22') where status = 'overdue'), 'overview overdue total equals the dues list total (FR-30)');
select tt.is((select renewal_due_count from ov), (select count(*)::int from app.subscription_status_at('2026-11-22') where renewal_due), 'overview renewal count equals the expiring list count (FR-30)');
select tt.is((select active_subscribers from app.dashboard_overview_at('2026-11-23', '2026-11-23 12:00+05')), 3, 'a day later: C1 expired, C3 became active');
select tt.is((select overdue_count from app.dashboard_overview_at('2026-11-23', '2026-11-23 12:00+05')), 4, 'a day later: the period due yesterday is now overdue');
select tt.is((select unpaid_count from app.dashboard_overview_at('2026-11-23', '2026-11-23 12:00+05')), 0, 'a day later: nothing is merely unpaid any more');
select tt.as_postgres();
select tt.is((select count(*) from app.dashboard_overview_at('2026-11-22', now())), 0::bigint, 'overview returns no row without an admin identity');

-- empty database edge: no customers
delete from public.payments; delete from public.subscription_periods; delete from public.subscriptions; delete from public.customers;
select tt.as_user('aaaaaaaa-0000-4000-8000-00000000000a'::uuid);
select tt.is((select active_subscribers + unpaid_count + overdue_count + renewal_due_count + total_customers from app.dashboard_overview_at('2026-11-22', now())), 0, 'empty state: all counts are zero');
