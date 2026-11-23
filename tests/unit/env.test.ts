import { describe, expect, it } from 'vitest';
import {
  envPresence,
  getRevalidateSecret,
  getSessionPolicy,
  getSupabaseConfig,
  isMockBackend,
} from '@/lib/env';

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe('isMockBackend (test-only flag)', () => {
  it('is off unless the flag is exactly "1"', () => {
    expect(isMockBackend(env({}))).toBe(false);
    expect(isMockBackend(env({ TIFFINBOX_TEST_MOCK_BACKEND: 'true' }))).toBe(false);
    expect(isMockBackend(env({ TIFFINBOX_TEST_MOCK_BACKEND: '1' }))).toBe(true);
  });
  it('can never switch a deployed environment to the mock', () => {
    for (const appEnv of ['production', 'staging', 'Production', ' STAGING ']) {
      expect(isMockBackend(env({ TIFFINBOX_TEST_MOCK_BACKEND: '1', APP_ENV: appEnv }))).toBe(false);
    }
    expect(isMockBackend(env({ TIFFINBOX_TEST_MOCK_BACKEND: '1', APP_ENV: 'local' }))).toBe(true);
  });
});

describe('getSupabaseConfig', () => {
  it('needs both values and a valid http(s) URL; returns the origin only', () => {
    expect(getSupabaseConfig(env({}))).toBeNull();
    expect(getSupabaseConfig(env({ SUPABASE_URL: 'https://x.supabase.co' }))).toBeNull();
    expect(
      getSupabaseConfig(env({ SUPABASE_URL: 'not a url', SUPABASE_PUBLISHABLE_KEY: 'k' })),
    ).toBeNull();
    expect(
      getSupabaseConfig(env({ SUPABASE_URL: 'ftp://x', SUPABASE_PUBLISHABLE_KEY: 'k' })),
    ).toBeNull();
    expect(
      getSupabaseConfig(
        env({ SUPABASE_URL: 'https://x.supabase.co/rest/v1/', SUPABASE_PUBLISHABLE_KEY: ' k ' }),
      ),
    ).toEqual({ url: 'https://x.supabase.co', publishableKey: 'k' });
  });
});

describe('other settings', () => {
  it('revalidate secret must be set and at least 16 characters', () => {
    expect(getRevalidateSecret(env({}))).toBeNull();
    expect(getRevalidateSecret(env({ REVALIDATE_SECRET: 'short' }))).toBeNull();
    expect(getRevalidateSecret(env({ REVALIDATE_SECRET: 'a-long-enough-secret' }))).toBe(
      'a-long-enough-secret',
    );
  });
  it('session policy defaults to 30 minutes idle and 12 hours absolute, overridable within sane bounds', () => {
    expect(getSessionPolicy(env({}))).toEqual({ idleMs: 30 * 60_000, absoluteMs: 12 * 3_600_000 });
    expect(getSessionPolicy(env({ ADMIN_IDLE_MINUTES: '10', ADMIN_SESSION_HOURS: '4' }))).toEqual({
      idleMs: 10 * 60_000,
      absoluteMs: 4 * 3_600_000,
    });
    expect(getSessionPolicy(env({ ADMIN_IDLE_MINUTES: '-5', ADMIN_SESSION_HOURS: 'x' }))).toEqual({
      idleMs: 30 * 60_000,
      absoluteMs: 12 * 3_600_000,
    });
  });
  it('envPresence reports set / missing, never values', () => {
    const out = envPresence(env({ SUPABASE_URL: 'https://secret-ref.supabase.co' }));
    expect(out.SUPABASE_URL).toBe('set');
    expect(out.SUPABASE_PUBLISHABLE_KEY).toBe('missing');
    expect(JSON.stringify(out)).not.toContain('secret-ref');
  });
});
