-- 20261122000001_foundation.sql
-- Schemas, privilege defaults, admin identity and shared helpers.
-- Architecture sections 6.3 (conventions), 7 (authorisation). ADR-0002.
--
-- Conventions
--   public : tables, views and the RPC functions that PostgREST exposes.
--   app    : internal helper functions. NOT exposed through the API; only `authenticated` has USAGE.
--   Money is whole PKR (integer). Business dates are `date`, instants are `timestamptz`.
--   "Today" is always the Asia/Karachi calendar date (app.karachi_today).

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

-- Supabase grants every new table/sequence/function in `public` to anon, authenticated and
-- service_role by default. Remove the anon defaults so a forgotten GRANT can never open data to the
-- public role (architecture sec. 7: anon has no table grants and executes only get_public_content()).
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema app    revoke all on functions from anon;
alter default privileges in schema app    revoke all on functions from public;
alter default privileges in schema public revoke all on functions from public;

-- ---------------------------------------------------------------------------------------------
-- Who is an admin (architecture 6.2 "Access and audit"). Created before is_admin() because the
-- function body is validated at creation time.
-- ---------------------------------------------------------------------------------------------
create table public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role         text not null default 'owner' check (role in ('owner', 'staff')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
comment on table public.admin_users is
  'Who is an admin. A Supabase Auth account without an active row here can do nothing (arch 6.2). Rows are created by the project owner, not by the app (v1).';

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------
-- The business "today" (architecture 6.3, 9): the Karachi calendar date of an instant.
create function app.karachi_today(p_ts timestamptz default now())
returns date language sql immutable parallel safe
  set search_path = ''
as $$ select (p_ts at time zone 'Asia/Karachi')::date $$;

-- One authorisation check used by every policy and every admin function (Q-02: roles later = more
-- policies, no schema change).
create function app.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.is_active
  )
$$;

create function app.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = (select auth.uid()) and a.is_active and a.role = 'owner'
  )
$$;

-- Display name of the current actor for the audit log ('system' when there is no signed-in user).
create function app.actor_label(p_uid uuid default null)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select a.display_name from public.admin_users a where a.user_id = coalesce(p_uid, (select auth.uid()))),
    case when coalesce(p_uid, (select auth.uid())) is null then 'system' else 'unknown user' end
  )
$$;

-- True for empty text or a bracketed placeholder such as "[WhatsApp number]" (FR-10: publish is blocked).
create function app.is_blank_or_placeholder(p_text text)
returns boolean language sql immutable parallel safe
  set search_path = ''
as $$ select p_text is null or btrim(p_text) = '' or btrim(p_text) ~ '^\[.*\]$' $$;

create function app.valid_hhmm(p_text text)
returns boolean language sql immutable parallel safe
  set search_path = ''
as $$ select coalesce(p_text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false) $$;

-- Pakistani mobile number to +923XXXXXXXXX (architecture 6.2 customers: "normalised to +92 form").
-- Accepts 03XXXXXXXXX, 3XXXXXXXXX, 923XXXXXXXXX, +923XXXXXXXXX, 00923XXXXXXXXX (spaces and dashes ignored).
-- Returns NULL when the input is not a valid number.
create function app.normalise_pk_phone(p_text text)
returns text language plpgsql immutable parallel safe
  set search_path = ''
as $$
declare d text;
begin
  if p_text is null then return null; end if;
  d := regexp_replace(p_text, '[^0-9]', '', 'g');
  if d like '0092%' then d := substr(d, 5);
  elsif d like '92%' and length(d) = 12 then d := substr(d, 3);
  elsif d like '0%' and length(d) = 11 then d := substr(d, 2);
  end if;
  if d ~ '^3[0-9]{9}$' then return '+92' || d; end if;
  return null;
end $$;

create function app.set_updated_at()
returns trigger language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

grant execute on function app.karachi_today(timestamptz) to authenticated;
grant execute on function app.is_admin()                 to authenticated;
grant execute on function app.is_owner()                 to authenticated;
grant execute on function app.actor_label(uuid)          to authenticated;
grant execute on function app.is_blank_or_placeholder(text) to authenticated;
grant execute on function app.valid_hhmm(text)           to authenticated;
grant execute on function app.normalise_pk_phone(text)   to authenticated;
