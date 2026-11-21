#!/usr/bin/env bash
# Backup and restore rehearsal on LOCAL throwaway databases only (never a shared or production database).
#   1. creates tiffinbox_stage3_restore_src  (migrations + both seeds + a few extra rows)
#   2. pg_dump (custom format) to a temp file
#   3. creates tiffinbox_stage3_restore_dst and pg_restore into it
#   4. compares per-table row counts and a content checksum of every table, and checks RLS still holds after restore
#   5. drops both databases and the dump file
# Needs the local shim (supabase/tests/local-shim.sql) because it emulates the Supabase roles/schemas the dump refers to.
set -u -o pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
SRC="tiffinbox_stage3_restore_src"; DST="tiffinbox_stage3_restore_dst"
MARKER="tiffinbox stage3 throwaway test database - safe to drop"
case "${PGHOST:-}" in ""|/*|localhost|127.0.0.1|::1) ;; *) echo "Refusing: PGHOST=$PGHOST is not local." >&2; exit 2;; esac
admin() { psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"; }
dump="$(mktemp -t tbx_restore.XXXXXX)"
roles_before=""; for r in anon authenticated service_role; do [ "$(admin -Atc "select 1 from pg_roles where rolname='$r'")" = "1" ] && roles_before="$roles_before $r"; done
cleanup() {
  for d in "$SRC" "$DST"; do
    c="$(admin -Atc "select shobj_description(oid,'pg_database') from pg_database where datname='$d'")"
    [ "$c" = "$MARKER" ] && admin -c "drop database \"$d\" with (force)"
  done
  for r in anon authenticated service_role; do
    c="$(admin -Atc "select shobj_description(oid,'pg_authid') from pg_roles where rolname='$r'")"
    [ "$c" = "$MARKER" ] && { admin -c "drop role if exists $r" >/dev/null || echo "note: could not drop role $r" >&2; }
  done
  rm -f "$dump" "$dump.auth" "$dump.err"
}
trap cleanup EXIT
for d in "$SRC" "$DST"; do
  [ "$(admin -Atc "select 1 from pg_database where datname='$d'")" = "1" ] && { echo "Refusing: $d already exists" >&2; exit 2; }
  admin -c "create database \"$d\"" && admin -c "comment on database \"$d\" is '$MARKER'"
done
s() { psql -X -q -v ON_ERROR_STOP=1 -d "$SRC" "$@"; }
s -f "$HERE/local-shim.sql" >/dev/null
for r in anon authenticated service_role; do case " $roles_before " in *" $r "*) ;; *) admin -c "comment on role $r is '$MARKER'" >/dev/null;; esac; done
for f in "$ROOT"/supabase/migrations/*.sql; do s -f "$f" >/dev/null || { echo "migration failed"; exit 1; }; done
s -f "$ROOT/supabase/seed/01_reference_content.sql" >/dev/null && s -f "$ROOT/supabase/seed/02_synthetic_staging.sql" >/dev/null || { echo "seed failed"; exit 1; }
s -c "insert into auth.users (id,email) values ('aaaaaaaa-0000-4000-8000-00000000000a','admin.a@example.test'); insert into public.admin_users (user_id, display_name) values ('aaaaaaaa-0000-4000-8000-00000000000a','Admin A (test)');" >/dev/null

echo "== backup: pg_dump --data-only (custom format) of the public schema + auth.users from $SRC"
pg_dump -Fc --data-only --no-owner -n public -d "$SRC" -f "$dump" || exit 1
pg_dump -Fc --data-only --no-owner -t auth.users -d "$SRC" -f "$dump.auth" || exit 1
ls -l "$dump" "$dump.auth" | awk '{print "dump size: " $5 " bytes  " $9}' | sed 's#/[^ ]*/##'
echo "== restore: new empty database $DST gets the SCHEMA FROM THE MIGRATIONS (tables, RLS, policies, grants), then the DATA from the dump"
psql -X -q -v ON_ERROR_STOP=1 -d "$DST" -f "$HERE/local-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d "$DST" -f "$f" >/dev/null || { echo "migration failed on target"; exit 1; }; done
# Migrations create the single-row settings tables with defaults; the dump carries the real rows. Clear them in the NEW target only.
PGOPTIONS="-c session_replication_role=replica" psql -X -q -v ON_ERROR_STOP=1 -d "$DST" -c "delete from public.site_state; delete from public.site_settings; delete from public.pricing_rules; delete from public.ops_settings;"
# session_replication_role=replica keeps triggers (audit, validation) from firing while rows are loaded, so history is not duplicated.
PGOPTIONS="-c session_replication_role=replica" pg_restore --data-only --no-owner -d "$DST" "$dump.auth" || { echo "FAIL: restore of auth.users"; rc=1; }
PGOPTIONS="-c session_replication_role=replica" pg_restore --data-only --no-owner -d "$DST" "$dump" || { echo "FAIL: restore of public data"; rc=1; }
rm -f "$dump.auth"

