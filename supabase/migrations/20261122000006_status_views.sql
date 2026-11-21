-- 20261122000006_status_views.sql
-- Computed statuses (architecture section 9; ADR-0003 point 7). Nothing is written by a job: statuses are
-- computed on read, with ONE definition each, used by lists, customer detail, filters and the overview
-- so the overview counts always equal the list counts (FR-30).
--
-- Testability without a clock hook: each rule is a function of an explicit date/instant
-- (app.*_at(p_today ...)); the public views simply call it with "today in Asia/Karachi" / now().
-- Views are security_invoker, so RLS of the calling user applies (anon: no grants at all; a signed-in
-- non-admin sees zero rows).

-- ---------------------------------------------------------------------------------------------
-- 9.1 Subscription status. First match wins: paused > expired > upcoming > active.
--     Renewal due = active and (end_date - today) <= renewal_window_days (Q-33).
-- ---------------------------------------------------------------------------------------------
create function app.subscription_status_at(p_today date)
returns table (
  id uuid, customer_id uuid, plan_id uuid, plan_name text, term text, start_date date, end_date date,
  breakfast_addon boolean, amount_per_period integer, amount_note text, manual_state text,
  manual_state_on date, renewed_from_id uuid, notes text,
  status text, days_to_end integer, renewal_due boolean)
language sql stable
  set search_path = ''
as $$
  select s.id, s.customer_id, s.plan_id, s.plan_name_snapshot, s.term, s.start_date, s.end_date,
         s.breakfast_addon, s.amount_per_period, s.amount_note, s.manual_state, s.manual_state_on,
         s.renewed_from_id, s.notes,
         x.status,
         (s.end_date - p_today),
         (x.status = 'active' and (s.end_date - p_today) <= o.renewal_window_days)
  from public.subscriptions s
  cross join public.ops_settings o
  cross join lateral (
    select case
             when s.manual_state = 'paused' then 'paused'
             when s.end_date < p_today      then 'expired'
             when s.start_date > p_today    then 'upcoming'
             else 'active'
           end as status
  ) x
$$;

-- ---------------------------------------------------------------------------------------------
-- 9.2 Payment status per period. A subscription's non-voided payments are totalled and applied to
--     its periods oldest first. Paid >= due -> paid; else overdue when today > due_date + grace
--     (Q-32), otherwise unpaid. Money beyond the total due is "credit" (see subscription_balance).
-- ---------------------------------------------------------------------------------------------
create function app.period_payment_status_at(p_today date)
returns table (
  period_id uuid, subscription_id uuid, customer_id uuid, customer_name text, plan_name text,
  period_start date, period_end date, amount_due integer, due_date date,
  paid integer, balance integer, status text)
language sql stable
  set search_path = ''
as $$
  with totals as (
    select pay.subscription_id, sum(pay.amount) as total_paid
    from public.payments pay
    where pay.voided_at is null
    group by pay.subscription_id
  ),
  ordered as (
    select p.id, p.subscription_id, p.period_start, p.period_end, p.amount_due, p.due_date,
           coalesce(sum(p.amount_due) over (
             partition by p.subscription_id order by p.period_start, p.id
             rows between unbounded preceding and 1 preceding), 0) as due_before
    from public.subscription_periods p
  ),
  applied as (
    select o.*, least(o.amount_due, greatest(0, coalesce(t.total_paid, 0) - o.due_before))::integer as paid
    from ordered o left join totals t on t.subscription_id = o.subscription_id
  )
  select a.id, a.subscription_id, s.customer_id, c.name, s.plan_name_snapshot,
         a.period_start, a.period_end, a.amount_due, a.due_date,
         a.paid, (a.amount_due - a.paid),
         case when a.paid >= a.amount_due then 'paid'
              when p_today > a.due_date + g.overdue_grace_days then 'overdue'
              else 'unpaid' end
  from applied a
  join public.subscriptions s on s.id = a.subscription_id
  join public.customers c     on c.id = s.customer_id
  cross join public.ops_settings g
$$;

-- Subscription-level totals: what is due, what was paid, what is still owed, and overpayment credit.
create view public.subscription_balance with (security_invoker = true) as
with due as (
  select p.subscription_id, sum(p.amount_due)::bigint as total_due
  from public.subscription_periods p group by p.subscription_id
), paid as (
  select pay.subscription_id, sum(pay.amount)::bigint as total_paid
  from public.payments pay where pay.voided_at is null group by pay.subscription_id
)
select s.id as subscription_id, s.customer_id,
       coalesce(d.total_due, 0)  as total_due,
       coalesce(p.total_paid, 0) as total_paid,
       greatest(0, coalesce(d.total_due, 0) - coalesce(p.total_paid, 0)) as balance,
       greatest(0, coalesce(p.total_paid, 0) - coalesce(d.total_due, 0)) as credit
