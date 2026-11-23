-- 20261123000013_app_spec_fields.sql
-- CR-004: website content aligned with the Tiffin Box app (spec of 23 Nov 2026).
--   * plans: a tag ("New", "Cheapest"), an optional upper per-meal price (a range such as Rs 750-800) and a period
--     label for plans that are not weekly ("for 3 days"; empty means "a week").
--   * pricing_rules: delivery charge, late-night meal price and late-night surcharge (whole PKR).
--   * app.build_content_document() carries the new keys. Schema version stays 1: readers treat the new keys as optional,
--     so an older published document keeps working.
-- Columns only; no RLS, grant or audit changes (the audit trigger records whole-row diffs, so new columns are covered;
-- admin screens write explicit column lists and leave these columns alone).

alter table public.plans
  add column tag             text not null default ''
    check (char_length(tag) <= 40 and tag !~ '[<>]'),
  add column unit_price_to   integer
    check (unit_price_to is null or unit_price_to > unit_price),
  add column period_label    text not null default ''
    check (char_length(period_label) <= 40 and period_label !~ '[<>]');
comment on column public.plans.tag is 'CR-004: badge text such as New or Cheapest. Empty = none.';
comment on column public.plans.unit_price_to is 'CR-004: upper end of a per-meal price range (NULL = a single price).';
comment on column public.plans.period_label is 'CR-004: what weekly_price covers when it is not a week, e.g. "for 3 days". Empty = "a week".';

alter table public.pricing_rules
  add column delivery_charge        integer not null default 150 check (delivery_charge >= 0),
  add column late_night_meal_price  integer not null default 650 check (late_night_meal_price >= 0),
  add column late_night_surcharge   integer not null default 100 check (late_night_surcharge >= 0);

create or replace function app.build_content_document()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', 1,
    'settings', (select jsonb_build_object(
        'business_name', s.business_name, 'tagline', s.tagline,
        'whatsapp_number', s.whatsapp_number, 'instagram_handle', s.instagram_handle,
        'order_hours', s.order_hours, 'last_order_time', s.last_order_time,
        'area_served', s.area_served, 'delivery_area_text', s.delivery_area_text,
        'delivery_boundary_text', s.delivery_boundary_text,
        'legal_name_and_address', s.legal_name_and_address,
        'delivery_times', s.delivery_times, 'skip_cutoffs', s.skip_cutoffs,
        'skip_cutoff_days', s.skip_cutoff_days, 'skips_per_week', s.skips_per_week,
        'payment_methods', s.payment_methods)
      from public.site_settings s),
    'pricing_rules', (select jsonb_build_object(
        'monthly_saving_percent', trim_scale(r.monthly_saving_percent),
        'breakfast_addon_price', r.breakfast_addon_price,
        'team_deal_text', r.team_deal_text, 'team_min_people', r.team_min_people,
        'delivery_charge', r.delivery_charge,
        'late_night_meal_price', r.late_night_meal_price,
        'late_night_surcharge', r.late_night_surcharge)
      from public.pricing_rules r),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'audience', p.audience, 'meals_included', p.meals_included,
        'price_unit', p.price_unit, 'unit_price', p.unit_price, 'weekly_price', p.weekly_price,
        'monthly_price', coalesce(p.monthly_price,
                          app.derived_monthly_price(p.weekly_price, r.monthly_saving_percent, o.monthly_period_rule)),
        'is_most_popular', p.is_most_popular, 'sort_order', p.sort_order,
        'tag', p.tag, 'unit_price_to', p.unit_price_to, 'period_label', p.period_label)
        order by p.sort_order, p.id), '[]'::jsonb)
      from public.plans p cross join public.pricing_rules r cross join public.ops_settings o
      where p.is_active),
    'dishes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'comes_with', d.comes_with, 'price', d.price,
        'image', app.image_json(d.media_id)) order by d.sort_order, d.id), '[]'::jsonb)
      from public.dishes d where not d.is_hidden),
    'addons', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'price', a.price) order by a.sort_order, a.id), '[]'::jsonb)
      from public.addons a where not a.is_hidden),
    'faq', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'question', f.question, 'answer', f.answer) order by f.sort_order, f.id), '[]'::jsonb)
      from public.faq_entries f where not f.is_hidden),
    'page_images', (select coalesce(jsonb_object_agg(pi.slot_key, app.image_json(pi.media_id)), '{}'::jsonb)
      from public.page_images pi)
  )
$$;
