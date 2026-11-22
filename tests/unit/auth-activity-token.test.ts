import { describe, expect, it } from 'vitest';
import { readActivity, sessionClaims, signActivity } from '@/lib/auth/activity-token';

const NOW = 1_800_000_000_000;
const local = { SUPABASE_PUBLISHABLE_KEY: 'test-key' } as unknown as NodeJS.ProcessEnv;
const deployed = {
  APP_ENV: 'staging',
  SESSION_SIGNING_SECRET: 'x'.repeat(40),
} as unknown as NodeJS.ProcessEnv;

describe('activity token (SEC-01)', () => {
  it('round-trips for the same session and key', () => {
    const value = signActivity('s1', NOW, deployed);
    expect(readActivity(value ?? undefined, 's1', deployed)).toBe(NOW);
  });
  it('rejects a changed timestamp, another session, another key and plain numbers', () => {
    const value = signActivity('s1', NOW, deployed) as string;
    const later = value.replace(String(NOW), String(NOW + 1000));
    expect(readActivity(later, 's1', deployed)).toBeNaN();
    expect(readActivity(value, 's2', deployed)).toBeNaN();
    expect(
      readActivity(value, 's1', { ...deployed, SESSION_SIGNING_SECRET: 'y'.repeat(40) }),
    ).toBeNaN();
    expect(readActivity(String(NOW), 's1', deployed)).toBeNaN();
    expect(readActivity(undefined, 's1', deployed)).toBeNaN();
    expect(readActivity(value, '', deployed)).toBeNaN();
  });
  it('fails closed when a deployed environment has no (or a short) secret', () => {
    for (const APP_ENV of ['staging', 'production', 'Production ']) {
      const env = { APP_ENV, SUPABASE_PUBLISHABLE_KEY: 'k' } as unknown as NodeJS.ProcessEnv;
      expect(signActivity('s1', NOW, env)).toBeNull();
      expect(signActivity('s1', NOW, { ...env, SESSION_SIGNING_SECRET: 'short' })).toBeNull();
    }
  });
  it('local development works without a secret', () => {
    const value = signActivity('s1', NOW, local);
    expect(value).not.toBeNull();
    expect(readActivity(value ?? undefined, 's1', local)).toBe(NOW);
  });
  it('reads the session id and the earliest sign-in time from token claims', () => {
    expect(
      sessionClaims({
        session_id: 'abc',
        amr: [
          { method: 'totp', timestamp: 1_800_000_500 },
          { method: 'password', timestamp: 1_800_000_000 },
        ],
      }),
    ).toEqual({ sessionId: 'abc', loginAt: 1_800_000_000_000 });
    expect(sessionClaims({ session_id: 'abc' }).loginAt).toBeNaN();
    expect(sessionClaims(null)).toEqual({ sessionId: '', loginAt: Number.NaN });
  });
});
