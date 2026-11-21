-- Rollback of 20261122000009_operations_functions.sql
drop function if exists public.anonymise_customer(uuid);
drop function if exists public.void_payment(uuid, text);
drop function if exists public.create_subscription(uuid, uuid, text, date, date, integer, boolean, text, date, uuid, text);
