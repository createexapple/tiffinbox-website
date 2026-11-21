#!/usr/bin/env bash
# Runs the Stage 3 database tests against a THROWAWAY local PostgreSQL database.
#
#   supabase/tests/run.sh            create db, shim, migrations, seeds smoke, tests, rollback cycle, drop db
#   KEEP_DB=1 supabase/tests/run.sh  same, but keep the database for inspection (drop it with CLEANUP_ONLY=1)
#   CLEANUP_ONLY=1 supabase/tests/run.sh
#
# Safety: it only ever creates/drops the single database named below (and only if that database carries our
# marker comment), connects to the maintenance database `postgres` only to run CREATE/DROP DATABASE, and
# never lists or touches any other database. It needs a local server and a role allowed to create databases
# and roles (PGHOST/PGUSER/PGPORT env vars are honoured). It refuses to run if PGHOST looks remote.
# Exit status: 0 = every assertion passed and no script error; non-zero otherwise.
set -u -o pipefail

DB="tiffinbox_stage3_test"
MARKER="tiffinbox stage3 throwaway test database - safe to drop"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

case "${PGHOST:-}" in ""|/*|localhost|127.0.0.1|::1) ;; *) echo "Refusing: PGHOST=$PGHOST is not local." >&2; exit 2;; esac

admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }
t()     { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

roles_before=""
for r in anon authenticated service_role; do
  if [ "$(admin -Atc "select 1 from pg_roles where rolname='$r'")" = "1" ]; then roles_before="$roles_before $r"; fi
done

drop_db() {
  exists="$(admin -Atc "select 1 from pg_database where datname='$DB'")"
  if [ "$exists" = "1" ]; then
    c="$(admin -Atc "select shobj_description(oid,'pg_database') from pg_database where datname='$DB'")"
    if [ "$c" != "$MARKER" ]; then echo "Refusing to drop $DB: marker comment missing." >&2; return 1; fi
    admin -c "drop database \"$DB\" with (force)"
  fi
}
# Roles are cluster-wide, so only roles that carry our marker comment (set below, only on roles WE created) are dropped.
mark_roles_we_created() {
  for r in anon authenticated service_role; do
    case " $roles_before " in *" $r "*) ;; *) admin -c "comment on role $r is '$MARKER'" >/dev/null;; esac
  done
}
drop_roles_we_created() {
  for r in anon authenticated service_role; do
    c="$(admin -Atc "select shobj_description(oid,'pg_authid') from pg_roles where rolname='$r'")"
    if [ "$c" = "$MARKER" ]; then admin -c "drop role if exists $r" >/dev/null || echo "note: could not drop role $r" >&2; fi
  done
}

if [ "${CLEANUP_ONLY:-}" = "1" ]; then drop_db; drop_roles_we_created; echo "cleanup done"; exit 0; fi

drop_db || exit 2
admin -c "create database \"$DB\"" || { echo "Could not create database (permission?). Stopping." >&2; exit 2; }
admin -c "comment on database \"$DB\" is '$MARKER'"

LOG="$(mktemp -t tbx_stage3.XXXXXX)"
fail=0
echo "== shim"; t -f "$HERE/local-shim.sql" || exit 2
mark_roles_we_created
t -f "$HERE/helpers.sql" || exit 2
echo "== migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "  apply $(basename "$f")"
  t -f "$f" || { echo "MIGRATION FAILED: $f" >&2; fail=1; break; }
done

run_test() {
  echo "== test $(basename "$1")"
  # Each test file is wrapped in a transaction that is rolled back.
  { echo "begin;"; echo "\\i $HERE/fixtures.sql"; cat "$1"; echo; echo "rollback;"; } > "$LOG.sql"
  psql -X -q -v ON_ERROR_STOP=1 -v ROOT="$ROOT" -d "$DB" -f "$LOG.sql" 2>&1 | tee -a "$LOG" | grep -E "PASS:|FAIL:|ERROR|FATAL" | sed -E 's/^psql:[^ ]+ NOTICE:  //; s/^NOTICE:  //'
  rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ]; then echo "SCRIPT ERROR in $1 (psql exit $rc)"; fail=1; fi
}

if [ "$fail" -eq 0 ]; then
  for f in "$HERE"/[0-9][0-9]_*.sql; do run_test "$f"; done
fi

if [ "$fail" -eq 0 ] && [ -x "$HERE/rollback_cycle.sh" ]; then
  echo "== rollback cycle"; "$HERE/rollback_cycle.sh" "$DB" 2>&1 | tee -a "$LOG" | grep -E "PASS:|FAIL:|ERROR" | sed -E 's/^NOTICE:  //'
  [ "${PIPESTATUS[0]}" -eq 0 ] || fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "== seed guard (synthetic seed must refuse a database that holds non-synthetic customers)"
  out="$({ echo "begin;"; echo "\\i $HERE/fixtures.sql"; echo "\\i $ROOT/supabase/seed/01_reference_content.sql";
          echo "insert into public.customers (type, name, phone_e164) values ('home', 'Real Looking Person', '03111234567');";
          echo "\\i $ROOT/supabase/seed/02_synthetic_staging.sql"; echo "rollback;"; } | psql -X -q -v ON_ERROR_STOP=1 -d "$DB" 2>&1)"
  if echo "$out" | grep -q "Refusing to seed synthetic data"; then echo "PASS: seed/02 refuses to run when a non-synthetic customer exists" | tee -a "$LOG"; else echo "FAIL: seed/02 guard did not fire" | tee -a "$LOG"; fi
fi

pass=$(grep -c "PASS:" "$LOG"); failed=$(grep -c "FAIL:" "$LOG")
echo "=============================="
echo "assertions passed: $pass"
echo "assertions failed: $failed"
[ "$failed" -ne 0 ] && fail=1
if [ "${KEEP_DB:-}" != "1" ]; then drop_db; drop_roles_we_created; echo "throwaway database dropped"; else echo "database kept: $DB (CLEANUP_ONLY=1 to drop)"; fi
rm -f "$LOG" "$LOG.sql"
[ "$fail" -eq 0 ] && echo "RESULT: OK" || echo "RESULT: FAILED"
exit "$fail"
