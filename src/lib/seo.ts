import type { Metadata } from 'next';
import { isIndexingAllowed } from './site-url';

export const SITE_NAME = 'Tiffin Box';

/**
 * The six sections of the single public page, in navigation order. `id` is the section id and the address hash
 * (#menu); `href` is the link target (works from any page, e.g. the 404 page). The old page routes redirect here.
 */
export const PUBLIC_PAGES = [
  { id: 'home', href: '/#home', label: 'Home' },
  { id: 'menu', href: '/#menu', label: 'Menu' },
  { id: 'plans', href: '/#plans', label: 'Plans & Pricing' },
  { id: 'customize', href: '/#customize', label: 'Customize' },
  { id: 'how', href: '/#how', label: 'How it works' },
  { id: 'about', href: '/#about', label: 'About & Contact' },
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