from public.subscriptions s
left join due d  on d.subscription_id = s.id
left join paid p on p.subscription_id = s.id;

-- ---------------------------------------------------------------------------------------------
-- Customer-level summary for the list filters (FR-25): current subscription, all statuses present,
-- renewal due, worst payment status, total balance. Worst = overdue, then unpaid, then paid.
-- ---------------------------------------------------------------------------------------------
create function app.customer_summary_at(p_today date)
returns table (
  customer_id uuid, current_subscription_id uuid, current_status text,
  subscription_statuses text[], renewal_due boolean, payment_status text, balance bigint)
language sql stable
  set search_path = ''
as $$
  -- Aggregate once per customer (a correlated subquery per customer was O(n^2): 13 s at 5,000 customers).
  with subs as (select * from app.subscription_status_at(p_today)),
       per  as (select * from app.period_payment_status_at(p_today)),
       sub_agg as (
         select s.customer_id, array_agg(distinct s.status order by s.status) as statuses, bool_or(s.renewal_due) as renewal_due
         from subs s group by s.customer_id),
       per_agg as (
         select q.customer_id, max(case q.status when 'overdue' then 2 when 'unpaid' then 1 else 0 end) as worst,
                sum(q.balance)::bigint as balance
         from per q group by q.customer_id),
       cur as (
         select distinct on (s.customer_id) s.customer_id, s.id, s.status
         from subs s
         order by s.customer_id,
                  case s.status when 'active' then 0 when 'paused' then 1 when 'upcoming' then 2 else 3 end,
                  s.end_date desc, s.id)
  select c.id, cur.id, cur.status,
         coalesce(sa.statuses, '{}'),
         coalesce(sa.renewal_due, false),
         case pa.worst when 2 then 'overdue' when 1 then 'unpaid' when 0 then 'paid' end,
         coalesce(pa.balance, 0)::bigint
  from public.customers c
  left join sub_agg sa on sa.customer_id = c.id
  left join per_agg pa on pa.customer_id = c.id
  left join cur        on cur.customer_id = c.id
$$;

-- ---------------------------------------------------------------------------------------------
-- Menu week status (architecture 8.3), derived from go-live times, never stored.
--   draft     : no go-live time
--   scheduled : go-live in the future
--   published : the released week with the latest go-live time that is not in the future
--   past      : released earlier and superseded
-- ---------------------------------------------------------------------------------------------
create function app.image_json(p_media_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('path', m.storage_path, 'alt', m.alt_text, 'width', m.width, 'height', m.height)
  from public.media m where m.id = p_media_id
$$;

-- The 21 working slots of a week as released JSON.
create function app.menu_snapshot(p_week_id uuid)
returns jsonb language sql stable
  set search_path = ''
as $$
  select jsonb_build_object('slots', coalesce(jsonb_agg(
           jsonb_build_object('day_of_week', s.day_of_week, 'meal', s.meal,
                              'dish_text', btrim(s.dish_text), 'not_served', s.not_served,
                              'media_id', s.media_id, 'image', app.image_json(s.media_id))
           order by s.day_of_week, case s.meal when 'breakfast' then 1 when 'lunch' then 2 else 3 end),
         '[]'::jsonb))
  from public.menu_slots s where s.menu_week_id = p_week_id
$$;

-- Comparable form of a slot array (used for "working copy differs from released copy").
create function app.slots_signature(p_slots jsonb)
returns jsonb language sql immutable
  set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'd', e ->> 'day_of_week', 'm', e ->> 'meal', 't', btrim(e ->> 'dish_text'),
           'n', (e ->> 'not_served')::boolean, 'i', e ->> 'media_id')
           order by (e ->> 'day_of_week')::int, case e ->> 'meal' when 'breakfast' then 1 when 'lunch' then 2 else 3 end),
         '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) e
$$;

-- The week that visitors see at instant p_now: latest go-live not in the future.
create function app.live_menu_week_at(p_now timestamptz)
returns uuid language sql stable security definer set search_path = ''
as $$
  select w.id from public.menu_weeks w
  where w.go_live_at is not null and w.go_live_at <= p_now
  order by w.go_live_at desc, w.live_set_at desc nulls last, w.id
  limit 1
$$;

create function app.menu_week_status_at(p_now timestamptz)
returns table (id uuid, week_start date, status text, go_live_at timestamptz,
               differs_from_released boolean, live_set_at timestamptz)
