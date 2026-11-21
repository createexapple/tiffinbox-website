'use client';

import '@/styles/tokens.css';
import '@/styles/site.css';

/**
 * Last-resort fallback when even the page shell cannot render (for example settings cannot be read).
 * Replaces the root layout, so it carries its own html/body. Plain, readable, no data dependencies.
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <main className="section notfound">
          <div className="wrap narrow centered">
            <h1 className="h1-page">Kuch masla ho gaya.</h1>
            <p className="lede">
              We could not load this page right now. Please try again in a minute.
            </p>
            <div className="cta-row center">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => retry()}>
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
