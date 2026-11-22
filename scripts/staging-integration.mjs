#!/usr/bin/env node
/**
 * Integration check of the ANON (public) role against the STAGING Supabase project (architecture sec. 7,
 * docs/database.md sec. 3 and 4). Run with `npm run test:staging`: Node loads `.env.local` itself
 * (`--env-file-if-exists`); this script only reads `process.env` and never prints a value.
 *
 * What it proves, as the public role with the publishable key only:
 *   - get_public_content() returns the published document (schema, release, menu) and nothing personal;
 *   - direct reads of customers, payments, subscriptions, site_settings (and every other table and view) are refused;
 *   - writes (insert, update, delete) to any table are refused;
 *   - the admin-only functions are refused.
 * Writes use deliberately invalid or never-matching payloads, so even a misconfigured project would not be changed.
 * It never signs up, signs in or creates anything. Exit codes: 0 all passed, 1 a check failed, 2 NOT RUN (env missing).
 */
import { createClient } from '@supabase/supabase-js';

const NAMES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
const presence = Object.fromEntries(NAMES.map((n) => [n, process.env[n]?.trim() ? 'set' : 'missing']));
for (const [name, state] of Object.entries(presence)) console.log(`${name}: ${state}`);
if (Object.values(presence).includes('missing')) {
  console.log('RESULT: NOT RUN (environment variables missing; create .env.local, see docs/backend.md)');
  process.exit(2);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

/**
 * Refused = an error and no data. 42501 / 401 / 403 are "permission denied"; PGRST202 (function not visible to
 * the role) also means "cannot call it". Anything else is reported as a failure with its code.
 */
function refused(result) {
  const { data, error, status } = result;
  const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
  const denied =
    !!error &&
    rows === 0 &&
    (error.code === '42501' ||
      error.code === 'PGRST202' ||
      [401, 403].includes(status) ||
      /permission denied/i.test(error.message ?? ''));
  return { denied, detail: `status ${status}, code ${error?.code ?? 'none'}, rows ${rows}` };
}

const ZERO = '00000000-0000-0000-0000-000000000000';
const TABLES = [
  { name: 'customers', key: 'id', never: ZERO },
  { name: 'payments', key: 'id', never: ZERO },
  { name: 'subscriptions', key: 'id', never: ZERO },
  { name: 'subscription_periods', key: 'id', never: ZERO },
  { name: 'site_settings', key: 'id', never: 0 },
  { name: 'pricing_rules', key: 'id', never: 0 },
  { name: 'ops_settings', key: 'id', never: 0 },
  { name: 'site_state', key: 'id', never: 0 },
  { name: 'plans', key: 'id', never: ZERO },
  { name: 'dishes', key: 'id', never: ZERO },
  { name: 'addons', key: 'id', never: ZERO },
  { name: 'faq_entries', key: 'id', never: ZERO },
  { name: 'media', key: 'id', never: ZERO },
  { name: 'page_images', key: 'slot_key', never: '__none__' },
  { name: 'menu_weeks', key: 'id', never: ZERO },
  { name: 'menu_slots', key: 'id', never: ZERO },
  { name: 'content_releases', key: 'id', never: 0, set: { note: '' } },
  { name: 'audit_log', key: 'id', never: 0, set: { action: 'update' } },
  { name: 'admin_users', key: 'user_id', never: ZERO },
];
const VIEWS = [
  'subscription_status',
  'period_payment_status',
  'subscription_balance',
  'customer_summary',
  'menu_week_status',
  'dashboard_overview',
  'change_history',
];

console.log('\n== public content (anon)');
const content = await supabase.rpc('get_public_content');
check('get_public_content() answers without an error', !content.error, content.error?.code);
const doc = content.data;
check('it returns a published document (schema_version 1)', doc && doc.schema_version === 1, doc ? `schema ${doc.schema_version}` : 'null: nothing published yet');
if (doc) {
  check('release version is a positive integer', Number.isInteger(doc.release?.version) && doc.release.version >= 1, JSON.stringify(doc.release));
  const keys = Object.keys(doc).sort().join(',');
  check(
    'only the public keys are present (no customers, payments, subscriptions, drafts)',
    keys === 'addons,dishes,faq,menu,page_images,plans,pricing_rules,release,schema_version,settings',
    keys,
  );
  check('plans are priced', Array.isArray(doc.plans) && doc.plans.length > 0 && doc.plans.every((p) => Number.isInteger(p.unit_price) && Number.isInteger(p.weekly_price)));
  check('the live menu has 21 slots', doc.menu === null || (Array.isArray(doc.menu.slots) && doc.menu.slots.length === 21), `${doc.menu?.slots?.length}`);
  check('no internal ids leak into menu slots', !JSON.stringify(doc.menu ?? {}).includes('media_id'));
}

console.log('\n== direct reads are refused (anon)');
for (const { name } of TABLES) {
  const r = refused(await supabase.from(name).select('*').limit(1));
  check(`SELECT ${name}`, r.denied, r.detail);
}
for (const name of VIEWS) {
  const r = refused(await supabase.from(name).select('*').limit(1));
  check(`SELECT view ${name}`, r.denied, r.detail);
}

console.log('\n== writes are refused (anon)');
// `set` is used where the key is an identity column: Postgres rejects writing to it (428C9) before it checks
// permissions, which would hide whether the role is actually denied.
for (const { name, key, never, set } of TABLES) {
  const ins = refused(await supabase.from(name).insert({}));
  check(`INSERT ${name}`, ins.denied, ins.detail);
  const upd = refused(await supabase.from(name).update(set ?? { [key]: never }).eq(key, never));
  check(`UPDATE ${name}`, upd.denied, upd.detail);
  const del = refused(await supabase.from(name).delete().eq(key, never));
  check(`DELETE ${name}`, del.denied, del.detail);
}

console.log('\n== admin functions are refused (anon)');
const calls = [
  ['get_draft_content', { menu_week_id: null }],
  ['draft_status', {}],
  ['publish_content', { note: null }],
  ['rollback_release', { version: 2147483647 }],
  ['save_menu_week', { week_start: '2000-01-03', slots: [] }],
  ['copy_menu_week', { source_week_id: ZERO, week_start: '2000-01-03' }],
  ['release_menu_week', { menu_week_id: ZERO, mode: 'cancel_schedule' }],
  ['void_payment', { payment_id: ZERO, reason: 'x' }],
  ['anonymise_customer', { customer_id: ZERO }],
];
for (const [fn, args] of calls) {
  const r = refused(await supabase.rpc(fn, args));
  check(`RPC ${fn}`, r.denied, r.detail);
}

console.log('\n== storage (anon)');
const incoming = await supabase.storage.from('media-incoming').list('', { limit: 1 });
check('the private media-incoming bucket lists nothing', !!incoming.error || (incoming.data ?? []).length === 0, `${incoming.data?.length ?? 'error'} entries`);

console.log(`\nassertions passed: ${passed}`);
console.log(`assertions failed: ${failed}`);
console.log(failed === 0 ? 'RESULT: OK' : 'RESULT: FAILED');
process.exit(failed === 0 ? 0 : 1);
