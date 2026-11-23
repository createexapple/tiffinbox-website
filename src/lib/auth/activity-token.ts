/**
 * Tamper-proof inputs for the idle and absolute session limits (FR-13, NFR-07; security review SEC-01).
 *
 * The limits must not be decided from values the browser can rewrite. So:
 *  - the absolute limit starts at the sign-in time inside the Auth token (`amr[].timestamp`), which Supabase
 *    signs and which survives token refreshes;
 *  - the "last active" cookie carries an HMAC over `<session id>.<timestamp>`, so it cannot be forged, moved
 *    to another session or advanced without the server's key.
 *
 * Key: SESSION_SIGNING_SECRET (32+ characters) from the host environment. A deployed environment
 * (APP_ENV staging or production) without it fails closed: nobody stays signed in. Local development falls back
 * to a key derived from the publishable key, which is not secret, so that fallback is never used when deployed.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MIN_SECRET_LENGTH = 32;

function signingKey(env: NodeJS.ProcessEnv): Buffer | null {
  const secret = env.SESSION_SIGNING_SECRET?.trim();
  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return createHash('sha256').update(`tb-activity:${secret}`).digest();
  }
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv === 'staging' || appEnv === 'production') return null;
  const local = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!local) return null;
  return createHash('sha256').update(`tb-activity-local:${local}`).digest();
}

function mac(key: Buffer, sessionId: string, timestamp: number): Buffer {
  return createHmac('sha256', key).update(`${sessionId}.${timestamp}`).digest();
}

/** Cookie value for "active at `timestamp`" bound to this Auth session, or null when no key is available. */
export function signActivity(
  sessionId: string,
  timestamp: number,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const key = signingKey(env);
  if (!key || !sessionId || !Number.isSafeInteger(timestamp)) return null;
  return `${timestamp}.${mac(key, sessionId, timestamp).toString('base64url')}`;
}

/** The timestamp inside a cookie value if its signature is valid for this session; NaN for anything else. */
export function readActivity(
  value: string | undefined,
  sessionId: string,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const key = signingKey(env);
  const match = value === undefined ? null : /^(\d{10,16})\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!key || !sessionId || !match) return Number.NaN;
  const timestamp = Number(match[1]);
  const supplied = Buffer.from(match[2] ?? '', 'base64url');
  const expected = mac(key, sessionId, timestamp);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    return Number.NaN;
  return timestamp;
}

export interface SessionClaims {
  sessionId: string;
  /** Sign-in time in epoch milliseconds, from the signed token; NaN when the token does not carry one. */
  loginAt: number;
}

/** Reads the session id and the original sign-in time from VERIFIED token claims. */
export function sessionClaims(claims: unknown): SessionClaims {
  const record = (claims ?? {}) as Record<string, unknown>;
  const sessionId = typeof record.session_id === 'string' ? record.session_id : '';
  const times = (Array.isArray(record.amr) ? record.amr : [])
    .map((entry) => (entry as { timestamp?: unknown } | null)?.timestamp)
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0);
  return { sessionId, loginAt: times.length > 0 ? Math.min(...times) * 1000 : Number.NaN };
}
