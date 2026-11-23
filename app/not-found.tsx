import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page could not be found.',
  robots: { index: false, follow: false },
};

/** S-07 (FR-12): branded 404, served with HTTP 404, inside the full public chrome so the visitor is never stranded. */
export default function NotFound() {
  return (
    <PublicShell keepChildrenWhenUnavailable>
      <div className="t-band t-notfound">
        <div className="t-wrap">
          <p className="t-kick" aria-hidden="true">
            404
          </p>
          <h1>Yeh page nahi mila.</h1>
          <p className="t-lead" style={{ marginInline: 'auto' }}>
            The page you are looking for is not here. It may have moved, or the link has a typo.
          </p>
          <div className="t-row" style={{ justifyContent: 'center', marginTop: 24 }}>
            {/* Plain anchors on purpose: the sections are shown by :target, which only a real fragment navigation updates (not router pushState). */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="t-btn t-fill" href="/#home">
              Go to Home
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="t-btn t-line" href="/#menu">
              See this week&apos;s menu
            </a>
          </div>
          <p className="t-note">Or order straight away on WhatsApp, below.</p>
        </div>
      </div>
    </PublicShell>
  );
}
