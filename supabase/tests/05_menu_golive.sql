-- 05_menu_golive.sql : menu weeks - draft / scheduled / published / past by go-live TIME, scheduled go-live with
-- no job, editing live vs scheduled weeks, cancel, copy, FR-06 fallback (architecture 8.3, 8.4; FR-06, FR-14, FR-15).
-- Part 1 pins the time rule at explicit instants (app.*_at functions; no clock hook).
-- Part 2 drives the admin RPCs with the real clock, using far-future (2099) dates.
select tt.as_postgres();
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''

-- a publishable draft so that get_public_content has a release to attach the menu to
update public.site_settings set whatsapp_number = '920000000001', instagram_handle = 'x.y', order_hours = 'hours',
  delivery_area_text = 'Area', delivery_times = '{"breakfast":"08:00","lunch":"13:00","dinner":"20:00"}',
  skip_cutoffs = '{"breakfast":"22:00","lunch":"10:00","dinner":"17:00"}' where id = 1;
insert into public.plans (name, unit_price, weekly_price) values ('P', 100, 700);
select app.do_publish('menu test', null);

create function tt.mkweek(p_id uuid, p_start date, p_label text) returns void language plpgsql as $$
begin
  insert into public.menu_weeks (id, week_start) values (p_id, p_start);
  insert into public.menu_slots (menu_week_id, day_of_week, meal, dish_text)
    select p_id, d, m, p_label || ' d' || d || ' ' || m from generate_series(1, 7) d cross join unnest(array['breakfast','lunch','dinner']) m;
end $$;
create function tt.release_at(p_id uuid, p_go timestamptz) returns void language sql as $$
  update public.menu_weeks set go_live_at = p_go, live_payload = app.menu_snapshot(id), live_set_at = p_go where id = p_id $$;
