import { createHash, timingSafeEqual } from 'node:crypto';

/** Best-effort caller address for rate limiting (first X-Forwarded-For hop, else "unknown"). Never logged in clear. */
export function callerAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Short one-way hash so an address or email can be used as a map key without being stored in clear. */
export function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

/** Constant-time string comparison (digests are compared, so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a).digest();
  const db = createHash('sha256').update(b).digest();
  return timingSafeEqual(da, db);
}
