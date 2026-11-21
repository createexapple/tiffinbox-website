import type { MetadataRoute } from 'next';
import { PUBLIC_PAGES } from '@/lib/seo';
import { getSiteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return PUBLIC_PAGES.map((page) => ({ url: page.href === '/' ? base : `${base}${page.href}` }));
}
