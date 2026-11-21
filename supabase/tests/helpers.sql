-- Test helpers. Loaded by run.sh into the throwaway database only. Output protocol: one NOTICE line per
-- assertion, "PASS: <name>" or "FAIL: <name> ...". run.sh counts them. Every test file runs in a
-- transaction that is rolled back, so files cannot affect each other.
create schema tt;
grant usage on schema tt to public;

create function tt.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if coalesce(p_cond, false) then raise notice 'PASS: %', p_name;
  else raise notice 'FAIL: %', p_name; end if;
end $$;

create function tt.is(p_got anyelement, p_want anyelement, p_name text) returns void language plpgsql as $$
begin
  if p_got is not distinct from p_want then raise notice 'PASS: %', p_name;
  else raise notice 'FAIL: % (got %, wanted %)', p_name, p_got, p_want; end if;
end $$;

-- Runs p_sql, expects it to raise SQLSTATE p_state.
create function tt.throws(p_sql text, p_state text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then raise notice 'PASS: %', p_name;
    else raise notice 'FAIL: % (raised % %, wanted %)', p_name, sqlstate, sqlerrm, p_state; end if;
    return;
  end;
  raise notice 'FAIL: % (no error raised, wanted %)', p_name, p_state;
end $$;

-- Runs p_sql, expects it to raise ANY error.
create function tt.denied(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS: % [%]', p_name, sqlstate;
    return;
  end;
  raise notice 'FAIL: % (statement succeeded)', p_name;
end $$;

-- Runs p_sql, expects NO error.
create function tt.lives(p_sql text, p_name text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'FAIL: % (raised % %)', p_name, sqlstate, sqlerrm;
    return;
  end;
  raise notice 'PASS: %', p_name;
end $$;

-- Passes when the statement is refused (insufficient_privilege, incl. RLS violation) OR changes 0 rows.
create function tt.blocked(p_sql text, p_name text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when insufficient_privilege then
    raise notice 'PASS: % [refused]', p_name;
    return;
  end;
  if n = 0 then raise notice 'PASS: % [0 rows changed]', p_name;
  else raise notice 'FAIL: % (changed % rows)', p_name, n; end if;
end $$;

-- Runs p_sql and returns "SQLSTATE DETAIL" of the error it raises, or 'no error'.
create function tt.err(p_sql text) returns text language plpgsql as $$
declare d text;
begin
  begin
    execute p_sql;
    return 'no error';
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    return sqlstate || ' ' || coalesce(d, '');
  end;
end $$;

-- Rows affected by a DML statement (RLS filters rows silently on UPDATE/DELETE).
create function tt.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- Rows returned by a query (counts as the current role).
create function tt.count_rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $$;

-- Impersonation (tests call these as plain SQL):
--   select tt.as_anon();  select tt.as_user('<uuid>');  select tt.as_postgres();
create function tt.as_postgres() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;
create function tt.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;
create function tt.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
-- Sets the JWT identity WITHOUT changing the database role (lets a table owner write rows with explicit ids
-- while triggers still see auth.uid() = p_uid, so audit rows name that admin).
create function tt.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, false);
end $$;
grant execute on function tt.as_postgres(), tt.as_anon(), tt.as_user(uuid), tt.act_as(uuid) to public;

grant execute on all functions in schema tt to public;
