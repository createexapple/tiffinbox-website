-- 20261122000004_audit.sql
-- Change history (FR-23, NFR-12). Append-only. Written by triggers and by the publish/rollback/menu/
-- anonymise functions. Nobody is granted INSERT, UPDATE or DELETE on this table.

create table public.audit_log (
  id                  bigint generated always as identity primary key,
  at                  timestamptz not null default now(),
  actor_user_id       uuid,
  actor_label         text not null,
  action              text not null,   -- insert | update | delete | publish | rollback | menu_saved | menu_released | anonymise | ...
  table_name          text not null,
  record_id           text,
  subject_customer_id uuid,            -- set for customer/subscription/period/payment rows; used for anonymisation
  old_values          jsonb,
  new_values          jsonb
);
comment on table public.audit_log is
  'FR-23 change history. Append-only (trigger + no grants). Only anonymise_customer() may redact personal values (Q-34).';
create index audit_log_at_idx       on public.audit_log (at desc, id desc);
create index audit_log_table_idx    on public.audit_log (table_name, at desc);
create index audit_log_customer_idx on public.audit_log (subject_customer_id, at desc) where subject_customer_id is not null;
create index audit_log_actor_idx    on public.audit_log (actor_user_id) where actor_user_id is not null;

-- Append-only guard. The redaction path in anonymise_customer() sets a transaction-local flag; no
-- API caller can set it because the API never runs arbitrary SQL, and no role has UPDATE/DELETE anyway.
create function app.audit_log_guard()
returns trigger language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_setting('app.audit_redaction', true) = 'on' then
    return new;
  end if;
  raise exception 'audit_log is append-only' using errcode = '42501';
end $$;
create trigger audit_log_guard before update or delete on public.audit_log
  for each row execute function app.audit_log_guard();

-- ---------------------------------------------------------------------------------------------
-- Explicit audit entries (used by functions that are not simple row changes).
-- ---------------------------------------------------------------------------------------------
create function app.write_audit(
  p_action text, p_table text, p_record_id text,
  p_old jsonb default null, p_new jsonb default null,
  p_subject uuid default null, p_actor uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := coalesce(p_actor, (select auth.uid()));
begin
  insert into public.audit_log (actor_user_id, actor_label, action, table_name, record_id,
                                subject_customer_id, old_values, new_values)
  values (v_actor, app.actor_label(v_actor), p_action, p_table, p_record_id, p_subject, p_old, p_new);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Row trigger. Arguments: mode ('diff' = only changed columns on update, 'full' = whole rows), pk column.
-- ---------------------------------------------------------------------------------------------
create function app.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_mode    text := coalesce(tg_argv[0], 'diff');
  v_pk      text := coalesce(tg_argv[1], 'id');
  v_old     jsonb;
  v_new     jsonb;
  v_old_out jsonb;
  v_new_out jsonb;
  v_row     jsonb;
  v_subject uuid;
  v_uid     uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_new_out := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_old_out, v_new_out
      from jsonb_object_keys(v_new) as k
     where (v_new -> k) is distinct from (v_old -> k) and k <> 'updated_at';
    if v_old_out is null then return new; end if;   -- only updated_at moved
    if v_mode = 'full' then v_old_out := v_old; v_new_out := v_new; end if;
  else
    v_old := to_jsonb(old); v_old_out := v_old;
  end if;

  v_row := coalesce(v_new, v_old);
  v_subject := case tg_table_name
    when 'customers'            then (v_row ->> 'id')::uuid
    when 'subscriptions'        then (v_row ->> 'customer_id')::uuid
    when 'payments'             then (v_row ->> 'customer_id')::uuid
    when 'subscription_periods' then (select s.customer_id from public.subscriptions s
                                       where s.id = (v_row ->> 'subscription_id')::uuid)
    else null end;

  insert into public.audit_log (actor_user_id, actor_label, action, table_name, record_id,
                                subject_customer_id, old_values, new_values)
  values (v_uid, app.actor_label(v_uid), lower(tg_op), tg_table_name, v_row ->> v_pk,
          v_subject, v_old_out, v_new_out);
  return null;
end $$;

-- Content (diffs) ------------------------------------------------------------------------------
create trigger audit_site_settings after insert or update or delete on public.site_settings
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_pricing_rules after insert or update or delete on public.pricing_rules
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_ops_settings after insert or update or delete on public.ops_settings
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_plans after insert or update or delete on public.plans
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_dishes after insert or update or delete on public.dishes
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_addons after insert or update or delete on public.addons
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_faq_entries after insert or update or delete on public.faq_entries
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_media after insert or update or delete on public.media
  for each row execute function app.audit_row_change('diff', 'id');
create trigger audit_page_images after insert or update or delete on public.page_images
  for each row execute function app.audit_row_change('diff', 'slot_key');
create trigger audit_admin_users after insert or update or delete on public.admin_users
  for each row execute function app.audit_row_change('diff', 'user_id');

-- Operations (whole rows, so earlier values stay readable: FR-23 AC 2) --------------------------
create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function app.audit_row_change('full', 'id');
create trigger audit_subscriptions after insert or update or delete on public.subscriptions
  for each row execute function app.audit_row_change('full', 'id');
create trigger audit_subscription_periods after insert or update or delete on public.subscription_periods
  for each row execute function app.audit_row_change('full', 'id');
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function app.audit_row_change('full', 'id');

-- Menu weeks and releases are audited by their functions (one entry per action, not per slot).

-- ---------------------------------------------------------------------------------------------
-- Friendly read model for the Change history screen (A-11).
-- ---------------------------------------------------------------------------------------------
create view public.change_history with (security_invoker = true) as
select a.id, a.at, a.actor_user_id, a.actor_label, a.action, a.table_name, a.record_id,
       a.subject_customer_id, a.old_values, a.new_values,
       case a.table_name
         when 'content_releases'      then 'Content publish'
         when 'menu_weeks'            then 'Menu'
         when 'plans'                 then 'Plans'
         when 'pricing_rules'         then 'Pricing rules'
         when 'dishes'                then 'Dishes'
         when 'addons'                then 'Add-ons'
         when 'faq_entries'           then 'FAQ'
         when 'site_settings'         then 'Settings'
         when 'ops_settings'          then 'Settings'
         when 'media'                 then 'Images'
         when 'page_images'           then 'Images'
         when 'customers'             then 'Customer'
         when 'subscriptions'         then 'Subscription'
         when 'subscription_periods'  then 'Subscription'
         when 'payments'              then 'Payment'
         else a.table_name
       end as record_type
from public.audit_log a;