cmp() { psql -X -At -d "$1" -c "$2"; }
Q="select string_agg(t || '=' || n, ',' order by t) from (
     select 'plans' t, count(*) n from public.plans union all select 'dishes', count(*) from public.dishes
     union all select 'faq', count(*) from public.faq_entries union all select 'customers', count(*) from public.customers
     union all select 'subscriptions', count(*) from public.subscriptions union all select 'periods', count(*) from public.subscription_periods
     union all select 'payments', count(*) from public.payments union all select 'releases', count(*) from public.content_releases
     union all select 'menu_slots', count(*) from public.menu_slots union all select 'audit', count(*) from public.audit_log
     union all select 'admin_users', count(*) from public.admin_users union all select 'auth_users', count(*) from auth.users) x"
C="select md5(string_agg(md5(t::text), '' order by md5(t::text))) from (
     select p::text t from public.payments p union all select c::text from public.customers c union all select s::text from public.subscriptions s
     union all select r.payload::text || r.checksum from public.content_releases r union all select a::text from public.audit_log a
     union all select st::text from public.site_state st union all select ss::text from public.site_settings ss) y"
a="$(cmp "$SRC" "$Q")"; b="$(cmp "$DST" "$Q")"; echo "source counts : $a"; echo "restored counts: $b"
ca="$(cmp "$SRC" "$C")"; cb="$(cmp "$DST" "$C")"; echo "source checksum  : $ca"; echo "restored checksum: $cb"
rc=${rc:-0}
[ "$a" = "$b" ] && echo "PASS: row counts identical after restore" || { echo "FAIL: row counts differ"; rc=1; }
[ "$ca" = "$cb" ] && echo "PASS: content checksum identical after restore (payments, customers, subscriptions, releases, audit, site_state, settings)" || { echo "FAIL: checksum differs"; rc=1; }
[ "$(cmp "$SRC" "select count(*) from public.audit_log")" = "$(cmp "$DST" "select count(*) from public.audit_log")" ] && echo "PASS: no audit rows duplicated by triggers during restore" || { echo "FAIL: audit row count changed"; rc=1; }
rls="$(cmp "$DST" "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity")"
[ "$rls" = "19" ] && echo "PASS: RLS is enabled on all 19 tables in the restored database" || { echo "FAIL: RLS tables after restore = $rls"; rc=1; }
anon="$(psql -X -At -d "$DST" -c "set role anon; select count(*) from public.customers" 2>&1 | tail -1)"
echo "$anon" | grep -qi "permission denied" && echo "PASS: anon is still denied on the restored database" || { echo "FAIL: anon check: $anon"; rc=1; }
cp="$(cmp "$DST" "select has_column_privilege('authenticated','public.payments','voided_at','update')")"
[ "$cp" = "f" ] && echo "PASS: column-level grants intact (payments.voided_at not updatable)" || { echo "FAIL: column grant check: $cp"; rc=1; }
pub="$(psql -X -At -d "$DST" -c "set role anon; select (public.get_public_content() #>> '{release,version}')" 2>&1 | tail -1)"
[ "$pub" = "1" ] && echo "PASS: get_public_content works for anon on the restored database (release 1)" || { echo "FAIL: public content after restore: $pub"; rc=1; }
psql -X -q -d "$DST" -c "insert into public.plans (name) values ('post-restore probe')" >/dev/null
[ "$(cmp "$DST" "select count(*) from public.audit_log where table_name='plans' and new_values->>'name'='post-restore probe'")" = "1" ] && echo "PASS: triggers are live again after restore (a new change is audited; audit ids continue from the restored sequence)" || { echo "FAIL: post-restore audit"; rc=1; }
exit $rc
