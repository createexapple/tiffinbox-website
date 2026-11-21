-- 04_publish_rollback.sql : publish validation, atomic publish, immutable releases, rollback, preview,
-- "unpublished changes" (ADR-0003; architecture 8.1, 8.2; FR-10, FR-16, FR-22, NFR-08).
select tt.as_postgres();
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''

-- Fresh install: nothing published yet.
select tt.is((select public.get_public_content()), null, 'before the first publish, get_public_content returns null (the app falls back to its last-good copy)');

-- A brief-style draft: placeholders and an unpriced plan (what seed/01 produces)
update public.site_settings set whatsapp_number = '[WhatsApp number]', instagram_handle = 'x.y', order_hours = '[order hours]',
  delivery_area_text = 'Area', delivery_times = '{"breakfast":"08:00","lunch":"13:00","dinner":"20:00"}',
  skip_cutoffs = '{"breakfast":"22:00","lunch":"10:00","dinner":"17:00"}' where id = 1;
insert into public.plans (id, name, price_unit, unit_price, weekly_price, is_active, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'Priced', 'per_meal', 300, 4200, true, 1),
  ('b0000000-0000-4000-8000-000000000002', 'Unresolved Q-08', 'per_meal', null, 8050, true, 2);

select tt.as_user(:A::uuid);
select tt.is((public.draft_status() ->> 'has_unpublished_changes')::boolean, true, 'nothing published yet: draft_status reports unpublished changes');
select tt.ok(tt.err('select public.publish_content()') like 'PT400%', 'publish is blocked (PT400) while placeholders and an unpriced plan remain');
select tt.ok(tt.err('select public.publish_content()') like '%settings.whatsapp_number%', 'the error names the WhatsApp number field');
select tt.ok(tt.err('select public.publish_content()') like '%settings.order_hours%', 'the error names the placeholder order hours');
select tt.ok(tt.err('select public.publish_content()') like '%plans.b0000000-0000-4000-8000-000000000002%', 'the error names the plan without a price (Q-08)');
select tt.is(jsonb_array_length(public.draft_status() -> 'publish_errors'), 3, 'draft_status lists the three blocking problems');
select tt.as_postgres();
select tt.is((select count(*) from public.content_releases), 0::bigint, 'a failed publish wrote no release');
select tt.is((select current_release_id from public.site_state), null::bigint, 'a failed publish left site_state alone');
select tt.is((select count(*) from public.audit_log where action = 'publish'), 0::bigint, 'a failed publish wrote no audit entry');

-- fix them one at a time
update public.site_settings set whatsapp_number = '+92 300 0000000' where id = 1;
select tt.as_user(:A::uuid);
select tt.ok(tt.err('select public.publish_content()') like '%settings.whatsapp_number%', 'WhatsApp number with + and spaces is rejected (digits only, FR-20)');
select tt.as_postgres();
update public.site_settings set whatsapp_number = '920000000001', order_hours = '9 am to 9 pm' where id = 1;
update public.plans set unit_price = 575 where id = 'b0000000-0000-4000-8000-000000000002';
select tt.throws($$update public.site_settings set delivery_times = '{"breakfast":"8am","lunch":"13:00","dinner":"20:00"}' where id = 1$$, '23514', 'the table itself rejects a delivery time that is not HH:mm');
update public.site_settings set delivery_times = '{"breakfast":"","lunch":"13:00","dinner":"20:00"}' where id = 1;
select tt.as_user(:A::uuid);
select tt.ok(tt.err('select public.publish_content()') like '%settings.delivery_times.breakfast%', 'a delivery time left empty blocks publish');
select tt.as_postgres();
update public.site_settings set delivery_times = '{"breakfast":"08:00","lunch":"13:00","dinner":"20:00"}' where id = 1;
insert into public.plans (name, is_active, sort_order) values ('Inactive unpriced', false, 9);   -- inactive plans never block (FR-16)

