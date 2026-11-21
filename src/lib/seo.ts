import type { Metadata } from 'next';
import { isIndexingAllowed } from './site-url';

export const SITE_NAME = 'Tiffin Box';

/** The six public pages, in navigation order. Single source for nav, footer and sitemap. */
export const PUBLIC_PAGES = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Menu' },
  { href: '/plans', label: 'Plans & Pricing' },
  { href: '/customize', label: 'Customize' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about', label: 'About & Contact' },
] as const;

interface PageMeta {
  /** Page title without the site name; the root template appends " | Tiffin Box". */
  title: string;
  /** Use instead of `title` when the page needs the full title as written. */
  absoluteTitle?: string;
  description: string;
  path: string;
}

/** Per-page title, description, canonical URL and Open Graph / Twitter tags (NFR-04). */
export function pageMetadata({ title, absoluteTitle, description, path }: PageMeta): Metadata {
  const shareTitle = absoluteTitle ?? `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_PK',
      title: shareTitle,
      description,
      url: path,
    },
    twitter: { card: 'summary', title: shareTitle, description },
    robots: isIndexingAllowed() ? undefined : { index: false, follow: false },
  };
}
