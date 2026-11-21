import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { PUBLIC_CONTENT_TAG } from '@/content/reader';
import { getRevalidateSecret } from '@/lib/env';
import { RateLimiter } from '@/lib/auth/throttle';
import { callerAddress, safeEqual } from '@/lib/request';

/**
 * POST /api/revalidate: expires the cached public content so the next visit re-reads the database (architecture
 * sec. 8.4). Called by the Supabase Cron go-live notifier and by the post-deploy smoke test. Admin publishing
 * does not need it (the publish action expires the same tag itself).
 *
 * Auth: `Authorization: Bearer <REVALIDATE_SECRET>` (shared secret from the host environment). With no secret
 * configured the route answers 503, never "open". Rate limited per caller address.
 */
export const dynamic = 'force-dynamic';

const limiter = new RateLimiter(30, 60_000);
const REASONS = new Set(['menu_go_live', 'smoke_test']);

function error(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const secret = getRevalidateSecret();
  if (!secret) return error(503, 'not_configured', 'Revalidation is not configured.');

  if (!limiter.allow(callerAddress(request.headers), Date.now())) {
    return error(429, 'rate_limited', 'Too many requests. Try again in a minute.');
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!safeEqual(supplied, secret)) return error(401, 'unauthorized', 'Unauthorized.');

  const text = await request.text();
  if (text.trim() !== '') {
    let reason: unknown;
    try {
      reason = (JSON.parse(text) as { reason?: unknown }).reason;
    } catch {
      return error(400, 'invalid_body', 'The body must be JSON.');
    }
    if (reason !== undefined && (typeof reason !== 'string' || !REASONS.has(reason))) {
      return error(400, 'invalid_reason', 'reason must be menu_go_live or smoke_test.');
    }
  }

  revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
  console.info(JSON.stringify({ event: 'revalidate', tag: PUBLIC_CONTENT_TAG }));
  return NextResponse.json({ revalidated: true }, { headers: { 'Cache-Control': 'no-store' } });
}
