/**
 * Idle and absolute session limits (FR-13, NFR-07). Pure, so it can be unit-tested and shared by the
 * proxy (pages) and `requireAdmin` (server actions). Supabase Auth owns the real token lifetime; this is the
 * app's own extra control. The two timestamps live in HTTP-only cookies written by the proxy / sign-in action.
 */

export const LOGIN_AT_COOKIE = 'tb_login_at';
export const ACTIVE_AT_COOKIE = 'tb_active_at';

export type SessionVerdict = 'ok' | 'none' | 'expired';

export interface SessionInput {
  /** The Supabase session verified by the Auth server (or a verified JWT). */
  authenticated: boolean;
  /** Whether our timestamp cookies exist (tells "never logged in" from "was logged in"). */
  hadTimestamps: boolean;
  now: number;
  loginAt: number;
  activeAt: number;
  idleMs: number;
  absoluteMs: number;
}

/**
 * ok: carry on. none: never signed in (plain redirect to the login page). expired: show the
 * "you were logged out" message (idle, absolute lifetime, or the Auth session vanished while we had cookies).
 */
export function evaluateSession(input: SessionInput): SessionVerdict {
  if (!input.authenticated) return input.hadTimestamps ? 'expired' : 'none';
  if (!Number.isFinite(input.loginAt) || !Number.isFinite(input.activeAt)) return 'expired';
  if (input.now - input.activeAt > input.idleMs) return 'expired';
  if (input.now - input.loginAt > input.absoluteMs) return 'expired';
  return 'ok';
}

/** Parses a cookie value holding epoch milliseconds; NaN for anything else. */
export function parseTimestamp(value: string | undefined): number {
  if (value === undefined || !/^\d{10,16}$/.test(value)) return Number.NaN;
  return Number(value);
}

/** Cookie options shared by both timestamp cookies: HTTP-only, SameSite=Lax, Secure outside local dev. */
export function timestampCookieOptions(maxAgeSeconds: number, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
