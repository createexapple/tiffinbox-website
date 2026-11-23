-- 20261122000007_publishing.sql
-- Draft -> immutable release -> current (ADR-0003; architecture 8.1, 8.2; FR-10, FR-22, NFR-08).
--
-- Error convention for the RPC functions (PostgREST maps SQLSTATE 'PTnnn' to HTTP status nnn):
--   PT400 validation failed (DETAIL carries a JSON array of {field,message}) - nothing changed
--   PT403 caller is not an active admin
--   PT404 not found
--
-- Every public.* function below that touches non-public data is SECURITY DEFINER with an empty
-- search_path and starts with an explicit admin check, because definer functions bypass RLS.

-- Monthly price when no override is stored (Q-10 unresolved; PROPOSAL, shown to the admin before publish):
--   4_weeks        : 4 x weekly price, less the saving %
--   calendar_month : 30/7 x weekly price, less the saving %
-- Whole rupees (rounded).
create function app.derived_monthly_price(p_weekly integer, p_saving numeric, p_rule text)
returns integer language sql immutable parallel safe
  set search_path = ''
as $$
  select case when p_weekly is null then null
              when p_rule = 'calendar_month' then round(p_weekly * 30.0 / 7.0 * (100 - p_saving) / 100.0)::integer
              else round(p_weekly * 4.0 * (100 - p_saving) / 100.0)::integer end
$$;

-- ---------------------------------------------------------------------------------------------
-- The public content document built from the DRAFT tables. Its checksum is compared with the current
-- release's checksum for the "unpublished changes" indicator (no dirty flags). The menu is not part of
-- the release document: menu weeks carry their own releases (architecture 8.3).
-- ---------------------------------------------------------------------------------------------
create function app.build_content_document()
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

create function app.content_checksum(p_doc jsonb)
returns text language sql immutable
  set search_path = ''
as $$ select encode(sha256(convert_to(p_doc::text, 'UTF8')), 'hex') $$;

-- Which areas differ between two documents (for the "unpublished changes" list).
create function app.changed_areas(p_a jsonb, p_b jsonb)
returns text[] language sql immutable
  set search_path = ''
as $$
  select coalesce(array_agg(m.label order by m.ord), '{}')
  from (values (1, 'settings', 'Settings'), (2, 'pricing_rules', 'Pricing rules'), (3, 'plans', 'Plans'),
               (4, 'dishes', 'Dishes'), (5, 'addons', 'Add-ons'), (6, 'faq', 'FAQ'), (7, 'page_images', 'Images'))
       as m(ord, key, label)
  where (p_a -> m.key) is distinct from (p_b -> m.key)
$$;

-- ---------------------------------------------------------------------------------------------
-- Publish validation (FR-10, FR-16, FR-20; PRD acceptance criteria). Returns [] when publishable.
-- ---------------------------------------------------------------------------------------------
create function app.publish_errors()
returns jsonb language sql stable security definer set search_path = ''
as $$
  with s as (select * from public.site_settings),
  errs(field, message) as (
    select 'settings.whatsapp_number',
           'WhatsApp number must be digits only in international format, for example 923001234567.'
      from s where s.whatsapp_number !~ '^[1-9][0-9]{7,14}$'
    union all select 'settings.business_name', 'Business name is not set.'
      from s where app.is_blank_or_placeholder(s.business_name)
    union all select 'settings.instagram_handle', 'Instagram handle is not set.'
      from s where app.is_blank_or_placeholder(s.instagram_handle)
    union all select 'settings.order_hours', 'Order hours are not set.'
      from s where app.is_blank_or_placeholder(s.order_hours)
    union all select 'settings.delivery_area_text', 'Delivery area text is not set.'
      from s where app.is_blank_or_placeholder(s.delivery_area_text)
    union all select 'settings.delivery_times.' || m, 'Delivery time for ' || m || ' is not a valid HH:mm time.'
      from s, unnest(array['breakfast', 'lunch', 'dinner']) as m
      where not app.valid_hhmm(s.delivery_times ->> m)
    union all select 'settings.skip_cutoffs.' || m, 'Skip cut-off time for ' || m || ' is not a valid HH:mm time.'
      from s, unnest(array['breakfast', 'lunch', 'dinner']) as m
      where not app.valid_hhmm(s.skip_cutoffs ->> m)
    union all select 'plans', 'At least one active plan is needed.'
      where not exists (select 1 from public.plans where is_active)
    union all select 'plans.' || p.id::text,
           p.name || ': set a price per meal or day and a weekly price before publishing.'
      from public.plans p
      where p.is_active and (p.unit_price is null or p.weekly_price is null)
  )
  select coalesce(jsonb_agg(jsonb_build_object('field', e.field, 'message', e.message)), '[]'::jsonb) from errs e
$$;

