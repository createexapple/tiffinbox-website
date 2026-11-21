import { describe, expect, it } from 'vitest';
import { RateLimiter, Throttle, LOGIN_THROTTLE_OPTIONS } from '@/lib/auth/throttle';
import { evaluateSession, parseTimestamp } from '@/lib/auth/session-policy';

const MIN = 60_000;
const base = {
  authenticated: true,
  hadTimestamps: true,
  now: 1_800_000_000_000,
  loginAt: 1_800_000_000_000 - 5 * MIN,
  activeAt: 1_800_000_000_000 - 1 * MIN,
  idleMs: 30 * MIN,
  absoluteMs: 12 * 60 * MIN,
};

describe('evaluateSession (idle and absolute limits, FR-13)', () => {
  it('ok within both limits', () => {
    expect(evaluateSession(base)).toBe('ok');
  });
  it('expired after the idle limit', () => {
    expect(evaluateSession({ ...base, activeAt: base.now - 31 * MIN })).toBe('expired');
    expect(evaluateSession({ ...base, activeAt: base.now - 30 * MIN })).toBe('ok');
  });
  it('expired after the absolute lifetime even when active', () => {
    expect(evaluateSession({ ...base, loginAt: base.now - 13 * 60 * MIN })).toBe('expired');
  });
  it('not signed in: plain "none", or "expired" when we had a session before', () => {
    expect(evaluateSession({ ...base, authenticated: false, hadTimestamps: false })).toBe('none');
    expect(evaluateSession({ ...base, authenticated: false })).toBe('expired');
  });
  it('a valid Auth session without our timestamps is treated as expired (forces a fresh login)', () => {
    expect(evaluateSession({ ...base, loginAt: Number.NaN })).toBe('expired');
    expect(evaluateSession({ ...base, activeAt: Number.NaN })).toBe('expired');
  });
  it('parses timestamps strictly', () => {
    expect(parseTimestamp('1800000000000')).toBe(1_800_000_000_000);
    expect(parseTimestamp(undefined)).toBeNaN();
    expect(parseTimestamp('abc')).toBeNaN();
    expect(parseTimestamp('12')).toBeNaN();
  });
});

describe('login Throttle', () => {
  it('locks a key after 5 failures in the window, then releases it after the lock', () => {
    const t = new Throttle(LOGIN_THROTTLE_OPTIONS);
    let now = 1_000_000;
    for (let i = 0; i < 4; i += 1) {
      expect(t.recordFailure('a', now)).toBe(false);
      now += 1000;
    }
    expect(t.retryAfterMs('a', now)).toBe(0);
    expect(t.recordFailure('a', now)).toBe(true);
    expect(t.retryAfterMs('a', now)).toBe(10 * MIN);
    expect(t.retryAfterMs('a', now + 9 * MIN)).toBeGreaterThan(0);
    expect(t.retryAfterMs('a', now + 10 * MIN + 1)).toBe(0);
    expect(t.retryAfterMs('b', now)).toBe(0);
  });
  it('old failures fall out of the window; reset clears a key', () => {
    const t = new Throttle(LOGIN_THROTTLE_OPTIONS);
    for (let i = 0; i < 4; i += 1) t.recordFailure('a', i);
    expect(t.recordFailure('a', 11 * MIN)).toBe(false); // the first four are older than 10 minutes
    t.reset('a');
    for (let i = 0; i < 4; i += 1) expect(t.recordFailure('a', 12 * MIN + i)).toBe(false);
  });
  it('stays bounded in memory', () => {
    const t = new Throttle({ ...LOGIN_THROTTLE_OPTIONS, maxKeys: 10 });
    for (let i = 0; i < 100; i += 1) t.recordFailure(`k${i}`, 1000 + i);
    expect((t as unknown as { entries: Map<string, unknown> }).entries.size).toBeLessThanOrEqual(
      10,
    );
  });
});

describe('RateLimiter (public route handlers)', () => {
  it('allows `limit` requests per window then refuses, then allows again', () => {
    const r = new RateLimiter(3, MIN);
    expect([1, 2, 3, 4].map((i) => r.allow('ip', i))).toEqual([true, true, true, false]);
    expect(r.allow('other', 5)).toBe(true);
    expect(r.allow('ip', MIN + 10)).toBe(true);
  });
});
