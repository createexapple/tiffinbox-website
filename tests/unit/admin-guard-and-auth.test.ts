import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readActivity, signActivity } from '@/lib/auth/activity-token';

// ---- fakes for the framework and Supabase (no network) ----
interface FakeUser {
  id: string;
  email: string;
}
const state = {
  user: null as FakeUser | null,
  adminRow: null as { display_name: string; role: 'owner' | 'staff'; is_active: boolean } | null,
  cookies: new Map<string, string>(),
  signInError: null as { status?: number; code?: string } | null,
  signedOut: 0,
  /** Sign-in time carried inside the (fake) verified token, epoch milliseconds. */
  tokenLoginAt: 0,
  headers: new Map<string, string>(),
};

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined,
    has: (name: string) => state.cookies.has(name),
    set: (name: string, value: string) => void state.cookies.set(name, value),
    delete: (name: string) => void state.cookies.delete(name),
    getAll: () => [],
  }),
  headers: async () => ({ get: (name: string) => state.headers.get(name) ?? null }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock('@/lib/supabase/server', () => {
  const client = () => ({
    auth: {
      getUser: async () =>
        state.user
          ? { data: { user: state.user }, error: null }
          : { data: { user: null }, error: { message: 'no session' } },
      getClaims: async () =>
        state.user
          ? {
              data: {
                claims: {
                  sub: state.user.id,
                  session_id: SESSION_ID,
                  amr: [{ method: 'password', timestamp: Math.floor(state.tokenLoginAt / 1000) }],
                },
              },
              error: null,
            }
          : { data: null, error: { message: 'no session' } },
      signInWithPassword: async () =>
        state.signInError || !state.user
          ? {
              data: { user: null },
              error: state.signInError ?? { status: 400, code: 'invalid_credentials' },
            }
          : { data: { user: state.user, session: { access_token: 'fake' } }, error: null },
      signOut: async () => {
        state.signedOut += 1;
        return { error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.adminRow, error: null }) }),
      }),
    }),
  });
  return { createSessionClient: async () => client(), createDetachedClient: () => client() };
});

const NOW = 1_800_000_000_000;
const SESSION_ID = 'session-1';
/** A correctly signed "last active" cookie for the fake session. */
const active = (at: number): string => signActivity(SESSION_ID, at) as string;

function fresh(): void {
  state.user = null;
  state.adminRow = null;
  state.cookies = new Map();
  state.signInError = null;
  state.signedOut = 0;
  state.tokenLoginAt = NOW;
  state.headers = new Map([['x-forwarded-for', '203.0.113.7']]);
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-key';
  delete process.env.TIFFINBOX_TEST_MOCK_BACKEND;
  delete process.env.APP_ENV;
  delete process.env.SESSION_SIGNING_SECRET;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
}

function signedInAdmin(overrides: Partial<NonNullable<typeof state.adminRow>> = {}): void {
  state.user = { id: 'u1', email: 'owner@example.test' };
  state.adminRow = { display_name: 'Owner', role: 'owner', is_active: true, ...overrides };
  state.tokenLoginAt = NOW - 5 * 60_000;
  state.cookies.set('tb_login_at', String(NOW - 5 * 60_000));
  state.cookies.set('tb_active_at', active(NOW - 60_000));
}

