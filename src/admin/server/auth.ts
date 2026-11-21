'use server';

/**
 * Admin authentication actions (FR-13, NFR-07; architecture sec. 7): sign in, sign out, change password.
 * Supabase Auth (email + password) is the identity provider; the session lives in HTTP-only cookies.
 *  - One generic message for every bad-credential case, so accounts cannot be guessed.
 *  - Throttling: a failure counter per account and per caller address (this app) on top of Supabase Auth's own
 *    rate limits (the control that cannot be bypassed). Keys are hashed; nothing personal is logged.
 *  - A valid Auth account that is NOT an active admin is signed straight back out and gets the same message.
 */
import { cookies, headers } from 'next/headers';
import {
  ACTIVE_AT_COOKIE,
  LOGIN_AT_COOKIE,
  timestampCookieOptions,
} from '@/lib/auth/session-policy';
import { LOGIN_THROTTLE_OPTIONS, Throttle } from '@/lib/auth/throttle';
import { getSessionPolicy } from '@/lib/env';
import { callerAddress, hashKey } from '@/lib/request';
import { createDetachedClient, createSessionClient } from '@/lib/supabase/server';
import { failure, success, type ActionResult } from './result';
import { runAction, stop } from './run';
import { validateLogin } from '../validation/auth';
import { validatePasswordChange } from '../validation/content';

const throttle = new Throttle(LOGIN_THROTTLE_OPTIONS);
const WRONG = 'Email or password is not correct.';

function waitText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Too many attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again. If you forgot your password, ask the owner.`;
}

function logAuth(event: string, fields: Record<string, string | boolean> = {}): void {
  console.info(JSON.stringify({ event, ...fields }));
}

const UNAVAILABLE = 'Sign-in is not available right now. Please try again in a minute.';

export async function signInAction(
  email: string,
  password: string,
): Promise<ActionResult<{ displayName: string }>> {
  try {
    return await signIn(email, password);
  } catch {
    // Backend not configured or unreachable: say so plainly, never leak the reason.
    logAuth('admin_sign_in_error');
    return failure('load_failed', UNAVAILABLE);
  }
}

async function signIn(
  email: string,
  password: string,
): Promise<ActionResult<{ displayName: string }>> {
  const input = validateLogin({ email: String(email ?? ''), password: String(password ?? '') });
  if (!input.ok) return failure('invalid', WRONG, input.errors as Record<string, string>);

  const now = Date.now();
  const address = callerAddress(await headers());
  const keys = [
    hashKey(`account:${input.value.email.toLowerCase()}`),
    hashKey(`address:${address}`),
  ];
  const wait = Math.max(...keys.map((k) => throttle.retryAfterMs(k, now)));
  if (wait > 0) {
    logAuth('admin_sign_in_refused', { reason: 'throttled' });
    return failure('throttled', waitText(wait));
  }

  const recordFailure = (): ActionResult<never> => {
    const locked = keys.map((k) => throttle.recordFailure(k, now)).some(Boolean);
    return locked
      ? failure('throttled', waitText(LOGIN_THROTTLE_OPTIONS.lockMs))
      : failure('invalid', WRONG);
  };

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.value.email,
    password: String(password),
  });

  if (error || !data.user) {
    if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
      logAuth('admin_sign_in_refused', { reason: 'auth_rate_limit' });
      return failure('throttled', waitText(LOGIN_THROTTLE_OPTIONS.lockMs));
    }
    logAuth('admin_sign_in_failed', { reason: 'bad_credentials' });
    return recordFailure();
  }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('display_name, is_active')
    .eq('user_id', data.user.id)
    .maybeSingle();
  const row = adminRow as { display_name: string; is_active: boolean } | null;
  if (!row || !row.is_active) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    logAuth('admin_sign_in_failed', { reason: 'not_an_admin' });
    return recordFailure();
  }

  keys.forEach((k) => throttle.reset(k));
  const policy = getSessionPolicy();
  const store = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  const options = timestampCookieOptions(policy.absoluteMs / 1000, secure);
  store.set(LOGIN_AT_COOKIE, String(now), options);
  store.set(ACTIVE_AT_COOKIE, String(now), options);
  logAuth('admin_sign_in', { ok: true });
  return success({ displayName: row.display_name });
}

export async function signOutAction(): Promise<ActionResult<null>> {
  try {
    const supabase = await createSessionClient();
    await supabase.auth.signOut({ scope: 'local' }); // revokes this session's refresh token
  } catch {
    // Cookies are cleared below regardless.
  }
  const store = await cookies();
  store.delete(LOGIN_AT_COOKIE);
  store.delete(ACTIVE_AT_COOKIE);
  logAuth('admin_sign_out');
  return success(null);
}

export async function getSessionAction(): Promise<
  ActionResult<{ displayName: string; email: string }>
> {
  return runAction('getSession', 'load_failed', async (admin) => ({
    displayName: admin.displayName,
    email: admin.email,
  }));
}

export async function changePasswordAction(
  current: string,
  next: string,
  repeat: string,
): Promise<ActionResult<null>> {
  return runAction('changePassword', 'save_failed', async (admin) => {
    const errors = validatePasswordChange({
      current: String(current ?? ''),
      next: String(next ?? ''),
      repeat: String(repeat ?? ''),
    });
    if (Object.keys(errors).length > 0) {
      stop('invalid', Object.values(errors).join(' '), errors as Record<string, string>);
    }

    const key = hashKey(`password:${admin.userId}`);
    const now = Date.now();
    const wait = throttle.retryAfterMs(key, now);
    if (wait > 0) stop('throttled', waitText(wait));

    // Verify the current password on a throw-away client so the real session cookies are untouched.
    const probe = createDetachedClient();
    const { error: probeError } = await probe.auth.signInWithPassword({
      email: admin.email,
      password: current,
    });
    if (probeError) {
      throttle.recordFailure(key, now);
      stop('invalid', 'Your current password is not correct.', {
        current: 'Your current password is not correct.',
      });
    }
    await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throttle.reset(key);

    const supabase = await createSessionClient();
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      const weak = error.code === 'weak_password' || error.code === 'same_password';
      stop(
        weak ? 'invalid' : 'save_failed',
        weak
          ? 'That password is not accepted. Choose a longer password that you do not use anywhere else.'
          : 'The password could not be changed. Please try again.',
        weak ? { next: 'That password is not accepted.' } : undefined,
      );
    }
    logAuth('admin_password_changed', { ok: true });
    return null;
  });
}
