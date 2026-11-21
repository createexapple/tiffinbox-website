-- Rollback of 20261122000007_publishing.sql
-- WARNING: after this, visitors have no published-content function. Only run as part of a full teardown.
drop function if exists public.draft_status();
drop function if exists public.get_draft_content(uuid);
drop function if exists public.get_public_content();
drop function if exists app.public_content_at(timestamptz);
drop function if exists app.menu_json(uuid, boolean, timestamptz);
drop function if exists public.rollback_release(integer);
drop function if exists public.publish_content(text);
drop function if exists app.do_publish(text, uuid);
drop function if exists app.publish_errors();
drop function if exists app.changed_areas(jsonb, jsonb);
drop function if exists app.content_checksum(jsonb);
drop function if exists app.build_content_document();
drop function if exists app.derived_monthly_price(integer, numeric, text);
