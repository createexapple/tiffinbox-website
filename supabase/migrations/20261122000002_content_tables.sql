-- 20261122000002_content_tables.sql
-- Website content (draft working copy), menu weeks, media metadata, publishing tables.
-- Architecture 6.1, 6.2 (Content, Publishing); FR-14..FR-22; ADR-0003.
-- Visitors never read these tables: they read the published release through get_public_content().

-- ---------------------------------------------------------------------------------------------
-- Single-row settings tables
-- ---------------------------------------------------------------------------------------------
create table public.site_settings (
  id                    integer primary key default 1 check (id = 1),
  business_name         text  not null default 'Tiffin Box'
                              check (char_length(business_name) <= 80 and business_name !~ '[<>]'),
  tagline               text  not null default ''
                              check (char_length(tagline) <= 160 and tagline !~ '[<>]'),
  whatsapp_number       text  not null default ''
                              check (char_length(whatsapp_number) <= 40 and whatsapp_number !~ '[<>]'),
  instagram_handle      text  not null default ''
                              check (char_length(instagram_handle) <= 60 and instagram_handle !~ '[<>]'),
  order_hours           text  not null default ''
                              check (char_length(order_hours) <= 200 and order_hours !~ '[<>]'),
  last_order_time       text  not null default ''
                              check (last_order_time = '' or last_order_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  area_served           text  not null default ''
                              check (char_length(area_served) <= 120 and area_served !~ '[<>]'),
  delivery_area_text    text  not null default ''
                              check (char_length(delivery_area_text) <= 500 and delivery_area_text !~ '[<>]'),
  delivery_boundary_text text not null default ''
                              check (char_length(delivery_boundary_text) <= 300 and delivery_boundary_text !~ '[<>]'),
  legal_name_and_address text not null default ''
                              check (char_length(legal_name_and_address) <= 300 and legal_name_and_address !~ '[<>]'),
  -- {"breakfast":"08:00","lunch":"13:00","dinner":"20:00"}; "" = not set yet
  delivery_times        jsonb not null default '{"breakfast":"","lunch":"","dinner":""}'::jsonb,
  -- last time to ask for a skip per meal, and whether that is the night before or the same day
  skip_cutoffs          jsonb not null default '{"breakfast":"","lunch":"","dinner":""}'::jsonb,
  skip_cutoff_days      jsonb not null default '{"breakfast":"night_before","lunch":"same_day","dinner":"same_day"}'::jsonb,
  skips_per_week        integer not null default 3 check (skips_per_week between 0 and 21),
  payment_methods       jsonb not null default '["JazzCash","Easypaisa","bank transfer"]'::jsonb
                              check (jsonb_typeof(payment_methods) = 'array'),
  updated_at            timestamptz not null default now(),
  constraint site_settings_delivery_times check (
        jsonb_typeof(delivery_times) = 'object'
    and (delivery_times ->> 'breakfast') ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'
    and (delivery_times ->> 'lunch')     ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'
    and (delivery_times ->> 'dinner')    ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'),
  constraint site_settings_skip_cutoffs check (
        jsonb_typeof(skip_cutoffs) = 'object'
    and (skip_cutoffs ->> 'breakfast') ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'
    and (skip_cutoffs ->> 'lunch')     ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'
    and (skip_cutoffs ->> 'dinner')    ~ '^(|([01][0-9]|2[0-3]):[0-5][0-9])$'),
  constraint site_settings_skip_cutoff_days check (
        jsonb_typeof(skip_cutoff_days) = 'object'
    and (skip_cutoff_days ->> 'breakfast') in ('night_before', 'same_day')
    and (skip_cutoff_days ->> 'lunch')     in ('night_before', 'same_day')
    and (skip_cutoff_days ->> 'dinner')    in ('night_before', 'same_day'))
);
comment on table public.site_settings is
  'FR-20, one row. Draft: visitors see it only after publish. Empty text or a [bracketed placeholder] blocks publish (FR-10).';

create table public.pricing_rules (
  id                     integer primary key default 1 check (id = 1),
  monthly_saving_percent numeric(5, 2) not null default 5 check (monthly_saving_percent between 0 and 100),
  breakfast_addon_price  integer not null default 350 check (breakfast_addon_price >= 0),
  team_deal_text         text not null default ''
                         check (char_length(team_deal_text) <= 300 and team_deal_text !~ '[<>]'),
  team_min_people        integer not null default 10 check (team_min_people >= 1),
  updated_at             timestamptz not null default now()
);
comment on table public.pricing_rules is 'FR-16, one row. Draft until published.';

-- Operations settings: saved immediately, never published (architecture 6.2).
create table public.ops_settings (
  id                   integer primary key default 1 check (id = 1),
  renewal_window_days  integer not null default 7  check (renewal_window_days between 0 and 365),   -- Q-33
  overdue_grace_days   integer not null default 0  check (overdue_grace_days between 0 and 365),     -- Q-32
  monthly_period_rule  text    not null default '4_weeks' check (monthly_period_rule in ('4_weeks', 'calendar_month')), -- Q-10
  menu_go_live_time    text    not null default '18:00' check (menu_go_live_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), -- Q-24 default
  updated_at           timestamptz not null default now()
);
comment on table public.ops_settings is
  'FR-27/FR-29 settings, one row. Takes effect immediately. monthly_period_rule only pre-fills proposals (Q-10).';

-- ---------------------------------------------------------------------------------------------
-- Media (FR-21). Rows describe objects in the public `media` storage bucket (see migration 10).
-- ---------------------------------------------------------------------------------------------
create table public.media (
  id           uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (char_length(storage_path) between 1 and 300),
  file_name    text not null default '' check (char_length(file_name) <= 200),
  alt_text     text not null check (char_length(btrim(alt_text)) between 1 and 300 and alt_text !~ '[<>]'),
  width        integer not null check (width > 0),
  height       integer not null check (height > 0),
  bytes        integer not null check (bytes > 0),
  checksum     text not null default '',
  uploaded_by  uuid,
  created_at   timestamptz not null default now()
);
comment on table public.media is 'FR-21. Alt text is required. "Where used" = lookups on dishes, menu_slots and page_images.';

-- ---------------------------------------------------------------------------------------------
-- Plans, dishes, add-ons, FAQ
-- ---------------------------------------------------------------------------------------------
create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 1 and 80 and name !~ '[<>]'),
  audience        text not null default '' check (char_length(audience) <= 160 and audience !~ '[<>]'),
  meals_included  text not null default '' check (char_length(meals_included) <= 300 and meals_included !~ '[<>]'),
  price_unit      text not null default 'per_meal' check (price_unit in ('per_meal', 'per_day')),
  -- NULL = not set / unresolved (Q-08). An ACTIVE plan with a NULL price blocks publish.
  unit_price      integer check (unit_price is null or unit_price > 0),
  weekly_price    integer check (weekly_price is null or weekly_price > 0),
  monthly_price   integer check (monthly_price is null or monthly_price > 0),  -- optional override (Q-10)
  is_most_popular boolean not null default false,
  is_active       boolean not null default true,
  sort_order      integer not null default 0,
  price_note      text not null default '' check (char_length(price_note) <= 300 and price_note !~ '[<>]'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index plans_sort_idx on public.plans (sort_order, id);

-- At most one most-popular plan: setting it on one plan clears it on the others (frontend savePlans).
create function app.plans_single_popular()
returns trigger language plpgsql
  set search_path = ''
as $$
begin
  if new.is_most_popular and pg_trigger_depth() = 1 then
    update public.plans set is_most_popular = false where id <> new.id and is_most_popular;
  end if;
  return new;
end $$;
create trigger plans_single_popular after insert or update of is_most_popular on public.plans
  for each row when (new.is_most_popular) execute function app.plans_single_popular();

create table public.dishes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80 and name !~ '[<>]'),
  comes_with  text not null default '' check (char_length(comes_with) <= 120 and comes_with !~ '[<>]'),
  price       integer not null check (price > 0),
  media_id    uuid references public.media (id) on delete restrict,
  sort_order  integer not null default 0,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index dishes_sort_idx  on public.dishes (sort_order, id);
create index dishes_media_idx on public.dishes (media_id) where media_id is not null;

create table public.addons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80 and name !~ '[<>]'),
  price       integer not null check (price > 0),
  sort_order  integer not null default 0,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index addons_sort_idx on public.addons (sort_order, id);

