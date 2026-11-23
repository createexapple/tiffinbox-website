import { describe, expect, it } from 'vitest';
import sitemap from '../../app/sitemap';
import nextConfig from '../../next.config';
import { PUBLIC_PAGES } from '@/lib/seo';

describe('the public site is one page', () => {
  it('has six sections in navigation order, each linked by a hash anchor', () => {
    expect(PUBLIC_PAGES.map((p) => p.id)).toEqual([
      'home',
      'menu',
      'plans',
      'customize',
      'how',
      'about',
    ]);
    expect(PUBLIC_PAGES.map((p) => p.href)).toEqual([
      '/#home',
      '/#menu',
      '/#plans',
      '/#customize',
      '/#how',
      '/#about',
    ]);
    expect(PUBLIC_PAGES.map((p) => p.label)).toEqual([
      'Home',
      'Menu',
      'Plans & Pricing',
      'Customize',
      'How it works',
      'About & Contact',
    ]);
  });

  it('lists only the home URL in the sitemap', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    expect(new URL(entries[0]!.url).pathname).toBe('/');
  });

  it('redirects the five old page routes permanently to their section', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects.map((r) => [r.source, r.destination, r.permanent])).toEqual([
      ['/menu', '/#menu', true],
      ['/plans', '/#plans', true],
      ['/customize', '/#customize', true],
      ['/how-it-works', '/#how', true],
      ['/about', '/#about', true],
    ]);
  });
});
