import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the project root: a stray lockfile above this repo would otherwise confuse root detection.
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