-- ---------------------------------------------------------------------------------------------
-- Publish core (also used by the synthetic seed with no actor). ONE transaction: validate, write
-- release, repoint site_state, audit. Any failure rolls everything back; the live site stays on the
-- previous release (FR-22).
-- ---------------------------------------------------------------------------------------------
create function app.do_publish(p_note text, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_errors  jsonb;
  v_doc     jsonb;
  v_sum     text;
  v_version integer;
  v_id      bigint;
  v_at      timestamptz := now();
  v_prev    jsonb;
begin
  perform 1 from public.site_state where id = 1 for update;   -- serialise concurrent publishes

  v_errors := app.publish_errors();
  if jsonb_array_length(v_errors) > 0 then
    raise exception 'validation_failed' using errcode = 'PT400', detail = v_errors::text;
  end if;

  v_doc := app.build_content_document();
  v_sum := app.content_checksum(v_doc);
  select r.payload into v_prev
    from public.site_state st join public.content_releases r on r.id = st.current_release_id;
  select coalesce(max(version), 0) + 1 into v_version from public.content_releases;

  insert into public.content_releases (version, payload, checksum, published_at, published_by, note)
  values (v_version, v_doc, v_sum, v_at, p_actor, coalesce(p_note, ''))
  returning id into v_id;

  update public.site_state set current_release_id = v_id where id = 1;

  perform app.write_audit('publish', 'content_releases', v_version::text, null,
    jsonb_build_object('version', v_version, 'checksum', v_sum, 'note', coalesce(p_note, ''),
                       'changed_areas', to_jsonb(app.changed_areas(v_prev, v_doc))),
    null, p_actor);

  return jsonb_build_object('version', v_version, 'published_at', v_at, 'checksum', v_sum);
end $$;

-- Parameter names match the JSON keys of docs/api/openapi.yaml (PostgREST maps body keys to argument names).
create function public.publish_content(note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  if char_length(coalesce(note, '')) > 200 then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"note","message":"Note is too long (max 200 characters)."}]';
  end if;
  return app.do_publish(note, (select auth.uid()));
end $$;

create function public.rollback_release(version integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_rel  public.content_releases;
  v_prev integer;
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  perform 1 from public.site_state where id = 1 for update;
  select r.* into v_rel from public.content_releases r where r.version = rollback_release.version;
  if not found then raise exception 'release not found' using errcode = 'PT404'; end if;
  select r.version into v_prev from public.site_state st join public.content_releases r on r.id = st.current_release_id;

  update public.site_state set current_release_id = v_rel.id where id = 1;   -- drafts are not touched

  perform app.write_audit('rollback', 'content_releases', version::text,
    jsonb_build_object('version', v_prev), jsonb_build_object('version', version));
  return jsonb_build_object('version', v_rel.version, 'published_at', v_rel.published_at, 'checksum', v_rel.checksum);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Reading: published (public), draft (admin preview), status (admin)
-- ---------------------------------------------------------------------------------------------
-- A menu object in the PublicContent shape. Released = from the snapshot; otherwise the working slots.
create function app.menu_json(p_week_id uuid, p_from_snapshot boolean, p_now timestamptz)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'week_start', w.week_start,
    'went_live_at', case when p_from_snapshot then w.go_live_at end,
    'is_current_week', app.karachi_today(p_now) <= w.week_start + 6,
    'slots', (select coalesce(jsonb_agg(e - 'media_id' order by t.ord), '[]'::jsonb)
              from jsonb_array_elements(
                     case when p_from_snapshot then w.live_payload -> 'slots'
                          else app.menu_snapshot(w.id) -> 'slots' end) with ordinality as t(e, ord)))
  from public.menu_weeks w
  where w.id = p_week_id
$$;

-- Published content at an instant. If no week covers the current calendar week, the most recent
-- released week is still returned, with is_current_week = false so the page can say "last updated"
-- (FR-06). Returns NULL when nothing has ever been published (the app then uses its last-good copy).
create function app.public_content_at(p_now timestamptz)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select r.payload
         || jsonb_build_object(
              'release', jsonb_build_object('version', r.version, 'published_at', r.published_at),
              'menu', app.menu_json(app.live_menu_week_at(p_now), true, p_now))
  from public.site_state st
  join public.content_releases r on r.id = st.current_release_id
$$;

-- THE ONLY object the public (anon) role may use. No draft, no customer data.
create function public.get_public_content()
returns jsonb language sql stable security definer set search_path = ''
as $$ select app.public_content_at(now()) $$;

create function public.get_draft_content(menu_week_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_variable
declare v_week uuid;
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  v_week := coalesce(menu_week_id, app.live_menu_week_at(now()));
  return app.build_content_document()
         || jsonb_build_object(
              'release', jsonb_build_object('version', null, 'draft', true),
              'menu', app.menu_json(v_week, false, now()));
end $$;

create function public.draft_status()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_doc  jsonb := app.build_content_document();
  v_rel  public.content_releases;
  v_menu jsonb;
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  select r.* into v_rel from public.site_state st join public.content_releases r on r.id = st.current_release_id;
  select jsonb_build_object('id', m.id, 'week_start', m.week_start, 'status', m.status,
                            'go_live_at', m.go_live_at, 'differs_from_released', m.differs_from_released)
    into v_menu
    from app.menu_week_status_at(now()) m
    where m.status = 'scheduled' order by m.go_live_at limit 1;
  return jsonb_build_object(
    'has_unpublished_changes', v_rel.id is null or v_rel.checksum <> app.content_checksum(v_doc),
    'current_release_version', v_rel.version,
    'changed_areas', to_jsonb(case when v_rel.id is null then app.changed_areas('{}'::jsonb, v_doc)
                                   else app.changed_areas(v_rel.payload, v_doc) end),
    'publish_errors', app.publish_errors(),
    'scheduled_menu', v_menu);
end $$;

grant execute on function app.derived_monthly_price(integer, numeric, text) to authenticated;
grant execute on function public.get_public_content()           to anon, authenticated;
grant execute on function public.get_draft_content(uuid)        to authenticated;
grant execute on function public.draft_status()                 to authenticated;
grant execute on function public.publish_content(text)          to authenticated;
grant execute on function public.rollback_release(integer)      to authenticated;
