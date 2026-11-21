import type { MetadataRoute } from 'next';
import { getSiteUrl, isIndexingAllowed } from '@/lib/site-url';

/** Search engines are blocked unless SITE_ALLOW_INDEXING=true (local, preview and staging stay out of search). */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexingAllowed()) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${getSiteUrl()}/sitemap.xml` };
}
