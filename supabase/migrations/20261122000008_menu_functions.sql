-- 20261122000008_menu_functions.sql
-- Menu weeks: save, copy, publish now / schedule / cancel (FR-14, FR-15, FR-06; architecture 8.3, 8.4).
-- Admin-only SECURITY DEFINER functions: menu_weeks and menu_slots have no direct write grants.
-- Parameter names match docs/api/openapi.yaml. Errors: PT400 validation, PT403 not admin, PT404 not found.
-- Slot JSON: {"day_of_week":1..7 (1 = Monday), "meal":"breakfast|lunch|dinner", "dish_text":"...",
--             "not_served":false, "media_id": uuid|null}

create function app.menu_week_json(p_week_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', m.id, 'week_start', m.week_start, 'status', m.status,
                            'go_live_at', m.go_live_at, 'differs_from_released', m.differs_from_released)
  from app.menu_week_status_at(now()) m where m.id = p_week_id
$$;

-- Validation of 21 slots. Returns [] when valid. p_release = also require text or not_served per slot.
create function app.menu_slot_errors(p_slots jsonb, p_release boolean)
returns jsonb language plpgsql immutable
  set search_path = ''
as $$
declare
  v_errs jsonb := '[]'::jsonb;
  e jsonb;
  v_seen text[] := '{}';
  v_key text;
  v_text text;
begin
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) <> 21 then
    return jsonb_build_array(jsonb_build_object('field', 'slots', 'message', 'A week needs exactly 21 slots (7 days x 3 meals).'));
  end if;
  for e in select * from jsonb_array_elements(p_slots) loop
    v_key := coalesce(e ->> 'day_of_week', '') || '/' || coalesce(e ->> 'meal', '');
    if coalesce(e ->> 'day_of_week', '') !~ '^[1-7]$' or coalesce(e ->> 'meal', '') not in ('breakfast', 'lunch', 'dinner') then
      v_errs := v_errs || jsonb_build_object('field', 'slots.' || v_key, 'message', 'Slot needs day_of_week 1..7 and a meal.');
      continue;
    end if;
    if v_key = any (v_seen) then
      v_errs := v_errs || jsonb_build_object('field', 'slots.' || v_key, 'message', 'Duplicate slot.');
    end if;
    v_seen := v_seen || v_key;
    v_text := btrim(coalesce(e ->> 'dish_text', ''));
    if char_length(v_text) > 200 then
      v_errs := v_errs || jsonb_build_object('field', 'slots.' || v_key, 'message', 'Dish text is too long (max 200 characters).');
    elsif v_text ~ '[<>]' then
      v_errs := v_errs || jsonb_build_object('field', 'slots.' || v_key, 'message', 'Dish text cannot contain < or >. Plain text only.');
    end if;
    if p_release and v_text = '' and not coalesce((e ->> 'not_served')::boolean, false) then
      v_errs := v_errs || jsonb_build_object('field', 'slots.' || v_key, 'message', 'Enter a dish or mark the slot as not served.');
    end if;
  end loop;
  return v_errs;
end $$;

-- Save the 21 working slots of a week, creating the week if needed. If the week is SCHEDULED its
-- snapshot is refreshed in the same transaction (FR-15). A LIVE or past week changes only its working
-- copy until it is released again (FR-14). One audit entry per save.
create function public.save_menu_week(week_start date, slots jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_errs   jsonb;
  v_id     uuid;
  v_go     timestamptz;
  e        jsonb;
  v_changed jsonb := '[]'::jsonb;
  v_old    record;
  v_exists boolean;
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  if week_start is null or extract(isodow from week_start) <> 1 then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"week_start","message":"A menu week starts on a Monday."}]';
  end if;
  v_errs := app.menu_slot_errors(slots, false);
  if jsonb_array_length(v_errs) > 0 then
    raise exception 'validation_failed' using errcode = 'PT400', detail = v_errs::text;
  end if;

  select w.id, w.go_live_at into v_id, v_go from public.menu_weeks w where w.week_start = save_menu_week.week_start for update;
  if v_id is null then
    insert into public.menu_weeks (week_start) values (week_start) returning id into v_id;
  end if;

  for e in select * from jsonb_array_elements(slots) loop
    select s.dish_text, s.not_served, s.media_id into v_old
      from public.menu_slots s
      where s.menu_week_id = v_id and s.day_of_week = (e ->> 'day_of_week')::int and s.meal = e ->> 'meal';
    v_exists := found;
    if not v_exists
       or v_old.dish_text is distinct from btrim(coalesce(e ->> 'dish_text', ''))
       or v_old.not_served is distinct from coalesce((e ->> 'not_served')::boolean, false)
       or v_old.media_id is distinct from nullif(e ->> 'media_id', '')::uuid then
      v_changed := v_changed || jsonb_build_object(
        'day_of_week', (e ->> 'day_of_week')::int, 'meal', e ->> 'meal',
        'from', case when v_exists then v_old.dish_text end,
        'to', btrim(coalesce(e ->> 'dish_text', '')));
    end if;
    insert into public.menu_slots (menu_week_id, day_of_week, meal, dish_text, not_served, media_id)
    values (v_id, (e ->> 'day_of_week')::int, e ->> 'meal', btrim(coalesce(e ->> 'dish_text', '')),
            coalesce((e ->> 'not_served')::boolean, false), nullif(e ->> 'media_id', '')::uuid)
    on conflict (menu_week_id, day_of_week, meal)
    do update set dish_text = excluded.dish_text, not_served = excluded.not_served, media_id = excluded.media_id;
  end loop;

  if v_go is not null and v_go > now() then   -- scheduled: the snapshot follows the edit
    update public.menu_weeks w set live_payload = app.menu_snapshot(v_id) where w.id = v_id;
  end if;

  if jsonb_array_length(v_changed) > 0 then
    perform app.write_audit('menu_saved', 'menu_weeks', week_start::text, null,
      jsonb_build_object('week_start', week_start, 'changed_slots', v_changed));
  end if;
  return app.menu_week_json(v_id);
