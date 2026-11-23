import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Nastaliq_Urdu, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { isIndexingAllowed, getSiteUrl } from '@/lib/site-url';
import { SITE_NAME } from '@/lib/seo';
import '@/styles/tokens.css';
import '@/styles/site.css';

// Self-hosted by Next at build time (no request to Google from the visitor's browser: NFR-01, NFR-11).
// Latin for the text; the Arabic subset of Noto Nastaliq Urdu only for the Urdu brand name in the footer.
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

const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  weight: '400',
  display: 'swap',
  // Only the footer uses it, so do not preload it on every page; it loads when the name is painted.
  preload: false,
  variable: '--font-urdu',
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
    <html
      lang="en"
      data-theme="light"
      className={`${spaceGrotesk.variable} ${inter.variable} ${notoNastaliqUrdu.variable}`}
    >
      <body className="pub">{children}</body>
    </html>
  );
}