create table public.faq_entries (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (char_length(btrim(question)) between 1 and 200 and question !~ '[<>]'),
  answer      text not null check (char_length(btrim(answer)) between 1 and 1000 and answer !~ '[<>]'),
  sort_order  integer not null default 0,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index faq_sort_idx on public.faq_entries (sort_order, id);

create table public.page_images (
  slot_key   text primary key check (slot_key in ('home_hero', 'og_share')),
  media_id   uuid not null references public.media (id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index page_images_media_idx on public.page_images (media_id);

-- ---------------------------------------------------------------------------------------------
-- Menu weeks (FR-14, FR-15, FR-06; architecture 8.3). Status is DERIVED, never stored.
-- Written only by the menu functions (migration 8), never directly by clients.
-- ---------------------------------------------------------------------------------------------
create table public.menu_weeks (
  id                   uuid primary key default gen_random_uuid(),
  week_start           date not null unique check (extract(isodow from week_start) = 1),  -- a Monday
  go_live_at           timestamptz,           -- NULL = draft
  live_payload         jsonb,                 -- the 21 slots as released or scheduled
  live_set_at          timestamptz,
  live_set_by          uuid,
  go_live_notified_at  timestamptz,           -- set by the cron notifier (architecture 8.4)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint menu_weeks_release_consistent check ((go_live_at is null) = (live_payload is null))
);
create index menu_weeks_go_live_idx on public.menu_weeks (go_live_at desc) where go_live_at is not null;

create table public.menu_slots (
  id            uuid primary key default gen_random_uuid(),
  menu_week_id  uuid not null references public.menu_weeks (id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 1 and 7),   -- 1 = Monday (openapi)
  meal          text not null check (meal in ('breakfast', 'lunch', 'dinner')),
  dish_text     text not null default '' check (char_length(dish_text) <= 200 and dish_text !~ '[<>]'),
  not_served    boolean not null default false,
  media_id      uuid references public.media (id) on delete restrict,
  unique (menu_week_id, day_of_week, meal)
);
create index menu_slots_media_idx on public.menu_slots (media_id) where media_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Publishing (ADR-0003). Releases are immutable; site_state points at the current one.
-- ---------------------------------------------------------------------------------------------
create table public.content_releases (
  id            bigint generated always as identity primary key,
  version       integer not null unique check (version > 0),
  payload       jsonb not null,
  checksum      text not null,
  published_at  timestamptz not null default now(),
  published_by  uuid,
  note          text not null default '' check (char_length(note) <= 200)
);

create table public.site_state (
  id                  integer primary key default 1 check (id = 1),
  current_release_id  bigint references public.content_releases (id) on delete restrict
);

create function app.block_row_change()
returns trigger language plpgsql
  set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '42501';
end $$;
create trigger content_releases_immutable before update or delete on public.content_releases
  for each row execute function app.block_row_change();

-- Deleting an image that is part of a live or scheduled release would leave a broken picture
-- (rollback would resurrect it). FR-21: the app warns; the database enforces.
create function app.media_guard_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
        select 1 from public.site_state s
        join public.content_releases r on r.id = s.current_release_id
        where r.payload::text like '%' || old.storage_path || '%')
     or exists (
        select 1 from public.menu_weeks w
        where w.live_payload is not null and w.live_payload::text like '%' || old.storage_path || '%'
          and (w.go_live_at > now() or w.id = (select id from public.menu_weeks
                                               where go_live_at <= now() order by go_live_at desc limit 1)))
  then
    raise exception 'image is part of the live or scheduled content and cannot be deleted' using errcode = '23503';
  end if;
  return old;
end $$;
create trigger media_guard_delete before delete on public.media
  for each row execute function app.media_guard_delete();

-- ---------------------------------------------------------------------------------------------
-- Singleton rows and updated_at triggers
-- ---------------------------------------------------------------------------------------------
insert into public.site_settings (id) values (1);
insert into public.pricing_rules (id) values (1);
insert into public.ops_settings (id) values (1);
insert into public.site_state (id) values (1);

create trigger site_settings_updated before update on public.site_settings for each row execute function app.set_updated_at();
create trigger pricing_rules_updated before update on public.pricing_rules for each row execute function app.set_updated_at();
create trigger ops_settings_updated  before update on public.ops_settings  for each row execute function app.set_updated_at();
create trigger plans_updated         before update on public.plans         for each row execute function app.set_updated_at();
create trigger dishes_updated        before update on public.dishes        for each row execute function app.set_updated_at();
create trigger addons_updated        before update on public.addons        for each row execute function app.set_updated_at();
create trigger faq_updated           before update on public.faq_entries   for each row execute function app.set_updated_at();
create trigger page_images_updated   before update on public.page_images   for each row execute function app.set_updated_at();
create trigger menu_weeks_updated    before update on public.menu_weeks     for each row execute function app.set_updated_at();
