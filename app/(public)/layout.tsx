import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/public/PublicShell';
import { DEFAULT_LOGO_URL } from '@/lib/brand';

// Public pages render at request time, never at build: the build artifact carries no content and no
// environment values (ADR-0003 point 8), so the artifact tested on staging is the one that ships. The content
// itself is cached by the reader (tag + 60 s), so this costs one cache lookup per request, not a database call.
export const dynamic = 'force-dynamic';

/** Favicon: always the bundled logo (the design's), whatever logo is assigned in the admin. */
export const metadata: Metadata = {
  icons: { icon: DEFAULT_LOGO_URL, apple: DEFAULT_LOGO_URL },
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
