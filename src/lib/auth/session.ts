/**
 * Server-side admin guard (architecture sec. 7, layer 2). `requireAdmin()` is called at the top of every admin
 * page and every server action. It does NOT trust the cookie alone:
 *   1. asks Supabase Auth to verify the access token (`getUser`),
 *   2. checks the idle / absolute session limits (FR-13) from the signed token and the signed activity cookie,
 *   3. reads the user's own `admin_users` row and requires `is_active` (the same test as the database's
 *      `app.is_admin()`, which every RLS policy uses as the third layer).
 * A signed-in user who is not an active admin gets nothing.
 */
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionPolicy, getSupabaseConfig, isMockBackend } from '@/lib/env';
import { ACTIVE_AT_COOKIE, LOGIN_AT_COOKIE, evaluateSession } from '@/lib/auth/session-policy';
import { readActivity, sessionClaims } from '@/lib/auth/activity-token';
import { createSessionClient } from '@/lib/supabase/server';

export interface AdminContext {
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'staff';
}

export type AuthFailureReason = 'none' | 'expired' | 'not_admin' | 'unconfigured';

/** Thrown by `requireAdmin` (server actions turn it into a failed result; pages turn it into a redirect). */
export class AuthRequiredError extends Error {
  readonly reason: AuthFailureReason;
  constructor(reason: AuthFailureReason) {
    super('Admin sign-in required');
    this.name = 'AuthRequiredError';
    this.reason = reason;
  }
}

/** Fixed identity for the test-only mock backend (never reachable when APP_ENV is production or staging). */
const MOCK_ADMIN: AdminContext = {
  userId: '00000000-0000-4000-8000-000000000000',
  email: 'staff.sample@example.test',
  displayName: 'Staff Sample',
  role: 'owner',
};

interface AdminRow {
  display_name: string;
  role: 'owner' | 'staff';
  is_active: boolean;
}

async function resolveAdmin(): Promise<{ admin: AdminContext } | { reason: AuthFailureReason }> {
  if (isMockBackend()) return { admin: MOCK_ADMIN };
  if (!getSupabaseConfig()) return { reason: 'unconfigured' };

  const store = await cookies();
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  const hadTimestamps = store.has(LOGIN_AT_COOKIE) || store.has(ACTIVE_AT_COOKIE);
  // Limits are decided from the verified token and the signed activity cookie, never from a plain cookie (SEC-01).
  const verified = !error && data.user ? await supabase.auth.getClaims() : null;
  const session = sessionClaims(verified && !verified.error ? verified.data?.claims : null);

  const policy = getSessionPolicy();
  const verdict = evaluateSession({
    authenticated: !error && data.user !== null,
    hadTimestamps,
    now: Date.now(),
    loginAt: session.loginAt,
    activeAt: readActivity(store.get(ACTIVE_AT_COOKIE)?.value, session.sessionId),
    idleMs: policy.idleMs,
    absoluteMs: policy.absoluteMs,
  });
  if (verdict !== 'ok' || !data.user) {
    if (verdict === 'expired' && data.user) {
      // Idle or too old: end the Auth session as well (best effort; cookies cannot be set from a Server Component).
      await supabase.auth.signOut().catch(() => undefined);
    }
    return { reason: verdict === 'expired' ? 'expired' : 'none' };
  }

  const { data: row, error: rowError } = await supabase
    .from('admin_users')
    .select('display_name, role, is_active')
    .eq('user_id', data.user.id)
    .maybeSingle();
  const admin = row as AdminRow | null;
  if (rowError || !admin || !admin.is_active) return { reason: 'not_admin' };

  return {
    admin: {
      userId: data.user.id,
      email: data.user.email ?? '',
      displayName: admin.display_name,
      role: admin.role,
    },
  };
}

/** One check per request even when layout, page and several helpers ask. */
const resolveOncePerRequest = cache(resolveAdmin);

/** The active admin, or null. Never throws for "not signed in". */
export async function getAdmin(): Promise<AdminContext | null> {
  const result = await resolveOncePerRequest();
  return 'admin' in result ? result.admin : null;
}

/** For server actions and route handlers: throws `AuthRequiredError` unless an active admin is signed in. */
export async function requireAdmin(): Promise<AdminContext> {
  const result = await resolveOncePerRequest();
  if ('admin' in result) return result.admin;
  throw new AuthRequiredError(result.reason);
}

/** For pages and layouts: redirects to the login page instead of throwing. */
export async function requireAdminPage(): Promise<AdminContext> {
  const result = await resolveOncePerRequest();
  if ('admin' in result) return result.admin;
  redirect(result.reason === 'expired' ? '/admin/login?reason=expired' : '/admin/login');
}
