-- 06_audit.sql : audit rows are written for every change, with actor and before/after, are append-only, and are
-- redacted on anonymisation (FR-23, NFR-12, Q-34; architecture 6.2, 6.5).
select tt.as_postgres();
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''bbbbbbbb-0000-4000-8000-00000000000b'''
insert into public.plans (id, name, unit_price, weekly_price) values ('b0000000-0000-4000-8000-000000000001', 'Audit Plan', 100, 700);

-- ------------------------------ triggers: who changed what, before and after ------------------------------
select tt.act_as(:A::uuid);
insert into public.customers (id, type, name, phone_e164, address_text, notes)
  values ('11000000-0000-4000-8000-000000000001', 'student', 'Audit Sample', '03001234567', 'Hostel secret address', 'secret note');
select tt.as_postgres();
select tt.is((select count(*) from public.audit_log where table_name = 'customers' and action = 'insert'), 1::bigint, 'creating a customer writes one audit row');
select tt.is((select actor_label from public.audit_log where table_name = 'customers' and action = 'insert'), 'Admin A (test)', 'the audit row carries the admin''s display name');
select tt.is((select actor_user_id from public.audit_log where table_name = 'customers' and action = 'insert'), 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid, 'and the admin''s user id');
select tt.is((select record_id from public.audit_log where table_name = 'customers' and action = 'insert'), '11000000-0000-4000-8000-000000000001', 'and the record id');
select tt.is((select subject_customer_id from public.audit_log where table_name = 'customers' and action = 'insert'), '11000000-0000-4000-8000-000000000001'::uuid, 'and the customer it is about');
select tt.is((select new_values ->> 'phone_e164' from public.audit_log where table_name = 'customers' and action = 'insert'), '+923001234567', 'the new row is stored (normalised phone)');
select tt.is((select old_values from public.audit_log where table_name = 'customers' and action = 'insert'), null, 'an insert has no old values');

select tt.act_as(:B::uuid);
update public.customers set name = 'Audit Sample Renamed', notes = '' where id = '11000000-0000-4000-8000-000000000001';
select tt.as_postgres();
select tt.is((select actor_label from public.audit_log where table_name = 'customers' and action = 'update'), 'Admin B (test)', 'a different admin is recorded as the actor');
select tt.is((select old_values ->> 'name' from public.audit_log where table_name = 'customers' and action = 'update'), 'Audit Sample', 'update: old value kept');
select tt.is((select new_values ->> 'name' from public.audit_log where table_name = 'customers' and action = 'update'), 'Audit Sample Renamed', 'update: new value kept');
select tt.ok((select old_values ? 'phone_e164' and new_values ? 'phone_e164' from public.audit_log where table_name = 'customers' and action = 'update'), 'update: whole rows are stored for operations tables, so earlier values stay readable');

-- content tables store diffs only
select tt.as_user(:A::uuid);
update public.plans set weekly_price = 800 where id = 'b0000000-0000-4000-8000-000000000001';
select tt.as_postgres();
select tt.is((select old_values from public.audit_log where table_name = 'plans' and action = 'update'), '{"weekly_price": 700}'::jsonb, 'content update: only the changed column is logged (old)');
select tt.is((select new_values from public.audit_log where table_name = 'plans' and action = 'update'), '{"weekly_price": 800}'::jsonb, 'content update: only the changed column is logged (new)');
update public.plans set name = name where id = 'b0000000-0000-4000-8000-000000000001';
select tt.is((select count(*) from public.audit_log where table_name = 'plans' and action = 'update'), 1::bigint, 'a no-op update writes no audit row');

-- settings, pricing, ops, dishes, addons, faq, media, page images are all audited
select tt.as_user(:A::uuid);
update public.site_settings set tagline = 'new tagline';
update public.pricing_rules set breakfast_addon_price = 360;
update public.ops_settings set overdue_grace_days = 1;
insert into public.dishes (name, price) values ('Audit dish', 500);
insert into public.addons (name, price) values ('Audit addon', 20);
insert into public.faq_entries (question, answer) values ('Audit q?', 'Audit a.');
insert into public.media (id, storage_path, alt_text, width, height, bytes) values ('a0000000-0000-4000-8000-000000000001', 'audit/x.webp', 'alt', 10, 10, 10);
insert into public.page_images (slot_key, media_id) values ('og_share', 'a0000000-0000-4000-8000-000000000001');
select tt.as_postgres();
select tt.ok(exists (select 1 from public.audit_log where table_name = t), 'audit row exists for ' || t)
  from unnest(array['site_settings','pricing_rules','ops_settings','dishes','addons','faq_entries','media','page_images']) t;
select tt.is((select record_id from public.audit_log where table_name = 'page_images'), 'og_share', 'page_images audit uses slot_key as the record id');

-- subscriptions, periods and payments (FR-23 AC2: original values stay visible after edit and void)
select tt.act_as(:A::uuid);
select public.create_subscription('11000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'weekly', '2026-11-16', '2026-11-22', 4200, false, '', null, null, 'secret sub note');
insert into public.payments (id, customer_id, subscription_id, amount, method, paid_on, covers_from, covers_to, reference, note)
  select 'f3000000-0000-4000-8000-000000000001', customer_id, id, 4000, 'jazzcash', '2026-11-15', '2026-11-16', '2026-11-22', 'JC-AUD', 'secret pay note' from public.subscriptions limit 1;
update public.payments set amount = 4200 where id = 'f3000000-0000-4000-8000-000000000001';
select public.void_payment('f3000000-0000-4000-8000-000000000001', 'secret void reason');
select tt.as_postgres();
select tt.is((select count(*) from public.audit_log where table_name = 'subscriptions' and action = 'insert'), 1::bigint, 'creating a subscription is audited');
select tt.is((select count(*) from public.audit_log where table_name = 'subscription_periods' and action = 'insert'), 1::bigint, 'creating its period is audited');
select tt.is((select count(*) from public.audit_log where table_name = 'payments' and action = 'insert'), 1::bigint, 'recording a payment is audited');
select tt.is((select count(*) from public.audit_log where table_name = 'payments' and action = 'update'), 2::bigint, 'an edit and a void are each audited');
select tt.is((select old_values ->> 'amount' from public.audit_log where table_name = 'payments' and action = 'update' order by id limit 1), '4000', 'FR-23: the edited payment''s previous amount stays in history');
select tt.is((select new_values ->> 'amount' from public.audit_log where table_name = 'payments' and action = 'update' order by id limit 1), '4200', 'and the new amount');
select tt.is((select new_values ->> 'void_reason' from public.audit_log where table_name = 'payments' and action = 'update' order by id desc limit 1), 'secret void reason', 'the void and its reason are recorded');
select tt.is((select old_values ->> 'amount' from public.audit_log where table_name = 'payments' and action = 'update' order by id desc limit 1), '4200', 'the voided payment''s values are still in history');
select tt.is((select count(*) from public.audit_log where subject_customer_id = '11000000-0000-4000-8000-000000000001'), (select count(*) from public.audit_log where table_name in ('customers','subscriptions','subscription_periods','payments')), 'every operations audit row is linked to its customer');
select tt.is((select record_type from public.change_history where table_name = 'payments' limit 1), 'Payment', 'change_history maps table names to the screen''s record types');

-- system changes (no signed-in user, e.g. seeds) are labelled
select tt.is((select actor_label from public.audit_log where table_name = 'plans' and action = 'insert'), 'system', 'a change with no signed-in user is labelled "system"');

-- ------------------------------ append-only ------------------------------
select tt.throws($$update public.audit_log set actor_label = 'tampered'$$, '42501', 'audit_log cannot be updated, even by the owner role');
select tt.throws($$delete from public.audit_log$$, '42501', 'audit_log cannot be deleted, even by the owner role');
select tt.throws($$update public.audit_log set old_values = null where table_name = 'customers'$$, '42501', 'audit values cannot be rewritten');
select tt.as_user(:A::uuid);
select tt.throws($$update public.audit_log set actor_label = 'tampered'$$, '42501', 'an admin cannot update audit_log');
select tt.throws($$delete from public.audit_log$$, '42501', 'an admin cannot delete audit_log');
select tt.as_postgres();

-- ------------------------------ anonymise (Q-34, NFR-12) ------------------------------
select tt.ok((select count(*) from public.audit_log where (old_values::text || new_values::text) like '%Hostel secret address%') > 0, 'before anonymising, the customer''s address is present in history');
select tt.as_user(:A::uuid);
select tt.lives($$select public.anonymise_customer('11000000-0000-4000-8000-000000000001')$$, 'admin can anonymise a customer');
select tt.as_postgres();
select tt.is((select name from public.customers where id = '11000000-0000-4000-8000-000000000001'), 'Anonymised customer', 'name replaced');
select tt.is((select phone_e164 from public.customers where id = '11000000-0000-4000-8000-000000000001'), null, 'phone removed');
select tt.is((select address_text || notes from public.customers where id = '11000000-0000-4000-8000-000000000001'), '', 'address and notes removed');
select tt.ok((select archived_at is not null and anonymised_at is not null from public.customers where id = '11000000-0000-4000-8000-000000000001'), 'the customer is archived and marked anonymised');
select tt.is((select count(*) from public.payments where customer_id = '11000000-0000-4000-8000-000000000001'), 1::bigint, 'the payment row is kept for the books');
select tt.is((select amount from public.payments where customer_id = '11000000-0000-4000-8000-000000000001'), 4200, 'with its amount');
select tt.is((select note || void_reason from public.payments where customer_id = '11000000-0000-4000-8000-000000000001'), 'removed', 'free-text on the payment is removed (void reason replaced by a marker, keeping the void constraint)');
select tt.ok(exists (select 1 from public.payments where customer_id = '11000000-0000-4000-8000-000000000001' and voided_at is not null), 'the voided payment is still voided');
select tt.is((select notes from public.subscriptions where customer_id = '11000000-0000-4000-8000-000000000001'), '', 'subscription notes removed');
select tt.is((select count(*) from public.audit_log where (old_values::text || new_values::text) ~ 'Hostel secret|secret note|Audit Sample|03001234567|\+923001234567|secret sub note|secret pay note|secret void reason'), 0::bigint, 'REDACTION: no personal value of that customer remains anywhere in the audit log');
select tt.ok((select count(*) from public.audit_log where subject_customer_id = '11000000-0000-4000-8000-000000000001') >= 8, 'the history rows themselves remain (only personal values were removed)');
select tt.is((select old_values ->> 'amount' from public.audit_log where table_name = 'payments' and action = 'update' order by id limit 1), '4000', 'amounts in history are kept for the books');
select tt.is((select action from public.audit_log order by id desc limit 1), 'anonymise', 'anonymisation itself is audited');
select tt.throws($$update public.customers set name = 'revived' where id = '11000000-0000-4000-8000-000000000001'$$, '42501', 'an anonymised customer cannot be edited again');
select tt.throws($$update public.audit_log set actor_label = 'x'$$, '42501', 'the redaction switch is off again: audit_log is append-only once more');
select tt.is(current_setting('app.audit_redaction', true), 'off', 'the redaction flag is reset after use');
select tt.as_user(:A::uuid);
select tt.is((public.anonymise_customer('11000000-0000-4000-8000-000000000001') ->> 'customer_id'), '11000000-0000-4000-8000-000000000001', 'anonymising twice is harmless');
select tt.throws($$select public.anonymise_customer('00000000-0000-4000-8000-000000000000')$$, 'PT404', 'anonymising an unknown customer is a 404');
