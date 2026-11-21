import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { isIndexingAllowed, getSiteUrl } from '@/lib/site-url';
import { SITE_NAME } from '@/lib/seo';
import '@/styles/tokens.css';
import '@/styles/site.css';

// Self-hosted by Next at build time (no request to Google from the visitor's browser: NFR-01, NFR-11).
// Latin subset only. No Urdu webfont (brand name lives in the logo asset).
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
  variable: '--font-space-grotesk',
});
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  robots: isIndexingAllowed() ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1F5134',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // data-theme="light" pins the brand colours (design/assumptions.md, orchestrator review note).
  return (
    <html lang="en" data-theme="light" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="pub">{children}</body>
    </html>
  );
}
