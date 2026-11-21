-- Rollback of 20261122000003_operations_tables.sql (drops customer, subscription and payment data: destructive;
-- never run on a database holding real data without a verified backup, and never on production by an agent)
drop table if exists public.payments;
drop table if exists public.subscription_periods;
drop table if exists public.subscriptions;
drop table if exists public.customers;
drop function if exists app.payments_before_write();
drop function if exists app.subscriptions_sync_single_period();
drop function if exists app.subscriptions_before_write();
drop function if exists app.customers_before_write();
