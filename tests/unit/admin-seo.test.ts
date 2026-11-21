import { afterEach, describe, expect, it } from 'vitest';
import robots from '../../app/robots';
import sitemap from '../../app/sitemap';

const original = process.env.SITE_ALLOW_INDEXING;
afterEach(() => {
  if (original === undefined) delete process.env.SITE_ALLOW_INDEXING;
  else process.env.SITE_ALLOW_INDEXING = original;
});

describe('admin is kept out of search (NFR-07)', () => {
  it('robots disallows /admin even when indexing of the public site is allowed', () => {
    process.env.SITE_ALLOW_INDEXING = 'true';
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule?.disallow).toContain('/admin');
  });
  it('robots blocks everything when indexing is not allowed', () => {
    delete process.env.SITE_ALLOW_INDEXING;
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule?.disallow).toBe('/');
  });
  it('the sitemap has no admin URL', () => {
    expect(sitemap().filter((e) => e.url.includes('/admin'))).toEqual([]);
  });
});
