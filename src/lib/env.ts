/**
 * Server-side configuration read from the environment (12-factor, architecture sec. 7). NAMES only are
 * documented in `.env.example`; values live in `.env.local` (git-ignored), the host settings or CI secrets.
 * Nothing here is ever sent to the browser and nothing here prints a value.
 *
 * The Supabase service-role / secret key is deliberately NOT read anywhere (architecture sec. 7):
 * the app only ever uses the publishable key plus the signed-in admin's own session.
 */
import 'server-only';
import os from 'node:os';
import path from 'node:path';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/** Project URL and publishable key, or null while either is missing or malformed. */
export function getSupabaseConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

/** Throws a plain error (no values) when the backend is not configured. */
export function requireSupabaseConfig(): SupabaseConfig {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      'Backend is not configured: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing.',
    );
  }
  return config;
}

/**
 * Test-only switch: serve the in-memory mock instead of Supabase so unit and e2e tests run with no network.
 * It is honoured only when `TIFFINBOX_TEST_MOCK_BACKEND` is exactly "1" AND `APP_ENV` is neither "production"
 * nor "staging". A deployed environment must set `APP_ENV`, so the flag can never switch a real site to the
 * mock. The flag is read at request time, so the same build artifact serves both (no value is baked in).
 */
export function isMockBackend(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.TIFFINBOX_TEST_MOCK_BACKEND !== '1') return false;
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  return appEnv !== 'production' && appEnv !== 'staging';
}

/** Shared secret for POST /api/revalidate. Null when unset (the route then answers 503, never "open"). */
export function getRevalidateSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.REVALIDATE_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

export interface SessionPolicy {
  idleMs: number;
  absoluteMs: number;
}

function positiveNumber(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= max ? n : fallback;
}

/** FR-13 / architecture sec. 7: 30 minutes idle, 12 hours absolute by default (to be confirmed with the client). */
export function getSessionPolicy(env: NodeJS.ProcessEnv = process.env): SessionPolicy {
  return {
    idleMs: positiveNumber(env.ADMIN_IDLE_MINUTES, 30, 24 * 60) * 60_000,
    absoluteMs: positiveNumber(env.ADMIN_SESSION_HOURS, 12, 24 * 30) * 3_600_000,
  };
}

/** Where the last successfully read public content is kept (NFR-08). Use a persistent disk on the host. */
export function getLastGoodPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.LAST_GOOD_CONTENT_PATH?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(os.tmpdir(), 'tiffinbox-last-good-content.json');
}

/** Run-time environment label: "local" (default), "staging" or "production". */
export function getAppEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.APP_ENV?.trim().toLowerCase() || 'local';
}

/** "set" / "missing" for each variable, never the value. Used by health checks and the integration script. */
export function envPresence(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, 'set' | 'missing'> {
  const names = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'REVALIDATE_SECRET'];
  return Object.fromEntries(names.map((n) => [n, env[n]?.trim() ? 'set' : 'missing']));
}
