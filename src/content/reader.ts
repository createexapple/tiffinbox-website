/**
 * Public content reader (architecture sec. 5, 8; ADR-0003). The ONLY code path from public pages to the backend.
 *
 * Published content is read with the public (anon) role through `get_public_content()`, cached by the Next.js
 * data cache under one tag and a 60 second lifetime (NFR-06: a publish is visible within a minute; a publish also
 * expires the tag at once). A failed read falls back to the last-good file (NFR-08).
 *
 * Draft preview (admin only, FR-22): when Next draft mode is on AND the visitor is a signed-in active admin, the
 * draft document is read with that admin's own session instead. The draft-mode cookie alone gives nothing: the
 * database refuses `get_draft_content()` to anyone else.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { cookies, draftMode } from 'next/headers';
import { connection } from 'next/server';
import { cache } from 'react';
import { getAdmin } from '@/lib/auth/session';
import { getSupabaseConfig, isMockBackend } from '@/lib/env';
import { createAnonClient, createSessionClient } from '@/lib/supabase/server';
import { loadLastGood, saveLastGood } from './last-good';
import { ContentShapeError, mapPublicContent } from './live';
import { MOCK_CONTENT } from './mock';
import { ContentUnavailableError, readPublished, type PublishedRead } from './read-published';
import type { ContentSnapshot } from './types';

export { ContentUnavailableError } from './read-published';

/** Cache tag expired by publish, rollback, menu release and POST /api/revalidate. */
export const PUBLIC_CONTENT_TAG = 'public-content';
/** Cookie holding the menu week chosen for a draft preview (a uuid; validated before use). */
export const PREVIEW_WEEK_COOKIE = 'tb_preview_week';
const REVALIDATE_SECONDS = 60;
const FETCH_TIMEOUT_MS = 3000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(document: unknown): void {
  mapPublicContent(document, { source: 'live' }); // throws ContentShapeError when unusable
}

async function fetchPublishedDocument(): Promise<unknown | null> {
  if (!getSupabaseConfig()) throw new Error('Backend is not configured.');
  const supabase = createAnonClient({ timeoutMs: FETCH_TIMEOUT_MS });
  const { data, error } = await supabase.rpc('get_public_content');
  if (error) throw new Error(`get_public_content failed (${error.code ?? 'no code'})`);
  return data ?? null;
}

const readPublishedCached = unstable_cache(
  async (): Promise<PublishedRead> =>
    readPublished({
      fetchDocument: fetchPublishedDocument,
      loadLastGood,
      saveLastGood,
      validate,
      log: (event, fields) => console.warn(JSON.stringify({ event, ...fields })),
    }),
  ['public-content-v1'],
  { tags: [PUBLIC_CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
);

/** The published document (cached) as raw JSON plus whether it is a stale last-good copy. */
export async function readPublishedContent(): Promise<PublishedRead> {
  return readPublishedCached();
}

async function readDraftSnapshot(): Promise<ContentSnapshot | null> {
  const mode = await draftMode();
  if (!mode.isEnabled) return null;
  if (!(await getAdmin())) return null; // cookie without an admin session: show the published site
  const store = await cookies();
  const week = store.get(PREVIEW_WEEK_COOKIE)?.value;
  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc('get_draft_content', {
    menu_week_id: week && UUID.test(week) ? week : null,
  });
  if (error || !data) return null;
  return mapPublicContent(data, { source: 'preview' });
}

/**
 * Everything the public pages render from. Deduplicated per request. Throws `ContentUnavailableError` when
 * nothing can be shown (the segment's error boundary renders the designed error state).
 */
export const getContentSnapshot = cache(async (): Promise<ContentSnapshot> => {
  // Test-only sample content needs no request (and unit tests run outside one).
  if (isMockBackend()) return MOCK_CONTENT;
  // Render at request time, never at build (also covers the root not-found page): the build carries no content.
  await connection();
  const preview = await readDraftSnapshot().catch(() => null);
  if (preview) return preview;
  try {
    const { document, stale } = await readPublishedContent();
    return mapPublicContent(document, { source: 'live', stale });
  } catch (error) {
    if (error instanceof ContentUnavailableError || error instanceof ContentShapeError) throw error;
    throw new ContentUnavailableError('unreachable');
  }
});
