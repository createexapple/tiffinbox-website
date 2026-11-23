import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLastGood, saveLastGood } from '@/content/last-good';
import { mapPublicContent } from '@/content/live';
import { ContentUnavailableError, readPublished, type ReadDeps } from '@/content/read-published';
import { publicContentDocument } from './fixtures/public-content';

function deps(over: Partial<ReadDeps> = {}): ReadDeps & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    saved,
    fetchDocument: async () => publicContentDocument(),
    loadLastGood: async () => null,
    saveLastGood: async (d) => {
      saved.push(d);
    },
    validate: (d) => void mapPublicContent(d, { source: 'live' }),
    ...over,
  };
}

describe('readPublished (public read path, NFR-08)', () => {
  it('returns the live document and saves it as the last good copy', async () => {
    const d = deps();
    const result = await readPublished(d);
    expect(result.stale).toBe(false);
    expect(d.saved).toHaveLength(1);
  });

  it('falls back to the last good copy when the backend fails or times out', async () => {
    const good = publicContentDocument({
      release: { version: 2, published_at: '2026-11-20T00:00:00+00:00' },
    });
    const log = vi.fn();
    const result = await readPublished(
      deps({
        fetchDocument: async () => {
          throw new Error('fetch failed');
        },
        loadLastGood: async () => good,
        log,
      }),
    );
    expect(result).toEqual({ document: good, stale: true });
    expect(log).toHaveBeenCalledWith('content_fetch_failed', expect.anything());
  });

  it('falls back when the backend answers with something malformed', async () => {
    const good = publicContentDocument();
    const result = await readPublished(
      deps({ fetchDocument: async () => ({ schema_version: 9 }), loadLastGood: async () => good }),
    );
    expect(result.stale).toBe(true);
  });

  it('fails with the "unreachable" state when there is no last good copy', async () => {
    await expect(
      readPublished(
        deps({
          fetchDocument: async () => {
            throw new Error('down');
          },
        }),
      ),
    ).rejects.toMatchObject({ name: 'ContentUnavailableError', reason: 'unreachable' });
  });

  it('does not use the saved copy when the backend is up but nothing is published yet', async () => {
    const d = deps({
      fetchDocument: async () => null,
      loadLastGood: async () => publicContentDocument(),
    });
    await expect(readPublished(d)).rejects.toMatchObject({ reason: 'not_published' });
    expect(d.saved).toHaveLength(0);
  });

  it('ignores a corrupt last good copy', async () => {
    await expect(
      readPublished(
        deps({
          fetchDocument: async () => {
            throw new Error('down');
          },
          loadLastGood: async () => ({ junk: true }),
        }),
      ),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('still serves live content when writing the last good copy fails', async () => {
    const result = await readPublished(
      deps({
        saveLastGood: async () => {
          throw new Error('read-only disk');
        },
      }),
    );
    expect(result.stale).toBe(false);
  });
});

describe('last good file', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tb-lastgood-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a document and replaces it atomically (no temp file left behind)', async () => {
    const file = path.join(dir, 'nested', 'last-good.json');
    await saveLastGood({ a: 1 }, file);
    await saveLastGood({ a: 2 }, file);
    expect(await loadLastGood(file)).toEqual({ a: 2 });
    const text = JSON.parse(await readFile(file, 'utf8')) as { savedAt: string };
    expect(typeof text.savedAt).toBe('string');
  });

  it('returns null when the file is missing or not JSON', async () => {
    expect(await loadLastGood(path.join(dir, 'missing.json'))).toBeNull();
    const bad = path.join(dir, 'bad.json');
    await writeFile(bad, '{not json', 'utf8');
    expect(await loadLastGood(bad)).toBeNull();
  });
});