beforeEach(() => {
  fresh();
  vi.resetModules();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('requireAdmin (server-side guard, layer 2)', () => {
  it('lets an active admin with a fresh session through', async () => {
    signedInAdmin();
    const { requireAdmin } = await import('@/lib/auth/session');
    await expect(requireAdmin()).resolves.toMatchObject({
      userId: 'u1',
      displayName: 'Owner',
      role: 'owner',
    });
  });

  it('refuses a request with no session', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    await expect(requireAdmin()).rejects.toMatchObject({
      name: 'AuthRequiredError',
      reason: 'none',
    });
  });

  it('refuses a signed-in user who has no admin row, or an inactive one', async () => {
    signedInAdmin();
    state.adminRow = null;
    const first = await import('@/lib/auth/session');
    await expect(first.requireAdmin()).rejects.toMatchObject({ reason: 'not_admin' });

    vi.resetModules();
    signedInAdmin({ is_active: false });
    const second = await import('@/lib/auth/session');
    await expect(second.requireAdmin()).rejects.toMatchObject({ reason: 'not_admin' });
  });

  it('refuses an idle session and ends it on the Auth server', async () => {
    signedInAdmin();
    state.cookies.set('tb_active_at', active(NOW - 31 * 60_000));
    const { requireAdmin } = await import('@/lib/auth/session');
    await expect(requireAdmin()).rejects.toMatchObject({ reason: 'expired' });
    expect(state.signedOut).toBe(1);
  });

  it('ignores forged timestamp cookies (SEC-01)', async () => {
    // Unsigned "I was active just now": refused.
    signedInAdmin();
    state.cookies.set('tb_active_at', String(NOW));
    const unsigned = await import('@/lib/auth/session');
    await expect(unsigned.requireAdmin()).rejects.toMatchObject({ reason: 'expired' });

    // A signature made for another session: refused.
    vi.resetModules();
    signedInAdmin();
    state.cookies.set('tb_active_at', signActivity('another-session', NOW) as string);
    const moved = await import('@/lib/auth/session');
    await expect(moved.requireAdmin()).rejects.toMatchObject({ reason: 'expired' });

    // Rewriting the login-time cookie does not extend a session past the absolute limit:
    // the sign-in time comes from the token.
    vi.resetModules();
    signedInAdmin();
    state.tokenLoginAt = NOW - 13 * 3_600_000;
    state.cookies.set('tb_login_at', String(NOW));
    const old = await import('@/lib/auth/session');
    await expect(old.requireAdmin()).rejects.toMatchObject({ reason: 'expired' });
  });

  it('page guard redirects to the login page (with the expired reason after a timeout)', async () => {
    const plain = await import('@/lib/auth/session');
    await expect(plain.requireAdminPage()).rejects.toThrow('REDIRECT:/admin/login');
    vi.resetModules();
    signedInAdmin();
    state.cookies.set('tb_active_at', active(NOW - 60 * 60_000));
    const expired = await import('@/lib/auth/session');
    await expect(expired.requireAdminPage()).rejects.toThrow(
      'REDIRECT:/admin/login?reason=expired',
    );
  });

  it('the mock identity exists only under the test flag', async () => {
    process.env.TIFFINBOX_TEST_MOCK_BACKEND = '1';
    const { getAdmin } = await import('@/lib/auth/session');
    expect((await getAdmin())?.displayName).toBe('Staff Sample');
    vi.resetModules();
    delete process.env.TIFFINBOX_TEST_MOCK_BACKEND;
    const real = await import('@/lib/auth/session');
    expect(await real.getAdmin()).toBeNull();
  });
});

describe('runAction (every action checks the session first)', () => {
  it('returns "unauthenticated" instead of running the body when nobody is signed in', async () => {
    const { runAction } = await import('@/admin/server/run');
    const body = vi.fn(async () => 'data');
    const result = await runAction('test', 'load_failed', body);
    expect(result).toMatchObject({ ok: false, error: { code: 'unauthenticated' } });
    expect(body).not.toHaveBeenCalled();
  });

  it('runs the body for an admin, and never leaks an unexpected error message', async () => {
    signedInAdmin();
    const { runAction, stop } = await import('@/admin/server/run');
    expect(await runAction('ok', 'load_failed', async () => 42)).toEqual({ ok: true, data: 42 });
    const crash = await runAction('boom', 'save_failed', async () => {
      throw new Error('relation "customers" does not exist: secret detail');
    });
    expect(crash).toMatchObject({ ok: false, error: { code: 'save_failed' } });
    expect(JSON.stringify(crash)).not.toContain('secret detail');
    const stopped = await runAction('stop', 'save_failed', async () =>
      stop('invalid', 'Fix it.', { a: 'b' }),
    );
    expect(stopped).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'Fix it.', fields: { a: 'b' } },
    });
  });
});

