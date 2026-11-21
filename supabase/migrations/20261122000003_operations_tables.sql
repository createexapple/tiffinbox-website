-- 20261122000003_operations_tables.sql
-- Customers, subscriptions, subscription periods, payments (CR-002; FR-24..FR-30; A-19..A-26).
-- Saved immediately, never published. Personal and financial data (NFR-12): see RLS in migration 5.
-- Money is whole PKR integers.

create table public.customers (
  id            uuid primary key default gen_random_uuid(),   -- UUID so records cannot be guessed from a URL
  type          text not null check (type in ('student', 'office', 'home')),
  name          text not null check (char_length(btrim(name)) between 1 and 120 and name !~ '[<>]'),
  phone_e164    text check (phone_e164 ~ '^\+923[0-9]{9}$'),
  address_text  text not null default '' check (char_length(address_text) <= 200 and address_text !~ '[<>]'),
  org_name      text not null default '' check (char_length(org_name) <= 120 and org_name !~ '[<>]'),
  contact_person text not null default '' check (char_length(contact_person) <= 120 and contact_person !~ '[<>]'),
  member_count  integer check (member_count is null or member_count >= 1),
  notes         text not null default '' check (char_length(notes) <= 500 and notes !~ '[<>]'),
  archived_at   timestamptz,
  anonymised_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint customers_phone_required check (anonymised_at is not null or phone_e164 is not null),
  constraint customers_office_fields check (
    type <> 'office' or anonymised_at is not null
    or (btrim(org_name) <> '' and btrim(contact_person) <> '' and member_count is not null)),
  constraint customers_member_count_office_only check (type = 'office' or member_count is null)
);
comment on table public.customers is
  'FR-24. Archive (archived_at), never delete. anonymise_customer() removes personal data (Q-34). Phone is indexed, not unique: a duplicate is a warning (FR-24).';
create index customers_phone_idx    on public.customers (phone_e164);
create index customers_archived_idx on public.customers (archived_at);
create index customers_type_idx     on public.customers (type) where archived_at is null;

-- Phone numbers are stored normalised (+923XXXXXXXXX). Accept the local 03XXXXXXXXX form and convert,
-- so the app may send either. Anonymised customers cannot be edited again.
create function app.customers_before_write()
returns trigger language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.anonymised_at is not null then
    raise exception 'an anonymised customer cannot be edited' using errcode = '42501';
  end if;
  if new.phone_e164 is not null then
    new.phone_e164 := coalesce(app.normalise_pk_phone(new.phone_e164), new.phone_e164);
  end if;
  new.name := btrim(new.name);
  return new;
end $$;
create trigger customers_before_write before insert or update on public.customers
  for each row execute function app.customers_before_write();
create trigger customers_updated before update on public.customers
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------------------------
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers (id) on delete restrict,
  plan_id            uuid not null references public.plans (id) on delete restrict,
  plan_name_snapshot text not null,            -- copied at creation so later renames do not change history
  term               text not null check (term in ('weekly', 'monthly')),
  start_date         date not null,
  end_date           date not null,
  breakfast_addon    boolean not null default false,
  amount_per_period  integer not null check (amount_per_period >= 0),   -- copied from the plan at creation (A-20)
  amount_note        text not null default '' check (char_length(amount_note) <= 200 and amount_note !~ '[<>]'),
  manual_state       text not null default 'active' check (manual_state in ('active', 'paused')),   -- A-23
  manual_state_on    date,
  renewed_from_id    uuid references public.subscriptions (id) on delete set null,
  notes              text not null default '' check (char_length(notes) <= 500 and notes !~ '[<>]'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint subscriptions_dates check (end_date >= start_date)
);
create index subscriptions_customer_idx on public.subscriptions (customer_id, start_date, end_date);
create index subscriptions_plan_idx     on public.subscriptions (plan_id);
create index subscriptions_end_idx      on public.subscriptions (end_date) where manual_state = 'active';
create index subscriptions_renewed_idx  on public.subscriptions (renewed_from_id) where renewed_from_id is not null;

create function app.subscriptions_before_write()
returns trigger language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id then
    select p.name into new.plan_name_snapshot from public.plans p where p.id = new.plan_id;
  end if;
  return new;
