-- Rollback of 20261122000002_content_tables.sql (drops all site content and releases: destructive)
drop table if exists public.site_state;
drop table if exists public.content_releases;
drop table if exists public.menu_slots;
drop table if exists public.menu_weeks;
drop table if exists public.page_images;
drop table if exists public.faq_entries;
drop table if exists public.addons;
drop table if exists public.dishes;
drop table if exists public.plans;
drop table if exists public.media;
drop table if exists public.ops_settings;
drop table if exists public.pricing_rules;
drop table if exists public.site_settings;
drop function if exists app.plans_single_popular();
drop function if exists app.block_row_change();
drop function if exists app.media_guard_delete();
