/**
 * Core of the public read path, free of framework imports so it can be unit-tested with fakes (NFR-08):
 *   1. ask the backend for the published document;
 *   2. on success, validate it and save it as the last-good copy;
 *   3. if the backend fails, times out or returns something malformed, use the last-good copy;
 *   4. if there is none either, throw `ContentUnavailableError` (pages then show the designed error state).
 * "Nothing published yet" is NOT a failure: the backend answered, so the last-good file (which may belong to
 * another environment) is not used and the pages show the error state.
 */

export class ContentUnavailableError extends Error {
  readonly reason: 'not_published' | 'unreachable';
  constructor(reason: 'not_published' | 'unreachable') {
    super(
      reason === 'not_published'
        ? 'No content release has been published yet.'
        : 'The content backend cannot be reached and there is no saved copy.',
    );
    this.name = 'ContentUnavailableError';
    this.reason = reason;
  }
}

export interface PublishedRead {
  document: unknown;
  /** True when the document came from the last-good file. */
  stale: boolean;
}

export interface ReadDeps {
  /** Resolves the document, null when nothing is published, rejects on any transport or backend error. */
  fetchDocument: () => Promise<unknown | null>;
  loadLastGood: () => Promise<unknown | null>;
  saveLastGood: (document: unknown) => Promise<void>;
  /** Throws when the document is not a usable content document. */
  validate: (document: unknown) => void;
  /** Structured, PII-free log hook. */
  log?: (event: string, fields?: Record<string, string | number | boolean>) => void;
}

export async function readPublished(deps: ReadDeps): Promise<PublishedRead> {
  let fetched: unknown | null = null;
  let usable = false;
  try {
    fetched = await deps.fetchDocument();
    if (fetched === null) throw new ContentUnavailableError('not_published');
    deps.validate(fetched);
    usable = true;
  } catch (error) {
    if (error instanceof ContentUnavailableError) throw error;
    deps.log?.('content_fetch_failed', { kind: error instanceof Error ? error.name : 'unknown' });
  }

  if (usable) {
    await deps.saveLastGood(fetched).catch(() => deps.log?.('content_last_good_write_failed'));
    return { document: fetched, stale: false };
  }

  const last = await deps.loadLastGood();
  if (last !== null) {
    try {
      deps.validate(last);
      deps.log?.('content_served_from_last_good');
      return { document: last, stale: true };
    } catch {
      deps.log?.('content_last_good_invalid');
    }
  }
  throw new ContentUnavailableError('unreachable');
}