select tt.as_user(:A::uuid);
select tt.ok(tt.err($$select public.publish_content(repeat('x', 201))$$) like 'PT400%', 'a note longer than 200 characters is rejected');
create temp table r1 on commit drop as select public.publish_content('first release') as r;
select tt.is((select (r ->> 'version')::int from r1), 1, 'first publish creates version 1');
select tt.as_postgres();
select tt.is((select current_release_id from public.site_state), (select id from public.content_releases where version = 1), 'site_state points at version 1');
select tt.is((select published_by from public.content_releases where version = 1), 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'the publisher is recorded');
select tt.is((select note from public.content_releases where version = 1), 'first release', 'the note is recorded');
select tt.is((select count(*) from public.audit_log where action = 'publish' and record_id = '1'), 1::bigint, 'publish wrote one audit entry');
select tt.is((public.get_public_content() #>> '{release,version}')::int, 1, 'visitors now see version 1');
select tt.is((public.get_public_content() #>> '{plans,1,unit_price}')::int, 575, 'the published plan price is the draft price at publish time');
select tt.is(jsonb_array_length(public.get_public_content() -> 'plans'), 2, 'only active plans are published');
select tt.is(public.get_public_content() #>> '{settings,whatsapp_number}', '920000000001', 'settings are published');

-- derived monthly price (Q-10 proposal): 4 x weekly less saving %, override wins
select tt.is((public.get_public_content() #>> '{plans,0,monthly_price}')::int, 15960, 'monthly price derived as 4 x 4200 x 0.95 = 15960 when no override is stored');
update public.plans set monthly_price = 15000 where name = 'Priced';
select tt.is((app.build_content_document() #>> '{plans,0,monthly_price}')::int, 15000, 'a stored monthly price overrides the derived one');
update public.plans set monthly_price = null where name = 'Priced';
update public.ops_settings set monthly_period_rule = 'calendar_month';
select tt.is((app.build_content_document() #>> '{plans,0,monthly_price}')::int, 17100, 'calendar_month rule: 4200 x 30/7 x 0.95 = 17100');
update public.ops_settings set monthly_period_rule = '4_weeks';

-- unpublished-changes indicator by checksum, no dirty flags
select tt.as_user(:A::uuid);
select tt.is((public.draft_status() ->> 'has_unpublished_changes')::boolean, false, 'right after publishing there are no unpublished changes');
select tt.is((public.draft_status() ->> 'changed_areas'), '[]', 'no changed areas right after publishing');
select tt.as_postgres();
update public.plans set unit_price = 600, weekly_price = 8400 where name = 'Unresolved Q-08';
update public.faq_entries set answer = 'changed' where false;
select tt.as_user(:A::uuid);
select tt.is((public.draft_status() ->> 'has_unpublished_changes')::boolean, true, 'editing a plan makes the indicator turn on');
select tt.is((public.draft_status() -> 'changed_areas'), '["Plans"]'::jsonb, 'changed areas name only what changed');
select tt.is((public.get_draft_content() #>> '{plans,1,unit_price}')::int, 600, 'preview (get_draft_content) shows the draft price');
select tt.is((public.get_draft_content() #>> '{release,draft}')::boolean, true, 'preview is marked as draft');
select tt.is((public.get_public_content() #>> '{plans,1,unit_price}')::int, 575, 'visitors still see the previous price until publish');
select tt.is((public.draft_status() ->> 'current_release_version')::int, 1, 'draft_status reports the live version');

-- second publish
create temp table r2 on commit drop as select public.publish_content('price change') as r;
select tt.is((select (r ->> 'version')::int from r2), 2, 'second publish creates version 2');
select tt.is((public.get_public_content() #>> '{plans,1,unit_price}')::int, 600, 'visitors see the new price after publish');
select tt.is((public.draft_status() ->> 'has_unpublished_changes')::boolean, false, 'no pending changes after the second publish');
select tt.as_postgres();
select tt.ok((select checksum = app.content_checksum(payload) from public.content_releases where version = 2), 'the stored checksum matches the payload');
select tt.as_user(:A::uuid);

-- rollback (NFR-08)
select tt.is((public.rollback_release(1) ->> 'version')::int, 1, 'rollback to version 1 succeeds');
select tt.is((public.get_public_content() #>> '{release,version}')::int, 1, 'visitors are back on version 1');
select tt.is((public.get_public_content() #>> '{plans,1,unit_price}')::int, 575, 'the old price is live again');
select tt.is((public.get_draft_content() #>> '{plans,1,unit_price}')::int, 600, 'rollback does not touch the draft tables');
select tt.is((public.draft_status() ->> 'has_unpublished_changes')::boolean, true, 'after rollback the draft differs from the live release');
select tt.is((public.draft_status() ->> 'current_release_version')::int, 1, 'draft_status reports version 1 as live');
select tt.throws('select public.rollback_release(99)', 'PT404', 'rollback to an unknown version is a 404');
select tt.is((public.rollback_release(2) ->> 'version')::int, 2, 'rolling forward to version 2 works the same way');
select tt.as_postgres();
select tt.is((select count(*) from public.content_releases), 2::bigint, 'rollback creates no new release');
select tt.is((select count(*) from public.audit_log where action = 'rollback'), 2::bigint, 'each rollback is audited');
select tt.is((select (old_values ->> 'version') || '>' || (new_values ->> 'version') from public.audit_log where action = 'rollback' order by id limit 1), '2>1', 'the rollback audit entry records from -> to');

-- releases are immutable
select tt.throws($$update public.content_releases set payload = '{}' where version = 1$$, '42501', 'a release cannot be edited, even by the owner role');
select tt.throws($$delete from public.content_releases where version = 1$$, '42501', 'a release cannot be deleted');

-- ATOMICITY: if anything fails mid-publish, nothing changes (FR-22)
select tt.as_postgres();
create function tt.boom() returns trigger language plpgsql as $$ begin raise exception 'injected failure' using errcode = 'XX999'; end $$;
create trigger tt_boom before update on public.site_state for each row execute function tt.boom();
update public.plans set unit_price = 700, weekly_price = 9800 where name = 'Unresolved Q-08';
select tt.as_user(:A::uuid);
select tt.throws('select public.publish_content(''should fail'')', 'XX999', 'a failure after the release row is written aborts the publish');
select tt.as_postgres();
select tt.is((select count(*) from public.content_releases), 2::bigint, 'ATOMIC: the release row written before the failure was rolled back');
select tt.is((select version from public.content_releases r join public.site_state s on s.current_release_id = r.id), 2, 'ATOMIC: the live site is still on the previous release');
select tt.is((select count(*) from public.audit_log where action = 'publish' and new_values ->> 'note' = 'should fail'), 0::bigint, 'ATOMIC: no audit entry for the failed publish');
select tt.is((select max(id) from public.content_releases) , (select max(id) from public.content_releases), 'sanity');
drop trigger tt_boom on public.site_state;
-- failing audit write also aborts a rollback
create function tt.boom_audit() returns trigger language plpgsql as $$ begin if new.action = 'rollback' then raise exception 'injected audit failure' using errcode = 'XX998'; end if; return new; end $$;
create trigger tt_boom_audit before insert on public.audit_log for each row execute function tt.boom_audit();
select tt.as_user(:A::uuid);
select tt.throws('select public.rollback_release(1)', 'XX998', 'a failure while auditing aborts the rollback');
select tt.as_postgres();
select tt.is((select version from public.content_releases r join public.site_state s on s.current_release_id = r.id), 2, 'ATOMIC: the rollback did not take effect');
drop trigger tt_boom_audit on public.audit_log;

-- hidden / inactive content never reaches the public document
update public.plans set unit_price = 600, weekly_price = 8400 where name = 'Unresolved Q-08';
insert into public.dishes (name, price, is_hidden, sort_order) values ('Hidden dish', 500, true, 1), ('Shown dish', 450, false, 2);
insert into public.addons (name, price, is_hidden) values ('Hidden addon', 10, true);
insert into public.faq_entries (question, answer, is_hidden) values ('Hidden q', 'hidden a', true), ('Shown q', 'shown a', false);
insert into public.media (id, storage_path, alt_text, width, height, bytes) values ('a0000000-0000-4000-8000-000000000001', 'test/hero.webp', 'Hero alt', 1600, 1200, 1000);
insert into public.page_images (slot_key, media_id) values ('home_hero', 'a0000000-0000-4000-8000-000000000001');
update public.dishes set media_id = 'a0000000-0000-4000-8000-000000000001' where name = 'Shown dish';
select tt.as_user(:A::uuid);
select tt.is((public.publish_content('v3') ->> 'version')::int, 3, 'publish v3 with hidden items present');
select tt.as_postgres();
select tt.is(jsonb_array_length(public.get_public_content() -> 'dishes'), 1, 'hidden dishes are not published');
select tt.is(jsonb_array_length(public.get_public_content() -> 'addons'), 0, 'hidden add-ons are not published');
select tt.is(jsonb_array_length(public.get_public_content() -> 'faq'), 1, 'hidden FAQ entries are not published');
select tt.is(public.get_public_content() #>> '{dishes,0,image,alt}', 'Hero alt', 'a dish carries its photo with alt text');
select tt.is(public.get_public_content() #>> '{page_images,home_hero,path}', 'test/hero.webp', 'page images are published by slot');
select tt.throws($$delete from public.media where id = 'a0000000-0000-4000-8000-000000000001'$$, '23503', 'an image used by a draft dish cannot be deleted (FK restrict)');
update public.dishes set media_id = null;
delete from public.page_images;
select tt.throws($$delete from public.media where id = 'a0000000-0000-4000-8000-000000000001'$$, '23503', 'an image that is part of the live release cannot be deleted');
select tt.throws($$insert into public.media (storage_path, alt_text, width, height, bytes) values ('p', '   ', 1, 1, 1)$$, '23514', 'alt text is required for every image (FR-21)');