end $$;
create trigger subscriptions_before_write before insert or update on public.subscriptions
  for each row execute function app.subscriptions_before_write();
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Why periods are a separate table: architecture 6.5. A subscription may have several periods
-- (Q-10, Q-35); payments are not tied one-to-one to a period but allocated oldest first (migration 6).
-- ---------------------------------------------------------------------------------------------
create table public.subscription_periods (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references public.subscriptions (id) on delete restrict,
  period_start     date not null,
  period_end       date not null,
  amount_due       integer not null check (amount_due >= 0),
  due_date         date not null,
  note             text not null default '' check (char_length(note) <= 200 and note !~ '[<>]'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint subscription_periods_dates check (period_end >= period_start),
  constraint subscription_periods_unique_start unique (subscription_id, period_start)
);
create index subscription_periods_due_idx on public.subscription_periods (due_date);
create trigger subscription_periods_updated before update on public.subscription_periods
  for each row execute function app.set_updated_at();

-- A subscription with exactly one period (the v1 case) keeps that period in step when its dates or
-- amount are edited (matches the Stage 2 behaviour). A due date the admin changed by hand is kept.
create function app.subscriptions_sync_single_period()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  select count(*) into v_count from public.subscription_periods where subscription_id = new.id;
  if v_count = 1 then
    update public.subscription_periods p
       set period_start = new.start_date,
           period_end   = new.end_date,
           amount_due   = new.amount_per_period,
           due_date     = case when p.due_date = old.start_date - 1 then new.start_date - 1 else p.due_date end
     where p.subscription_id = new.id;
  end if;
  return null;
end $$;
create trigger subscriptions_sync_single_period
  after update of start_date, end_date, amount_per_period on public.subscriptions
  for each row execute function app.subscriptions_sync_single_period();

-- ---------------------------------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete restrict,
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  amount          integer not null check (amount > 0),            -- whole PKR
  method          text not null check (method in ('jazzcash', 'easypaisa', 'bank_transfer')),
  paid_on         date not null,
  covers_from     date not null,
  covers_to       date not null,
  reference       text not null default '' check (char_length(reference) <= 60 and reference !~ '[<>]'),
  note            text not null default '' check (char_length(note) <= 300 and note !~ '[<>]'),
  voided_at       timestamptz,
  void_reason     text not null default '' check (char_length(void_reason) <= 300 and void_reason !~ '[<>]'),
  recorded_by     uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_covers check (covers_to >= covers_from),
  constraint payments_void_reason check ((voided_at is null) = (btrim(void_reason) = ''))
);
comment on table public.payments is
  'FR-28. Never deleted: void_payment() keeps the row. "covers_from/to" are kept as typed; allocation to periods is oldest first (arch 9.2).';
create index payments_customer_idx     on public.payments (customer_id, paid_on desc);
create index payments_subscription_idx on public.payments (subscription_id) where voided_at is null;
create index payments_paid_on_idx      on public.payments (paid_on);
create index payments_reference_idx    on public.payments (method, lower(reference))
  where voided_at is null;   -- duplicate-reference warning (FR-28); predicate matches the query exactly so the planner can use it

create function app.payments_before_write()
returns trigger language plpgsql
  set search_path = ''
as $$
declare v_customer uuid; v_archived timestamptz;
begin
  if tg_op = 'UPDATE' and old.voided_at is not null
     and coalesce(current_setting('app.anonymising', true), '') <> 'on' then   -- flag set only by anonymise_customer()
    raise exception 'a voided payment cannot be edited' using errcode = '42501';
  end if;
  select s.customer_id into v_customer from public.subscriptions s where s.id = new.subscription_id;
  if v_customer is distinct from new.customer_id then
    raise exception 'the subscription does not belong to this customer' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    select c.archived_at into v_archived from public.customers c where c.id = new.customer_id;
    if v_archived is not null then
      raise exception 'this customer is archived; restore the customer first' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger payments_before_write before insert or update on public.payments
  for each row execute function app.payments_before_write();
create trigger payments_updated before update on public.payments
  for each row execute function app.set_updated_at();
