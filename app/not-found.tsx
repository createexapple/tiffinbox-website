import type { Metadata } from 'next';
import Link from 'next/link';
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
      <section className="section notfound">
        <div className="wrap narrow centered">
          <p className="big" aria-hidden="true">
            404
          </p>
          <h1 className="h1-page mt-6">Yeh page nahi mila.</h1>
          <p className="lede">
            The page you are looking for is not here. It may have moved, or the link has a typo.
          </p>
          <div className="cta-row center">
            <Link className="btn btn-primary btn-lg" href="/">
              Go to Home
            </Link>
            <Link className="btn btn-secondary btn-lg" href="/menu">
              See this week’s menu
            </Link>
          </div>
          <p className="muted mt-5">Or order straight away on WhatsApp, below.</p>
        </div>
      </section>
    </PublicShell>
  );
}