create function tt.live_week(p_ts timestamptz) returns text language sql stable as $$
  select (app.public_content_at(p_ts) #>> '{menu,week_start}') $$;
create function tt.wstat(p_label text, p_ts timestamptz) returns text language sql stable as $$
  select status from app.menu_week_status_at(p_ts) m join public.menu_weeks w on w.id = m.id
   where w.id = ('ee000000-0000-4000-8000-00000000000' || p_label)::uuid $$;

select tt.mkweek('ee000000-0000-4000-8000-000000000001', '2026-11-16', 'A');
select tt.mkweek('ee000000-0000-4000-8000-000000000002', '2026-11-23', 'B');
select tt.mkweek('ee000000-0000-4000-8000-000000000003', '2026-11-30', 'C');
select tt.mkweek('ee000000-0000-4000-8000-000000000004', '2026-12-07', 'D');   -- stays a draft
select tt.release_at('ee000000-0000-4000-8000-000000000001', '2026-11-15 18:00+05');
select tt.release_at('ee000000-0000-4000-8000-000000000002', '2026-11-22 18:00+05');
select tt.release_at('ee000000-0000-4000-8000-000000000003', '2026-11-29 18:00+05');

-- ------------------------------ Part 1: resolution by go-live time ------------------------------
select tt.is(tt.live_week('2026-11-15 17:59:59+05'), null, 'before any go-live time there is no live menu (menu is null; the page uses its fallback)');
select tt.is(tt.live_week('2026-11-15 18:00:00+05'), '2026-11-16', 'at A''s go-live instant A is live (boundary: go_live <= now)');
select tt.is(tt.live_week('2026-11-22 17:59:59+05'), '2026-11-16', 'one second before B''s go-live A is still live');
select tt.is(tt.live_week('2026-11-22 18:00:00+05'), '2026-11-23', 'at B''s go-live instant B becomes live with no job having run');
select tt.is(tt.live_week('2026-11-29 18:00:00+05'), '2026-11-30', 'at C''s go-live instant C becomes live');
select tt.is(tt.live_week('2027-06-01 00:00+05'), '2026-11-30', 'long after, the latest released week stays live (never an empty menu)');
select tt.is(tt.wstat('1', '2026-11-15 17:00+05'), 'scheduled', 'before its go-live a released week is scheduled');
select tt.is(tt.wstat('1', '2026-11-18 12:00+05'), 'published', 'A is published during its week');
select tt.is(tt.wstat('2', '2026-11-18 12:00+05'), 'scheduled', 'B is scheduled while A is live');
select tt.is(tt.wstat('3', '2026-11-18 12:00+05'), 'scheduled', 'C is scheduled while A is live');
select tt.is(tt.wstat('4', '2026-11-18 12:00+05'), 'draft', 'a week with no go-live time is a draft');
select tt.is(tt.wstat('1', '2026-11-23 12:00+05'), 'past', 'once B is live, A is past');
select tt.is(tt.wstat('2', '2026-11-23 12:00+05'), 'published', 'once B is live, B is published');
select tt.is(tt.wstat('3', '2026-11-23 12:00+05'), 'scheduled', 'C is still scheduled');
select tt.is(tt.wstat('4', '2027-06-01 00:00+05'), 'draft', 'a draft never goes live by itself');
select tt.is((select count(*) from app.menu_week_status_at('2026-11-23 12:00+05') where status = 'published'), 1::bigint, 'exactly one week is published at any instant');
select tt.is(tt.live_week('2026-11-22 18:00:00+05'), tt.live_week('2026-11-22 13:00:00+00'), 'the same instant in UTC and in +05 resolves the same week');
-- is_current_week: false only when the newest released week is older than this calendar week (FR-06)
select tt.is((app.public_content_at('2026-11-22 18:00+05') #>> '{menu,is_current_week}')::boolean, true, 'B is live on Sunday evening before its Monday start: not a stale menu');
select tt.is((app.public_content_at('2026-11-25 12:00+05') #>> '{menu,is_current_week}')::boolean, true, 'mid-week: current');
select tt.is((app.public_content_at('2026-12-06 23:59:59+05') #>> '{menu,is_current_week}')::boolean, true, 'C on its last second: still the current week');
select tt.is((app.public_content_at('2026-12-07 00:00:00+05') #>> '{menu,is_current_week}')::boolean, false, 'the next Monday with no new menu: stale, page shows "last updated" (FR-06)');
select tt.is((app.public_content_at('2026-12-07 00:00:00+05') #>> '{menu,week_start}'), '2026-11-30', 'the stale menu still carries its week start');
select tt.is(jsonb_array_length(app.public_content_at('2026-11-25 12:00+05') #> '{menu,slots}'), 21, 'the live menu has 21 slots');
select tt.is((app.public_content_at('2026-11-25 12:00+05') #>> '{menu,slots,0,dish_text}'), 'B d1 breakfast', 'slots are ordered Monday breakfast first');
select tt.is((app.public_content_at('2026-11-25 12:00+05') #>> '{menu,slots,20,dish_text}'), 'B d7 dinner', 'slots end with Sunday dinner');
select tt.ok((app.public_content_at('2026-11-25 12:00+05') #> '{menu,slots,0}') ? 'media_id' = false, 'internal media ids are not exposed in the public menu');
-- tie-break: two weeks with the same go-live instant -> the most recently set one wins
select tt.release_at('ee000000-0000-4000-8000-000000000004', '2026-11-29 18:00+05');
update public.menu_weeks set live_set_at = '2026-11-29 19:00+05' where id = 'ee000000-0000-4000-8000-000000000004';
select tt.is(tt.live_week('2026-11-30 00:00+05'), '2026-12-07', 'equal go-live times: the most recently set week wins');
update public.menu_weeks set go_live_at = null, live_payload = null, live_set_at = null where id = 'ee000000-0000-4000-8000-000000000004';
-- no live week at all
select tt.is((select count(*) from app.menu_week_status_at('2020-01-01 00:00+05') where status = 'published'), 0::bigint, 'no published week before the first go-live');
-- notifier support (architecture 8.4)
select tt.is((select count(*) from app.pending_go_live_notifications() where go_live_at > now()), 0::bigint, 'the notifier never lists a week whose go-live is in the future');
select app.mark_go_live_notified('ee000000-0000-4000-8000-000000000003');
select tt.ok((select go_live_notified_at is not null from public.menu_weeks where id = 'ee000000-0000-4000-8000-000000000003'), 'mark_go_live_notified stamps the week');

-- ------------------------------ Part 2: the admin RPCs ------------------------------
delete from public.menu_weeks;  -- clean slate
create function tt.slots(p_prefix text) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('day_of_week', d, 'meal', m, 'dish_text', p_prefix || ' d' || d || ' ' || m, 'not_served', false)
                   order by d, array_position(array['breakfast','lunch','dinner'], m))
  from generate_series(1, 7) d cross join unnest(array['breakfast','lunch','dinner']) m $$;
create function tt.wid(p_start date) returns uuid language sql stable as $$ select id from public.menu_weeks where week_start = p_start $$;
create function tt.wst(p_start date) returns text language sql stable as $$ select status from public.menu_week_status where week_start = p_start $$;

select tt.as_user(:A::uuid);
select tt.is((public.save_menu_week('2099-01-05', tt.slots('L')) ->> 'status'), 'draft', 'a newly saved week is a draft');
select tt.is((select count(*) from public.menu_slots where menu_week_id = tt.wid('2099-01-05')), 21::bigint, 'save_menu_week stored 21 slots');
select tt.is((public.get_public_content() #>> '{menu}'), null, 'a draft never appears to visitors');
select tt.throws($$select public.save_menu_week('2099-01-06', tt.slots('x'))$$, 'PT400', 'a week must start on a Monday');
select tt.throws($$select public.save_menu_week('2099-01-12', '[]')$$, 'PT400', 'a week needs exactly 21 slots');
select tt.throws($$select public.save_menu_week('2099-01-12', tt.slots('x') || '[{"day_of_week":1,"meal":"lunch","dish_text":"dup","not_served":false}]'::jsonb)$$, 'PT400', '22 slots rejected');
select tt.throws($$select public.save_menu_week('2099-01-12', jsonb_set(tt.slots('x'), '{3,day_of_week}', '8'))$$, 'PT400', 'day_of_week 8 rejected');
select tt.ok(tt.err($$select public.save_menu_week('2099-01-12', jsonb_set(tt.slots('x'), '{3,dish_text}', '"<b>bold</b>"'))$$) like 'PT400%Plain text only%', 'markup in dish text is rejected with a clear message');
select tt.ok(tt.err($$select public.save_menu_week('2099-01-12', jsonb_set(tt.slots('x'), '{3,dish_text}', to_jsonb(repeat('z', 201))))$$) like 'PT400%too long%', 'over-long dish text is rejected');
select tt.is((select count(*) from public.menu_weeks where week_start = '2099-01-12'), 0::bigint, 'rejected saves created no week');

-- an incomplete week can be saved as a draft but not released; "not served" resolves the ambiguity (FR-14)
select tt.is((public.save_menu_week('2099-01-12', jsonb_set(tt.slots('N'), '{0,dish_text}', '""')) ->> 'status'), 'draft', 'a draft with an empty slot can be saved');
select tt.ok(tt.err($$select public.release_menu_week(tt.wid('2099-01-12'), 'publish_now')$$) like 'PT400%slots.1/breakfast%', 'an empty slot blocks release and is named');
select tt.is((public.save_menu_week('2099-01-12', jsonb_set(jsonb_set(tt.slots('N'), '{0,dish_text}', '""'), '{0,not_served}', 'true')) ->> 'status'), 'draft', 'the empty slot marked not served is saved');
select tt.is((public.release_menu_week(tt.wid('2099-01-12'), 'schedule', '2099-06-01 18:00+05') ->> 'status'), 'scheduled', 'with the slot marked not served the week can be scheduled');
select tt.is((public.release_menu_week(tt.wid('2099-01-12'), 'cancel_schedule') ->> 'status'), 'draft', 'cancel_schedule turns it back into a draft');

-- publish now: the week becomes the live menu
select tt.is((public.release_menu_week(tt.wid('2099-01-05'), 'publish_now') ->> 'status'), 'published', 'publish_now makes the week published');
select tt.is((public.get_public_content() #>> '{menu,week_start}'), '2099-01-05', 'visitors see the published week');
select tt.is((public.get_public_content() #>> '{menu,slots,0,dish_text}'), 'L d1 breakfast', 'and its slots');
select tt.is((select count(*) from public.menu_week_status where status = 'published'), 1::bigint, 'one published week');

-- copy last week (FR-15)
select tt.is((public.copy_menu_week(tt.wid('2099-01-05'), '2099-01-19') ->> 'status'), 'draft', 'copy_menu_week creates a draft');
select tt.is((select count(*) from public.menu_slots where menu_week_id = tt.wid('2099-01-19')), 21::bigint, 'the copy has all 21 slots pre-filled');
select tt.is((select dish_text from public.menu_slots where menu_week_id = tt.wid('2099-01-19') and day_of_week = 3 and meal = 'lunch'), 'L d3 lunch', 'copied text matches the source');
select tt.throws($$select public.copy_menu_week(tt.wid('2099-01-05'), '2099-01-19')$$, 'PT400', 'cannot copy onto an existing week');
select tt.throws($$select public.copy_menu_week(tt.wid('2099-01-05'), '2099-01-27')$$, 'PT400', 'the copy target must be a Monday');
select tt.throws($$select public.copy_menu_week('00000000-0000-4000-8000-000000000000', '2099-02-02')$$, 'PT404', 'unknown source week is a 404');
select tt.is((public.get_public_content() #>> '{menu,week_start}'), '2099-01-05', 'copying leaves the live menu untouched');

-- schedule next week; the live menu stays untouched (FR-15)
select tt.is((public.save_menu_week('2099-01-19', tt.slots('S')) ->> 'status'), 'draft', 'edit the copy as a draft');
select tt.throws($$select public.release_menu_week(tt.wid('2099-01-19'), 'schedule', now() - interval '1 minute')$$, 'PT400', 'a go-live time in the past is rejected for schedule');
select tt.throws($$select public.release_menu_week(tt.wid('2099-01-19'), 'schedule', null)$$, 'PT400', 'schedule needs a go-live time');
select tt.throws($$select public.release_menu_week(tt.wid('2099-01-19'), 'bogus')$$, 'PT400', 'unknown mode rejected');
select tt.throws($$select public.release_menu_week('00000000-0000-4000-8000-000000000000', 'publish_now')$$, 'PT404', 'unknown week is a 404');
select tt.is((public.release_menu_week(tt.wid('2099-01-19'), 'schedule', '2099-01-18 18:00+05') ->> 'status'), 'scheduled', 'schedule sets status scheduled');
select tt.is((public.get_public_content() #>> '{menu,week_start}'), '2099-01-05', 'a scheduled week does not change the live menu');
select tt.is(tt.wst('2099-01-05'), 'published', 'the live week stays published');
select tt.is((public.draft_status() #>> '{scheduled_menu,week_start}'), '2099-01-19', 'draft_status reports the scheduled menu');
-- editing a scheduled week updates its snapshot in the same action (FR-15)
select tt.is((select live_payload #>> '{slots,0,dish_text}' from public.menu_weeks where id = tt.wid('2099-01-19')), 'S d1 breakfast', 'the snapshot holds the scheduled text');
select tt.is((public.save_menu_week('2099-01-19', jsonb_set(tt.slots('S'), '{0,dish_text}', '"S2 edited"')) ->> 'differs_from_released'), 'false', 'editing a scheduled week keeps working copy and snapshot together');
select tt.is((select live_payload #>> '{slots,0,dish_text}' from public.menu_weeks where id = tt.wid('2099-01-19')), 'S2 edited', 'the scheduled snapshot followed the edit');
select tt.is((public.get_public_content() #>> '{menu,slots,0,dish_text}'), 'L d1 breakfast', 'and the live menu is still untouched');
-- change the schedule time
select tt.is(((public.release_menu_week(tt.wid('2099-01-19'), 'schedule', '2099-01-17 20:00+05') ->> 'go_live_at')::timestamptz), timestamptz '2099-01-17 20:00+05', 'a scheduled week can be re-scheduled');
-- editing the LIVE week changes only the working copy until released again (FR-14)
select tt.is((public.save_menu_week('2099-01-05', jsonb_set(tt.slots('L'), '{1,dish_text}', '"L changed"')) ->> 'differs_from_released'), 'true', 'editing the live week marks it as differing from what is live');
select tt.is((public.get_public_content() #>> '{menu,slots,1,dish_text}'), 'L d1 lunch', 'visitors still see the old live text');
select tt.is((public.get_draft_content(tt.wid('2099-01-05')) #>> '{menu,slots,1,dish_text}'), 'L changed', 'preview shows the working text');
select tt.is((public.release_menu_week(tt.wid('2099-01-05'), 'publish_now') ->> 'differs_from_released'), 'false', 'releasing again brings the snapshot up to date');
select tt.is((public.get_public_content() #>> '{menu,slots,1,dish_text}'), 'L changed', 'visitors now see the edit');
-- rules about cancel / schedule on released weeks
select tt.throws($$select public.release_menu_week(tt.wid('2099-01-05'), 'cancel_schedule')$$, 'PT400', 'a live week cannot be "cancelled"');
select tt.throws($$select public.release_menu_week(tt.wid('2099-01-05'), 'schedule', '2099-07-01 00:00+05')$$, 'PT400', 'a released week cannot be re-scheduled (use publish_now)');
select tt.is((public.release_menu_week(tt.wid('2099-01-19'), 'cancel_schedule') ->> 'status'), 'draft', 'cancel_schedule on a scheduled week -> draft');
select tt.is((select live_payload is null and go_live_at is null from public.menu_weeks where id = tt.wid('2099-01-19')), true, 'cancelling clears the snapshot and the go-live time');
select tt.is((public.get_public_content() #>> '{menu,week_start}'), '2099-01-05', 'and the live menu was untouched throughout');
select tt.throws($$select public.release_menu_week(tt.wid('2099-01-19'), 'cancel_schedule')$$, 'PT400', 'a draft cannot be cancelled');
-- audit
select tt.as_postgres();
select tt.ok((select count(*) from public.audit_log where action = 'menu_saved') >= 5, 'menu saves are audited (one entry per save that changed something)');
select tt.ok((select count(*) from public.audit_log where action = 'menu_released') >= 6, 'releases, schedules and cancels are audited');
select tt.is((select count(*) from public.audit_log where action = 'menu_copied'), 1::bigint, 'copy is audited');
select tt.is((select jsonb_array_length(new_values -> 'changed_slots') from public.audit_log where action = 'menu_saved' and new_values ->> 'week_start' = '2099-01-05' order by id desc limit 1), 1, 'saving one edited slot logs exactly that one slot');