end $$;

-- Copy last week: a new DRAFT week pre-filled with the 21 slots of another week (FR-15).
create function public.copy_menu_week(source_week_id uuid, week_start date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare v_id uuid;
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  if week_start is null or extract(isodow from week_start) <> 1 then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"week_start","message":"A menu week starts on a Monday."}]';
  end if;
  if not exists (select 1 from public.menu_weeks w where w.id = source_week_id) then
    raise exception 'source week not found' using errcode = 'PT404';
  end if;
  if exists (select 1 from public.menu_weeks w where w.week_start = copy_menu_week.week_start) then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"week_start","message":"That week already exists."}]';
  end if;
  insert into public.menu_weeks (week_start) values (week_start) returning id into v_id;
  insert into public.menu_slots (menu_week_id, day_of_week, meal, dish_text, not_served, media_id)
    select v_id, s.day_of_week, s.meal, s.dish_text, s.not_served, s.media_id
    from public.menu_slots s where s.menu_week_id = source_week_id;
  perform app.write_audit('menu_copied', 'menu_weeks', week_start::text, null,
    jsonb_build_object('week_start', week_start, 'copied_from', source_week_id));
  return app.menu_week_json(v_id);
end $$;

-- publish_now | schedule | cancel_schedule. The live menu is untouched by schedule and cancel_schedule.
create function public.release_menu_week(menu_week_id uuid, mode text, go_live_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  v_week public.menu_weeks;
  v_errs jsonb;
  v_when timestamptz;
  v_uid  uuid := (select auth.uid());
begin
  if not app.is_admin() then raise exception 'forbidden' using errcode = 'PT403'; end if;
  select w.* into v_week from public.menu_weeks w where w.id = menu_week_id for update;
  if not found then raise exception 'menu week not found' using errcode = 'PT404'; end if;

  if mode = 'cancel_schedule' then
    if v_week.go_live_at is null or v_week.go_live_at <= now() then
      raise exception 'validation_failed' using errcode = 'PT400',
        detail = '[{"field":"mode","message":"Only a scheduled menu can be cancelled; this one is a draft or already live."}]';
    end if;
    update public.menu_weeks w
       set go_live_at = null, live_payload = null, live_set_at = null, live_set_by = null, go_live_notified_at = null
     where w.id = menu_week_id;
    perform app.write_audit('menu_released', 'menu_weeks', v_week.week_start::text,
      jsonb_build_object('go_live_at', v_week.go_live_at), jsonb_build_object('mode', 'cancel_schedule'));
    return app.menu_week_json(menu_week_id);
  end if;

  if mode not in ('publish_now', 'schedule') then
    raise exception 'validation_failed' using errcode = 'PT400',
      detail = '[{"field":"mode","message":"Mode must be publish_now, schedule or cancel_schedule."}]';
  end if;

  v_errs := app.menu_slot_errors((app.menu_snapshot(menu_week_id) -> 'slots'), true);
  if jsonb_array_length(v_errs) > 0 then
    raise exception 'validation_failed' using errcode = 'PT400', detail = v_errs::text;
  end if;

  if mode = 'schedule' then
    if go_live_at is null or go_live_at <= now() then
      raise exception 'validation_failed' using errcode = 'PT400',
        detail = '[{"field":"go_live_at","message":"The go-live time must be in the future."}]';
    end if;
    if v_week.go_live_at is not null and v_week.go_live_at <= now() then
      raise exception 'validation_failed' using errcode = 'PT400',
        detail = '[{"field":"mode","message":"This week is already released; use publish_now to release new edits."}]';
    end if;
    v_when := go_live_at;
  else
    v_when := now();
  end if;

  update public.menu_weeks w
     set go_live_at = v_when, live_payload = app.menu_snapshot(menu_week_id),
         live_set_at = now(), live_set_by = v_uid, go_live_notified_at = null
   where w.id = menu_week_id;

  perform app.write_audit('menu_released', 'menu_weeks', v_week.week_start::text,
    jsonb_build_object('go_live_at', v_week.go_live_at),
    jsonb_build_object('mode', mode, 'go_live_at', v_when));
  return app.menu_week_json(menu_week_id);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Go-live notifier support (architecture 8.4). The cron job itself needs pg_cron + pg_net + Vault
-- secrets and an environment-specific URL, so it is NOT a migration: see supabase/ops/menu_go_live_cron.sql.
-- ---------------------------------------------------------------------------------------------
create function app.pending_go_live_notifications()
returns table (menu_week_id uuid, week_start date, go_live_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select w.id, w.week_start, w.go_live_at from public.menu_weeks w
  where w.go_live_at is not null and w.go_live_at <= now() and w.go_live_at > now() - interval '1 day'
    and w.go_live_notified_at is null
  order by w.go_live_at
$$;

create function app.mark_go_live_notified(p_week_id uuid)
returns void language sql volatile security definer set search_path = ''
as $$ update public.menu_weeks set go_live_notified_at = now() where id = p_week_id and go_live_notified_at is null $$;

grant execute on function app.menu_week_json(uuid)             to authenticated;
grant execute on function app.menu_slot_errors(jsonb, boolean) to authenticated;
grant execute on function public.save_menu_week(date, jsonb)   to authenticated;
grant execute on function public.copy_menu_week(uuid, date)    to authenticated;
grant execute on function public.release_menu_week(uuid, text, timestamptz) to authenticated;
