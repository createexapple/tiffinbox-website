/**
 * Designed error state for "no content available" (FR-12 AC 2, NFR-08): the backend cannot be reached and there is
 * no saved copy, or nothing has been published yet. Rendered on the server inside the page chrome, so it is in
 * the HTML even without JavaScript. Never blank, never a crash page, nothing technical shown.
 */
export function ContentUnavailable() {
  return (
    <section className="section notfound" data-testid="content-unavailable">
      <div className="wrap narrow centered">
        <h1 className="h1-page">Kuch masla ho gaya.</h1>
        <p className="lede">We could not load this page right now. Please try again in a minute.</p>
        <div className="cta-row center">
          {/* A plain link to the same page: a fresh request, which re-reads the content. */}
          <a className="btn btn-primary btn-lg" href="">
            Try again
          </a>
        </div>
      </div>
    </section>
  );
}