language sql stable
  set search_path = ''
as $$
  select w.id, w.week_start,
         case when w.go_live_at is null then 'draft'
              when w.go_live_at > p_now then 'scheduled'
              when w.id = app.live_menu_week_at(p_now) then 'published'
              else 'past' end,
         w.go_live_at,
         (w.live_payload is not null
          and app.slots_signature(app.menu_snapshot(w.id) -> 'slots') <> app.slots_signature(w.live_payload -> 'slots')),
         w.live_set_at
  from public.menu_weeks w
$$;

-- ---------------------------------------------------------------------------------------------
-- 9.3 Dashboard overview (FR-30): one row, same definitions as the lists above.
--     Active subscribers = distinct non-archived customers with an Active subscription (office
--     head-count shown separately). Unpaid/overdue = number of periods and the sum of their balances.
--     Renewal due = number of subscriptions flagged renewal due. Returns no row to a non-admin.
-- ---------------------------------------------------------------------------------------------
create function app.dashboard_overview_at(p_today date, p_now timestamptz)
returns table (
  today date, active_subscribers integer, office_members integer,
  unpaid_count integer, unpaid_total bigint, overdue_count integer, overdue_total bigint,
  renewal_due_count integer, renewal_window_days integer, total_customers integer,
  live_release_version integer, live_release_published_at timestamptz,
  live_menu_week_start date, scheduled_menu_week_start date, scheduled_menu_go_live_at timestamptz)
language sql stable
  set search_path = ''
as $$
  with subs as (select * from app.subscription_status_at(p_today)),
       per  as (select * from app.period_payment_status_at(p_today)),
       act  as (select distinct c.id, c.type, c.member_count
                from subs s join public.customers c on c.id = s.customer_id
                where s.status = 'active' and c.archived_at is null)
  select p_today,
         (select count(*) from act)::integer,
         (select coalesce(sum(a.member_count), 0) from act a where a.type = 'office')::integer,
         (select count(*) from per where status = 'unpaid')::integer,
         (select coalesce(sum(balance), 0) from per where status = 'unpaid')::bigint,
         (select count(*) from per where status = 'overdue')::integer,
         (select coalesce(sum(balance), 0) from per where status = 'overdue')::bigint,
         (select count(*) from subs where renewal_due)::integer,
         (select o.renewal_window_days from public.ops_settings o),
         (select count(*) from public.customers where archived_at is null)::integer,
         (select r.version from public.site_state st join public.content_releases r on r.id = st.current_release_id),
         (select r.published_at from public.site_state st join public.content_releases r on r.id = st.current_release_id),
         (select w.week_start from public.menu_weeks w where w.id = app.live_menu_week_at(p_now)),
         (select w.week_start from public.menu_weeks w where w.go_live_at > p_now order by w.go_live_at limit 1),
         (select w.go_live_at from public.menu_weeks w where w.go_live_at > p_now order by w.go_live_at limit 1)
  where (select app.is_admin())
$$;

-- ---------------------------------------------------------------------------------------------
-- The public views: today in Asia/Karachi, now().
-- ---------------------------------------------------------------------------------------------
create view public.subscription_status    with (security_invoker = true) as
  select * from app.subscription_status_at(app.karachi_today());
create view public.period_payment_status  with (security_invoker = true) as
  select * from app.period_payment_status_at(app.karachi_today());
create view public.customer_summary       with (security_invoker = true) as
  select * from app.customer_summary_at(app.karachi_today());
create view public.menu_week_status       with (security_invoker = true) as
  select * from app.menu_week_status_at(now());
create view public.dashboard_overview     with (security_invoker = true) as
  select * from app.dashboard_overview_at(app.karachi_today(), now());

grant select on public.subscription_status, public.period_payment_status, public.customer_summary,
                public.menu_week_status, public.dashboard_overview, public.subscription_balance,
                public.change_history
  to authenticated;

grant execute on function app.subscription_status_at(date)             to authenticated;
grant execute on function app.period_payment_status_at(date)           to authenticated;
grant execute on function app.customer_summary_at(date)                to authenticated;
grant execute on function app.menu_week_status_at(timestamptz)         to authenticated;
grant execute on function app.dashboard_overview_at(date, timestamptz) to authenticated;
grant execute on function app.menu_snapshot(uuid)                      to authenticated;
grant execute on function app.slots_signature(jsonb)                   to authenticated;
grant execute on function app.live_menu_week_at(timestamptz)           to authenticated;
grant execute on function app.image_json(uuid)                         to authenticated;
