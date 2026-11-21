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
