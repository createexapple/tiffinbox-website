/**
 * Site origin and indexing switch (NFR-04). Server-side env only; no secrets.
 * SITE_URL: public origin for canonical URLs, sitemap and Open Graph. Defaults to localhost.
 * SITE_ALLOW_INDEXING: search engines are blocked unless this is exactly "true", so local, preview
 * and staging builds are never indexed by accident.
 */

const DEFAULT_SITE_URL = 'http://localhost:3000';

function parseOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function getSiteUrl(env: Record<string, string | undefined> = process.env): string {
  return parseOrigin(env.SITE_URL) ?? DEFAULT_SITE_URL;
}

/** True only when a valid SITE_URL is set (used to decide whether to put a url into structured data). */
export function isSiteUrlConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return parseOrigin(env.SITE_URL) !== null;
}

export function isIndexingAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.SITE_ALLOW_INDEXING === 'true';
}
