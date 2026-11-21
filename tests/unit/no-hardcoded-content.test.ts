import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard for the Stage 2 rule "no prices, menu items or contact details hardcoded in components":
 * pages and components may only show content that comes through src/content.
 */
const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', join('src', 'components')];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const sources = SCAN_DIRS.flatMap((dir) => files(join(ROOT, dir))).map((path) => ({
  file: relative(ROOT, path),
  text: readFileSync(path, 'utf8'),
}));

describe('pages and components carry no hardcoded business data', () => {
  it('scans a non-trivial number of files', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it.each([
    ['rupee prices', /\bRs\.?\s?\d/],
    ['wa.me links', /wa\.me\//],
    ['the Instagram handle', /tiffinbox\.lhr/],
    ['phone numbers', /\+?92[\s-]?3\d{2}/],
    ['Urdu script', /[؀-ۿ]/],
  ])('has no %s', (_label, pattern) => {
    const offenders = sources.filter((s) => pattern.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('imports content only through the content layer, never the mock module', () => {
    const offenders = sources.filter((s) => /content\/mock/.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});
