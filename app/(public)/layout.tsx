import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/public/PublicShell';
import { getPageImages } from '@/content';
import { publicMediaUrl } from '@/lib/media-url';

// Public pages render at request time, never at build: the build artifact carries no content and no
// environment values (ADR-0003 point 8), so the artifact tested on staging is the one that ships. The content
// itself is cached by the reader (tag + 60 s), so this costs one cache lookup per request, not a database call.
export const dynamic = 'force-dynamic';

/** Favicon: the logo, once one is assigned in the admin (Images). Otherwise the browser default, as before. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const { logo } = await getPageImages();
    const url = logo ? publicMediaUrl(logo.path) : null;
    return url ? { icons: { icon: url, apple: url } } : {};
  } catch {
    // No content and no last-good copy: the page itself shows the unavailable state; the icon just stays default.
    return {};
  }
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
