/**
 * Last-good copy of the published content document (NFR-08, architecture sec. 5, ADR-0003 point 5). Written
 * after every successful read; read only when the backend cannot be reached. Plain JSON on the host's disk,
 * written atomically (temp file + rename) so a crash never leaves a half-written file. The file holds public
 * content only (the same document visitors see).
 */
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getLastGoodPath } from '@/lib/env';

interface Stored {
  savedAt: string;
  document: unknown;
}

export async function saveLastGood(
  document: unknown,
  file: string = getLastGoodPath(),
): Promise<void> {
  const body: Stored = { savedAt: new Date().toISOString(), document };
  const temp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(body), 'utf8');
  await fs.rename(temp, file);
}

/** The stored document, or null when there is none or it cannot be parsed. */
export async function loadLastGood(file: string = getLastGoodPath()): Promise<unknown | null> {
  try {
    const text = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(text) as Partial<Stored>;
    return parsed && typeof parsed === 'object' && 'document' in parsed
      ? (parsed.document ?? null)
      : null;
  } catch {
    return null;
  }
}
