/**
 * Designed error state for "no content available" (FR-12 AC 2, NFR-08): the backend cannot be reached and there is
 * no saved copy, or nothing has been published yet. Rendered on the server inside the page chrome, so it is in
 * the HTML even without JavaScript. Never blank, never a crash page, nothing technical shown.
 */
export function ContentUnavailable() {
  return (
    <div className="t-band t-notfound" data-testid="content-unavailable">
      <div className="t-wrap">
        <h1>Kuch masla ho gaya.</h1>
        <p className="t-lead" style={{ marginInline: 'auto' }}>
          We could not load this page right now. Please try again in a minute.
        </p>
        <div className="t-row" style={{ justifyContent: 'center', marginTop: 24 }}>
          {/* A plain link to the same page: a fresh request, which re-reads the content. */}
          <a className="t-btn t-fill" href="">
            Try again
          </a>
        </div>
      </div>
    </div>
  );
}
