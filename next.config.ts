import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the project root: a stray lockfile above this repo would otherwise confuse root detection.
  turbopack: { root: path.resolve(process.cwd()) },
  experimental: {
    // Photo uploads go through a server action (FR-21: 8 MB limit enforced again in the action).
    // 8 MB file + multipart overhead. The action checks the session first, then type, size and content.
    serverActions: { bodySizeLimit: '9mb' },
  },
  async headers() {
    return [
      {
        // Baseline security headers on every response (NFR-07; security review SEC-04). A full script
        // Content-Security-Policy needs per-request nonces and is tracked separately; this policy already
        // blocks framing (clickjacking), plugins, <base> hijacking and form posts to other sites.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          // Ignored by browsers over plain http (local development); enforced once served over HTTPS.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
      {
        // Admin pages are never indexed and never cached (NFR-07, NFR-12). Second layer next to the robots meta tag.
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
