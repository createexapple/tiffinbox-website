-- Rollback of 20261123000013: restores the previous content document builder, then drops the CR-004 columns.
-- Plan tags, price ranges, period labels, delivery charge and late-night prices are deleted with the columns.
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
        'team_deal_text', r.team_deal_text, 'team_min_people', r.team_min_people)
      from public.pricing_rules r),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'audience', p.audience, 'meals_included', p.meals_included,
        'price_unit', p.price_unit, 'unit_price', p.unit_price, 'weekly_price', p.weekly_price,
        'monthly_price', coalesce(p.monthly_price,
                          app.derived_monthly_price(p.weekly_price, r.monthly_saving_percent, o.monthly_period_rule)),
        'is_most_popular', p.is_most_popular, 'sort_order', p.sort_order)
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

alter table public.plans drop column if exists tag, drop column if exists unit_price_to, drop column if exists period_label;
alter table public.pricing_rules drop column if exists delivery_charge, drop column if exists late_night_meal_price,
  drop column if exists late_night_surcharge;
