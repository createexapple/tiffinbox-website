import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

/** The public site is one page: only the home URL is listed (the sections are hash anchors, not URLs). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: getSiteUrl() }];
}
