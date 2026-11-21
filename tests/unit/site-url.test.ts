import { describe, expect, it } from 'vitest';
import { getSiteUrl, isIndexingAllowed, isSiteUrlConfigured } from '@/lib/site-url';
import { buildFoodEstablishmentJsonLd } from '@/lib/structured-data';
import { MOCK_CONTENT } from '@/content/mock';

describe('getSiteUrl', () => {
  it('falls back to localhost when SITE_URL is unset, empty or invalid', () => {
    expect(getSiteUrl({})).toBe('http://localhost:3000');
    expect(getSiteUrl({ SITE_URL: '  ' })).toBe('http://localhost:3000');
    expect(getSiteUrl({ SITE_URL: 'not a url' })).toBe('http://localhost:3000');
    expect(getSiteUrl({ SITE_URL: 'javascript:alert(1)' })).toBe('http://localhost:3000');
  });
  it('uses the origin of a valid SITE_URL without trailing slash or path', () => {
    expect(getSiteUrl({ SITE_URL: 'https://example.test/' })).toBe('https://example.test');
    expect(getSiteUrl({ SITE_URL: 'https://example.test/some/path' })).toBe('https://example.test');
  });
  it('reports whether a URL was configured', () => {
    expect(isSiteUrlConfigured({})).toBe(false);
    expect(isSiteUrlConfigured({ SITE_URL: 'https://example.test' })).toBe(true);
  });
});

describe('isIndexingAllowed', () => {
  it('is off unless explicitly "true"', () => {
    expect(isIndexingAllowed({})).toBe(false);
    expect(isIndexingAllowed({ SITE_ALLOW_INDEXING: '1' })).toBe(false);
    expect(isIndexingAllowed({ SITE_ALLOW_INDEXING: 'true' })).toBe(true);
  });
});

describe('structured data (NFR-04: confirmed facts only)', () => {
  it('omits telephone and url while they are unconfirmed', () => {
    const data = buildFoodEstablishmentJsonLd(MOCK_CONTENT.settings, null);
    expect(data['@type']).toBe('FoodEstablishment');
    expect(data).not.toHaveProperty('telephone');
    expect(data).not.toHaveProperty('url');
    expect(data).not.toHaveProperty('openingHours');
    expect(JSON.stringify(data)).not.toContain('[WhatsApp');
  });
  it('adds telephone and url once real values exist', () => {
    const data = buildFoodEstablishmentJsonLd(
      { ...MOCK_CONTENT.settings, whatsappNumber: '+92 300 1234567' },
      'https://example.test',
    );
    expect(data.telephone).toBe('+923001234567');
    expect(data.url).toBe('https://example.test');
  });
});
