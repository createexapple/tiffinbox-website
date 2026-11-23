/**
 * Auth proxy for /admin (Next.js 16 `proxy`, the successor of `middleware`; architecture sec. 7 layer 1).
 * Matches `/admin` ONLY, so the public site never depends on it (NFR-08).
 *
 * For every admin page request it: refreshes the Supabase session, verifies it, applies the idle / absolute
 * limits (FR-13) and redirects to the login page (with `?reason=expired` after a timeout). Server-action
 * requests pass through: `requireAdmin()` inside each action makes the same decision and answers "signed out",
 * which the client turns into the same redirect (a redirect response cannot be followed by an action call).
 * This is only layer 1. Pages and actions re-check the session themselves, and the database re-checks last.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACTIVE_AT_COOKIE,
  LOGIN_AT_COOKIE,
  evaluateSession,
  timestampCookieOptions,
} from '@/lib/auth/session-policy';
import { readActivity, sessionClaims, signActivity } from '@/lib/auth/activity-token';
import { getSessionPolicy, getSupabaseConfig, isMockBackend } from '@/lib/env';

function redirectToLogin(request: NextRequest, reason?: 'expired'): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = reason ? `?reason=${reason}` : '';
  return NextResponse.redirect(url);
}

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

export async function proxy(request: NextRequest) {
  if (isMockBackend()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/admin/login';
  const isAction = request.headers.has('next-action');
  // Link prefetches are the browser guessing, not the admin acting: they must not keep an idle session alive.
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) return isLogin ? NextResponse.next() : redirectToLogin(request);

  const secure = process.env.NODE_ENV === 'production';
  // Cookies the Auth client wants to write (token refresh, sign-out). They go on whatever response we return,
  // and on the forwarded request so server components in the same request see the refreshed session.
  const written: CookieToSet[] = [];
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          written.push({ name, value, options: options ?? {} });
        }
      },
    },
  });

  // getClaims() verifies the token's signature (and refreshes an expired one). Never use getSession() here.
  const { data, error } = await supabase.auth.getClaims();
  const policy = getSessionPolicy();
  const now = Date.now();
  // Both limits come from values the browser cannot forge (SEC-01): the sign-in time inside the verified
  // token, and the HMAC-signed activity cookie bound to this session. LOGIN_AT_COOKIE is only a hint that
  // tells "was signed in" from "never signed in"; it decides nothing.
  const session = sessionClaims(!error ? data?.claims : null);
  const verdict = evaluateSession({
    authenticated: !error && !!data?.claims,
    hadTimestamps: request.cookies.has(LOGIN_AT_COOKIE) || request.cookies.has(ACTIVE_AT_COOKIE),
    now,
    loginAt: session.loginAt,
    activeAt: readActivity(request.cookies.get(ACTIVE_AT_COOKIE)?.value, session.sessionId),
    idleMs: policy.idleMs,
    absoluteMs: policy.absoluteMs,
  });

  const withCookies = (response: NextResponse): NextResponse => {
    for (const { name, value, options } of written) {
      response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure });
    }
    return response;
  };
  const clearTimestamps = (response: NextResponse): NextResponse => {
    for (const name of [LOGIN_AT_COOKIE, ACTIVE_AT_COOKIE]) response.cookies.delete(name);
    return response;
  };

  if (verdict === 'ok') {
    if (isLogin) {
      // Already signed in: the login page is not needed.
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return withCookies(NextResponse.redirect(url));
    }
    if (isPrefetch) return withCookies(NextResponse.next({ request }));
    // Activity: pages and server actions both count (FR-13 idle timeout is "no activity").
    const activity = signActivity(session.sessionId, now);
    if (activity) request.cookies.set(ACTIVE_AT_COOKIE, activity);
    const response = withCookies(NextResponse.next({ request }));
    if (activity) {
      response.cookies.set(
        ACTIVE_AT_COOKIE,
        activity,
        timestampCookieOptions(policy.absoluteMs / 1000, secure),
      );
    }
    return response;
  }

  // Server actions: requireAdmin() inside the action makes the same decision and the client redirects.
  if (isAction) return withCookies(NextResponse.next({ request }));

  if (verdict === 'expired') {
    await supabase.auth.signOut().catch(() => undefined);
    const response = isLogin ? NextResponse.next({ request }) : redirectToLogin(request, 'expired');
    return clearTimestamps(withCookies(response));
  }

  // Never signed in.
  return isLogin ? withCookies(NextResponse.next({ request })) : redirectToLogin(request);
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
