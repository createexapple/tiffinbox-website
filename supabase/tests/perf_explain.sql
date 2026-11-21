-- perf_explain.sql : before/after EXPLAIN for the lookups the screens depend on, at 5,000 customers / 15,000 payments
-- (5x the sizing assumption of architecture 6.4 is 5,000 customers). Run against the THROWAWAY database only:
--   KEEP_DB=1 supabase/tests/run.sh ; psql -d tiffinbox_stage3_test -f supabase/tests/perf_explain.sql ; CLEANUP_ONLY=1 supabase/tests/run.sh
-- Everything happens inside one transaction that is rolled back. Synthetic data only.
\set ON_ERROR_STOP on
\timing off
begin;
set session_replication_role = replica;   -- bulk load without the audit triggers
insert into public.plans (id, name, unit_price, weekly_price) values ('b0000000-0000-4000-8000-000000000001', 'P', 100, 700);
insert into public.customers (id, type, name, phone_e164)
  select gen_random_uuid(), 'student', 'Perf Sample ' || n, '+923' || lpad(n::text, 9, '0') from generate_series(1, 5000) n;
insert into public.subscriptions (id, customer_id, plan_id, plan_name_snapshot, term, start_date, end_date, amount_per_period)
  select gen_random_uuid(), c.id, 'b0000000-0000-4000-8000-000000000001', 'P', 'weekly',
         date '2026-11-16' - (random() * 60)::int, date '2026-11-22' + (random() * 30)::int, 1000 from public.customers c;
insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date)
  select id, start_date, end_date, amount_per_period, start_date - 1 from public.subscriptions;
insert into public.payments (customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference)
  select s.customer_id, s.id, 150, (array['jazzcash','easypaisa','bank_transfer'])[1 + (g % 3)], date '2026-11-10',
         s.start_date, s.end_date, 'REF-' || (row_number() over ())::text
  from public.subscriptions s cross join generate_series(1, 3) g;
analyze public.customers; analyze public.payments; analyze public.subscriptions; analyze public.subscription_periods;
select count(*) as customers from public.customers;
select count(*) as payments from public.payments;

\echo
\echo '=== Q1 duplicate-phone warning (FR-24): BEFORE (index customers_phone_idx dropped)'
savepoint s1;
drop index public.customers_phone_idx;
explain (analyze, costs off, timing on, summary on) select id from public.customers where phone_e164 = '+923000004321' and id <> gen_random_uuid();
rollback to savepoint s1;
\echo '=== Q1 AFTER (index present, as shipped)'
explain (analyze, costs off, timing on, summary on) select id from public.customers where phone_e164 = '+923000004321' and id <> gen_random_uuid();

\echo
\echo '=== Q2 duplicate payment reference warning (FR-28): BEFORE (index payments_reference_idx dropped)'
savepoint s2;
drop index public.payments_reference_idx;
explain (analyze, costs off, timing on, summary on) select id from public.payments where method = 'jazzcash' and lower(reference) = 'ref-7777' and voided_at is null;
rollback to savepoint s2;
\echo '=== Q2 AFTER (index present, as shipped)'
explain (analyze, costs off, timing on, summary on) select id from public.payments where method = 'jazzcash' and lower(reference) = 'ref-7777' and voided_at is null;

\echo
\echo '=== Q3 customer detail: payments of one customer, newest first: BEFORE (index payments_customer_idx dropped)'
savepoint s3;
drop index public.payments_customer_idx;
explain (analyze, costs off, timing on, summary on) select * from public.payments where customer_id = (select id from public.customers where phone_e164 = '+923000001234') order by paid_on desc;
rollback to savepoint s3;
\echo '=== Q3 AFTER (index present, as shipped)'
explain (analyze, costs off, timing on, summary on) select * from public.payments where customer_id = (select id from public.customers where phone_e164 = '+923000001234') order by paid_on desc;

\echo
\echo '=== Q4 dues list (A-16): all unpaid + overdue periods through the computed-status function (no index change; timing only)'
explain (analyze, costs off, timing on, summary on) select * from app.period_payment_status_at('2026-11-22') where status in ('unpaid','overdue');
\echo '=== Q5 customer list status filters (FR-25): customer_summary at 5,000 customers (timing only)'
explain (analyze, costs off, timing on, summary on) select count(*) from app.customer_summary_at('2026-11-22') where payment_status = 'overdue';
\echo '=== Q5b same query through the shipped design, recorded BEFORE the rewrite: 13195 ms (correlated per-customer subqueries); AFTER: see above'
rollback;
