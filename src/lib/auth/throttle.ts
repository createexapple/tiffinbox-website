/**
 * In-app login throttling (architecture sec. 7, NFR-07). A sliding window of failures per key; after
 * `maxFailures` inside `windowMs` the key is locked for `lockMs`. Keys are hashed by the caller (no email or
 * address is stored in clear). State is in memory: it holds for a single app instance (the planned Azure B1
 * plan) and resets on restart. Supabase Auth's own rate limits are the control that cannot be bypassed;
 * this one only adds friction and the friendly message.
 */

export interface ThrottleOptions {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
  /** Upper bound on tracked keys so the map cannot grow without limit. */
  maxKeys?: number;
}

interface Entry {
  failures: number[];
  lockedUntil: number;
}

export class Throttle {
  private entries = new Map<string, Entry>();
  constructor(private readonly options: ThrottleOptions) {}

  /** Milliseconds the key must still wait, or 0 when it may try. */
  retryAfterMs(key: string, now: number): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    return entry.lockedUntil > now ? entry.lockedUntil - now : 0;
  }

  /** Records a failure; returns true when this failure locks the key. */
  recordFailure(key: string, now: number): boolean {
    this.prune(now);
    const entry = this.entries.get(key) ?? { failures: [], lockedUntil: 0 };
    entry.failures = entry.failures.filter((t) => now - t < this.options.windowMs);
    entry.failures.push(now);
    let locked = false;
    if (entry.failures.length >= this.options.maxFailures) {
      entry.lockedUntil = now + this.options.lockMs;
      entry.failures = [];
      locked = true;
    }
    this.entries.set(key, entry);
    return locked;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(now: number): void {
    const max = this.options.maxKeys ?? 5000;
    if (this.entries.size < max) return;
    for (const [key, entry] of this.entries) {
      const fresh = entry.failures.some((t) => now - t < this.options.windowMs);
      if (!fresh && entry.lockedUntil <= now) this.entries.delete(key);
    }
    // Still full of live entries: drop the oldest so memory stays bounded.
    while (this.entries.size >= max) {
      const first = this.entries.keys().next();
      if (first.done) break;
      this.entries.delete(first.value);
    }
  }
}

/** 5 failures in 10 minutes lock the key for 10 minutes (matches the login screen's "wait 10 minutes"). */
export const LOGIN_THROTTLE_OPTIONS: ThrottleOptions = {
  maxFailures: 5,
  windowMs: 10 * 60_000,
  lockMs: 10 * 60_000,
};

/** Fixed-window request counter for public route handlers (revalidate). */
export class RateLimiter {
  private hits = new Map<string, { windowStart: number; count: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** True when the request is allowed. */
  allow(key: string, now: number): boolean {
    if (this.hits.size > 2000) {
      for (const [k, v] of this.hits) if (now - v.windowStart >= this.windowMs) this.hits.delete(k);
    }
    const current = this.hits.get(key);
    if (!current || now - current.windowStart >= this.windowMs) {
      this.hits.set(key, { windowStart: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }
}
