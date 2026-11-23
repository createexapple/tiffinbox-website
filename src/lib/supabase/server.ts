/**
 * Supabase clients. SERVER ONLY: the browser never talks to Supabase and never receives a key or token
 * (architecture sec. 7, ADR-0002). Two kinds:
 *  - `createSessionClient()`: acts as the signed-in admin through HTTP-only cookies (`@supabase/ssr`).
 *    Row-level security applies to everything it does.
 *  - `createAnonClient()`: no session, no cookies. Used by the public read path, which may call exactly one
 *    function (`get_public_content`). It must not touch `cookies()` so public pages stay cacheable.
 */
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireSupabaseConfig } from '@/lib/env';

const secureCookies = () => process.env.NODE_ENV === 'production';

/** Session-aware client for server components, server actions and route handlers. */
export async function createSessionClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = requireSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            // Auth cookies are never needed by browser JavaScript: HTTP-only, SameSite=Lax, Secure in production.
            store.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              secure: secureCookies(),
            });
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

export interface AnonClientOptions {
  /** Abort the request after this many milliseconds (public reads use 3 s, NFR-08). */
  timeoutMs?: number;
}

/** Stateless client with the publishable key only (public role). */
export function createAnonClient(options: AnonClientOptions = {}): SupabaseClient {
  const { url, publishableKey } = requireSupabaseConfig();
  const timeoutMs = options.timeoutMs;
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          // Never let Next's data cache store Supabase responses implicitly; caching is done by the reader.
          cache: 'no-store',
          signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : init?.signal,
        }),
    },
  });
}

/**
 * Stateless client used only to check a password (password change): it signs in on its own and keeps nothing,
 * so the visitor's real session cookies are untouched.
 */
export function createDetachedClient(): SupabaseClient {
  return createAnonClient({ timeoutMs: 10_000 });
}
