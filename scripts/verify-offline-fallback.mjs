#!/usr/bin/env node
/**
 * Real-server check of NFR-08 ("the public site stays up when the backend is down") and of the designed error
 * state. Needs no Supabase project and no secrets: it starts the production build (`npm run build` first) with
 * the backend pointed at a closed local port, and tests three situations:
 *   A. backend unreachable + a last-good file  -> pages render the saved content (HTTP 200, real prices);
 *   B. backend unreachable + no last-good file -> designed error state, no crash, chrome still there;
 *   C. no Supabase configuration at all        -> admin redirects to login, health up, revalidate refuses.
 * Run: npm run build && npm run test:fallback
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publicContentDocument } from '../tests/unit/fixtures/public-content.ts';

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${!ok && detail ? ` (${detail})` : ''}`);
};

async function withServer(port, env, fn) {
  // The Next.js data cache is kept on disk between runs (that is how content survives a restart), so start clean.
  await rm('.next/cache/fetch-cache', { recursive: true, force: true });
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(port)], {
    env: { ...process.env, TIFFINBOX_TEST_MOCK_BACKEND: '', APP_ENV: 'local', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  try {
    for (let i = 0; i < 60; i += 1) {
      try {
        if ((await fetch(`http://localhost:${port}/api/health`)).ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await fn(`http://localhost:${port}`);
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 300));
  }
  return log;
}

const dir = await mkdtemp(path.join(os.tmpdir(), 'tb-fallback-'));
const lastGood = path.join(dir, 'last-good.json');
// A closed local port: the backend is "down". The key is a dummy; no real project is contacted.
const DOWN = { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_PUBLISHABLE_KEY: 'dummy-key-not-a-secret' };

console.log('== A. backend unreachable, last-good file present');
await writeFile(lastGood, JSON.stringify({ savedAt: new Date().toISOString(), document: publicContentDocument() }));
const logA = await withServer(3301, { ...DOWN, LAST_GOOD_CONTENT_PATH: lastGood }, async (base) => {
  const plans = await fetch(`${base}/plans`);
  const html = await plans.text();
  check('GET /plans answers 200', plans.status === 200, String(plans.status));
  check('it shows the saved plan names and prices', html.includes('Budget') && html.includes('All 3 Meals') && /Rs\s?300/.test(html));
  check('there is no sample-content banner and no error state', !html.includes('Preview with sample content') && !html.includes('Kuch masla ho gaya'));
  const menu = await (await fetch(`${base}/menu`)).text();
  check('GET /menu shows the saved weekly menu', menu.includes('lunch on day 1'));
});
check('the failure was logged as structured JSON without secrets', logA.includes('content_fetch_failed') && !logA.includes('dummy-key-not-a-secret'));

console.log('\n== B. backend unreachable, no last-good file');
await rm(lastGood, { force: true });
await withServer(3302, { ...DOWN, LAST_GOOD_CONTENT_PATH: lastGood }, async (base) => {
  const res = await fetch(`${base}/menu`);
  const html = await res.text();
  check('GET /menu does not crash (no 5xx page)', res.status < 500, String(res.status));
  check('it shows the designed error state, in the normal page chrome', html.includes('Kuch masla ho gaya') && html.includes('site-header'));
  const home = await fetch(`${base}/`);
  check('GET / also stays up', home.status < 500, String(home.status));
});

console.log('\n== C. no Supabase configuration');
await withServer(3303, { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', REVALIDATE_SECRET: '', LAST_GOOD_CONTENT_PATH: lastGood }, async (base) => {
  const admin = await fetch(`${base}/admin`, { redirect: 'manual' });
  check('GET /admin redirects to the login page', [307, 308].includes(admin.status) && (admin.headers.get('location') ?? '').endsWith('/admin/login'), `${admin.status} ${admin.headers.get('location')}`);
  const login = await fetch(`${base}/admin/login`);
  check('the login page itself renders', login.status === 200, String(login.status));
  const health = await (await fetch(`${base}/api/health`)).json();
  check('/api/health is ok and exposes no configuration', health.status === 'ok' && Object.keys(health).length === 2);
  const reval = await fetch(`${base}/api/revalidate`, { method: 'POST' });
  check('/api/revalidate answers 503 (not configured), never open', reval.status === 503, String(reval.status));
});

await rm(dir, { recursive: true, force: true });
console.log(`\nassertions passed: ${passed}`);
console.log(`assertions failed: ${failed}`);
console.log(failed === 0 ? 'RESULT: OK' : 'RESULT: FAILED');
process.exit(failed === 0 ? 0 : 1);