describe('signInAction (generic errors, throttling, admin check)', () => {
  const WRONG = 'Email or password is not correct.';

  it('rejects malformed input on the server without calling Auth', async () => {
    const { signInAction } = await import('@/admin/server/auth');
    const out = await signInAction('', '');
    expect(out).toMatchObject({ ok: false, error: { code: 'invalid', message: WRONG } });
  });

  it('gives the same generic message for an unknown account and a wrong password', async () => {
    const { signInAction } = await import('@/admin/server/auth');
    const unknown = await signInAction('nobody@example.test', 'whatever-password');
    state.user = { id: 'u1', email: 'owner@example.test' };
    state.signInError = { status: 400, code: 'invalid_credentials' };
    const wrong = await signInAction('owner@example.test', 'wrong-password');
    expect(unknown).toEqual(wrong);
    expect(unknown).toMatchObject({ ok: false, error: { code: 'invalid', message: WRONG } });
  });

  it('locks after repeated failures and reports the throttling message', async () => {
    const { signInAction } = await import('@/admin/server/auth');
    const results = [];
    for (let i = 0; i < 6; i += 1)
      results.push(await signInAction('x@example.test', 'bad-password'));
    expect(results[4]).toMatchObject({ ok: false, error: { code: 'throttled' } });
    expect(results[5]).toMatchObject({ ok: false, error: { code: 'throttled' } });
    // even the right password is refused while locked
    state.user = { id: 'u1', email: 'x@example.test' };
    state.adminRow = { display_name: 'Owner', role: 'owner', is_active: true };
    expect(await signInAction('x@example.test', 'right-password')).toMatchObject({
      ok: false,
      error: { code: 'throttled' },
    });
  });

  it('maps the Auth rate limit to the throttling message', async () => {
    state.signInError = { status: 429, code: 'over_request_rate_limit' };
    const { signInAction } = await import('@/admin/server/auth');
    expect(await signInAction('y@example.test', 'password-123456')).toMatchObject({
      ok: false,
      error: { code: 'throttled' },
    });
  });

  it('signs a valid Auth user who is not an active admin straight back out, with the generic message', async () => {
    state.user = { id: 'u2', email: 'visitor@example.test' };
    state.adminRow = null;
    const { signInAction } = await import('@/admin/server/auth');
    const out = await signInAction('visitor@example.test', 'password-123456');
    expect(out).toMatchObject({ ok: false, error: { code: 'invalid', message: WRONG } });
    expect(state.signedOut).toBe(1);
    expect(state.cookies.has('tb_login_at')).toBe(false);
  });

  it('succeeds for an active admin and starts the idle / absolute timers', async () => {
    state.user = { id: 'u1', email: 'owner@example.test' };
    state.adminRow = { display_name: 'Owner', role: 'owner', is_active: true };
    const { signInAction } = await import('@/admin/server/auth');
    expect(await signInAction('owner@example.test', 'password-123456')).toEqual({
      ok: true,
      data: { displayName: 'Owner' },
    });
    expect(state.cookies.get('tb_login_at')).toBe(String(NOW));
    expect(readActivity(state.cookies.get('tb_active_at'), SESSION_ID)).toBe(NOW);
  });

  it('refuses sign-in on a deployed environment that has no signing secret (fails closed)', async () => {
    process.env.APP_ENV = 'staging';
    state.user = { id: 'u1', email: 'owner@example.test' };
    state.adminRow = { display_name: 'Owner', role: 'owner', is_active: true };
    const { signInAction } = await import('@/admin/server/auth');
    expect(await signInAction('owner@example.test', 'password-123456')).toMatchObject({
      ok: false,
    });
    expect(state.cookies.has('tb_active_at')).toBe(false);
    expect(state.signedOut).toBe(1);
  });

  it('never logs the email, the password or the address', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { signInAction } = await import('@/admin/server/auth');
    await signInAction('private.person@example.test', 'super-secret-pass');
    const logged = info.mock.calls.flat().join(' ');
    expect(logged).not.toContain('private.person');
    expect(logged).not.toContain('super-secret-pass');
    expect(logged).not.toContain('203.0.113.7');
    info.mockRestore();
  });
});
