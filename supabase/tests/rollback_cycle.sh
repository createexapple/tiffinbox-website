#!/usr/bin/env bash
# Migration round trip on the throwaway database: apply every rollback in reverse order, check that nothing of ours
# is left in public/app, re-apply every migration, check the end state again. Run by run.sh (arg 1 = database name).
set -u -o pipefail
DB="${1:?database name}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
case "$DB" in tiffinbox_stage3_test) ;; *) echo "refusing: not the throwaway database" >&2; exit 2;; esac
q() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
rc=0
for f in $(ls "$ROOT"/supabase/rollbacks/*.down.sql | sort -r); do
  q -f "$f" >/dev/null || { echo "FAIL: rollback script failed: $(basename "$f")"; rc=1; }
done
left="$(q -c "select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S'))
   + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app'))")"
if [ "$left" = "0" ]; then echo "PASS: after all rollbacks no table, view, sequence or function remains in public or app"; else echo "FAIL: $left objects remain after rollback"; rc=1; fi
for f in "$ROOT"/supabase/migrations/*.sql; do
  q -f "$f" >/dev/null 2>&1 || { echo "FAIL: re-applying $(basename "$f") after rollback failed"; rc=1; break; }
done
n="$(q -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity")"
[ "$n" = "19" ] && echo "PASS: after re-applying, all 19 tables exist with RLS enabled" || { echo "FAIL: expected 19 RLS tables after re-apply, got $n"; rc=1; }
a="$(q -c "select array_agg(p.proname::text) from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname in ('public','app') and has_function_privilege('anon', p.oid, 'execute')")"
[ "$a" = "{get_public_content}" ] && echo "PASS: after re-applying, anon may execute only get_public_content" || { echo "FAIL: anon functions after re-apply: $a"; rc=1; }
exit $rc
