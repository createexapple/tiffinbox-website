-- 20261122000009_operations_functions.sql
-- create_subscription, void_payment, anonymise_customer (architecture 6.5, 9.4; FR-26, FR-28, NFR-12, Q-34).
-- Admin-only SECURITY DEFINER functions with an explicit admin check. Parameter names match
-- docs/api/openapi.yaml. Errors: PT400 validation (DETAIL = JSON), PT403 not admin, PT404 not found.

-- Creates a subscription AND its first period in one transaction (also used by Renew via renewed_from_id).
-- The period covers start..end, amount due = amount_per_period, due date defaults to the day before start (A-22).
create function public.create_subscription(
  customer_id uuid, plan_id uuid, term text, start_date date, end_date date,
  amount_per_period integer,
  breakfast_addon boolean default false, amount_note text default '', due_date date default null,
  renewed_from_id uuid default null, notes text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_errs   jsonb := '[]'::jsonb;
  v_cust   public.customers;
  v_id     uuid;
  v_today  date := app.karachi_today();
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;

  select c.* into v_cust from public.customers c where c.id = customer_id;
  if not found then raise exception 'customer not found' using errcode = 'PT404'; end if;
  if v_cust.archived_at is not null then
    v_errs := v_errs || jsonb_build_object('field', 'customer_id', 'message', 'This customer is archived. Restore the customer first.');
  end if;
  if not exists (select 1 from public.plans p where p.id = plan_id) then
    v_errs := v_errs || jsonb_build_object('field', 'plan_id', 'message', 'Choose a plan from the list.');
  end if;
  if term is null or term not in ('weekly', 'monthly') then
    v_errs := v_errs || jsonb_build_object('field', 'term', 'message', 'Term must be weekly or monthly.');
  end if;
  if start_date is null then
    v_errs := v_errs || jsonb_build_object('field', 'start_date', 'message', 'Choose the start date.');
  end if;
  if end_date is null or (start_date is not null and end_date < start_date) then
    v_errs := v_errs || jsonb_build_object('field', 'end_date', 'message', 'End date is missing or before the start date.');
  end if;
  if amount_per_period is null or amount_per_period < 0 then
    v_errs := v_errs || jsonb_build_object('field', 'amount_per_period', 'message', 'Enter the amount in whole rupees.');
  end if;
  if renewed_from_id is not null and not exists (
       select 1 from public.subscriptions s where s.id = renewed_from_id and s.customer_id = create_subscription.customer_id) then
    v_errs := v_errs || jsonb_build_object('field', 'renewed_from_id', 'message', 'The renewed subscription must belong to the same customer.');
  end if;
  if jsonb_array_length(v_errs) > 0 then
    raise exception 'validation_failed' using errcode = 'PT400', detail = v_errs::text;
  end if;

  insert into public.subscriptions (customer_id, plan_id, term, start_date, end_date, breakfast_addon,
                                    amount_per_period, amount_note, renewed_from_id, notes)
  values (customer_id, plan_id, term, start_date, end_date, coalesce(breakfast_addon, false),
          amount_per_period, coalesce(amount_note, ''), renewed_from_id, coalesce(notes, ''))
  returning id into v_id;

  insert into public.subscription_periods (subscription_id, period_start, period_end, amount_due, due_date)
  values (v_id, start_date, end_date, amount_per_period, coalesce(due_date, start_date - 1));

  return (select jsonb_build_object(
            'id', s.id, 'status', s.status, 'renewal_due', s.renewal_due,
            'payment_status', coalesce((select case max(case q.status when 'overdue' then 2 when 'unpaid' then 1 else 0 end)
                                                when 2 then 'overdue' when 1 then 'unpaid' else 'paid' end
                                        from app.period_payment_status_at(v_today) q where q.subscription_id = s.id), 'paid'),
            'balance', coalesce((select sum(q.balance) from app.period_payment_status_at(v_today) q where q.subscription_id = s.id), 0))
          from app.subscription_status_at(v_today) s where s.id = v_id);
end $$;

-- Void keeps the row and its original values (the audit trigger stores both old and new rows).
create function public.void_payment(payment_id uuid, reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_pay public.payments;
  v_reason text := btrim(coalesce(reason, ''));
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  if v_reason = '' or char_length(v_reason) > 300 or v_reason ~ '[<>]' then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"reason","message":"A reason is required (max 300 characters, plain text)."}]';
  end if;
  select p.* into v_pay from public.payments p where p.id = payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'PT404'; end if;
  if v_pay.voided_at is not null then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"payment_id","message":"This payment is already voided."}]';
  end if;
  update public.payments p set voided_at = now(), void_reason = v_reason where p.id = payment_id;
  return jsonb_build_object('id', payment_id, 'voided_at', now(), 'void_reason', v_reason);
end $$;

-- Irreversibly removes a customer's personal data, keeps payment amounts and dates for the books,
-- and redacts that customer's personal values in audit_log (architecture 6.5 Q-34, NFR-12).
-- The customer is archived; the row stays so payments and subscriptions keep their parent.
create function public.anonymise_customer(customer_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_cust public.customers;
  v_at   timestamptz := now();
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  select c.* into v_cust from public.customers c where c.id = customer_id for update;
  if not found then raise exception 'customer not found' using errcode = 'PT404'; end if;
  if v_cust.anonymised_at is not null then
    return jsonb_build_object('customer_id', customer_id, 'anonymised_at', v_cust.anonymised_at);
  end if;

  perform set_config('app.anonymising', 'on', true);
  update public.customers c
     set name = 'Anonymised customer', phone_e164 = null, address_text = '', org_name = '',
         contact_person = '', notes = '', archived_at = coalesce(c.archived_at, v_at), anonymised_at = v_at
   where c.id = customer_id;
  update public.subscriptions s set notes = '', amount_note = ''
   where s.customer_id = customer_id and (s.notes <> '' or s.amount_note <> '');
  update public.payments p set note = '', void_reason = case when p.voided_at is null then '' else 'removed' end
   where p.customer_id = customer_id and (p.note <> '' or p.void_reason <> '');
  perform set_config('app.anonymising', 'off', true);

  -- Redact personal values in the history of this customer (including the rows written just above).
  perform set_config('app.audit_redaction', 'on', true);
  update public.audit_log a
     set old_values = a.old_values - array['name', 'phone_e164', 'address_text', 'org_name', 'contact_person', 'notes', 'note', 'amount_note', 'void_reason'],
         new_values = a.new_values - array['name', 'phone_e164', 'address_text', 'org_name', 'contact_person', 'notes', 'note', 'amount_note', 'void_reason']
   where a.subject_customer_id = customer_id;
  perform set_config('app.audit_redaction', 'off', true);

  perform app.write_audit('anonymise', 'customers', customer_id::text, null,
    jsonb_build_object('anonymised_at', v_at), customer_id);
  return jsonb_build_object('customer_id', customer_id, 'anonymised_at', v_at);
end $$;

grant execute on function public.create_subscription(uuid, uuid, text, date, date, integer, boolean, text, date, uuid, text) to authenticated;
grant execute on function public.void_payment(uuid, text)        to authenticated;
grant execute on function public.anonymise_customer(uuid)        to authenticated;
