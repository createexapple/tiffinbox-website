import { describe, expect, it } from 'vitest';
import { ContentShapeError, mapPublicContent, splitIncludes } from '@/content/live';
import { publicContentDocument } from './fixtures/public-content';

describe('mapPublicContent (database document to the public content model)', () => {
  const snapshot = mapPublicContent(publicContentDocument(), { source: 'live' });

  it('marks the source as live and records the release version', () => {
    expect(snapshot.info.source).toBe('live');
    expect(snapshot.info.releaseVersion).toBe(3);
    expect(snapshot.info.stale).toBe(false);
  });

  it('maps settings, including the fields added for the public pages', () => {
    const s = snapshot.settings;
    expect(s.businessName).toBe('Tiffin Box');
    expect(s.areaServed).toBe('Johar Town, Lahore');
    expect(s.areaServedDetail).toBe('Johar Town, including hostels around UMT.');
    expect(s.deliveryBoundary).toBe('Between Canal Road and Raiwind Road');
    expect(s.legalNameAndAddress).toContain('Sample Foods');
    expect(s.paymentMethods).toEqual(['JazzCash', 'Easypaisa', 'bank transfer']);
    expect(s.maxSkipsPerWeek).toBe(3);
    expect(s.meals.lunch).toEqual({
      label: 'Lunch',
      deliveredBy: '13:00',
      skipCutoff: { time: '10:00', day: 'same_day' },
    });
    expect(s.meals.breakfast.skipCutoff.day).toBe('night_before');
  });

  it('maps plans: per_meal -> meal, per_day -> day, includes split, never unresolved', () => {
    expect(snapshot.plans.map((p) => p.priceUnit)).toEqual(['meal', 'day']);
    expect(snapshot.plans[0]?.includes).toEqual(['Lunch + dinner', 'Daal or sabzi + 2 roti']);
    expect(snapshot.plans[0]?.price).toEqual({ from: 300 });
    expect(snapshot.plans[1]?.mostPopular).toBe(true);
    expect(snapshot.plans.every((p) => p.priceUnresolved === false)).toBe(true);
  });

  it('maps the live menu: 7 days in order, "Not served", dates, current-week flag', () => {
    const menu = snapshot.menu;
    expect(menu?.weekStart).toBe('2026-11-23');
    expect(menu?.weekEnd).toBe('2026-11-29');
    expect(menu?.days.map((d) => d.day)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(menu?.days[0]?.lunch).toBe('lunch on day 1');
    expect(menu?.days[6]?.breakfast).toBe('Not served');
    expect(menu?.publishedAt).toBe('2026-11-22T13:00:00+00:00');
    expect(menu?.isCurrent).toBe(true);
  });

  it('keeps the "last updated" case: a past week is not current', () => {
    const doc = publicContentDocument();
    const menu = doc.menu as Record<string, unknown>;
    const old = mapPublicContent(
      { ...doc, menu: { ...menu, is_current_week: false } },
      { source: 'live' },
    );
    expect(old.menu?.isCurrent).toBe(false);
  });

  it('allows no menu yet (null)', () => {
    expect(
      mapPublicContent(publicContentDocument({ menu: null }), { source: 'live' }).menu,
    ).toBeNull();
  });

  it('marks stale and preview sources', () => {
    expect(
      mapPublicContent(publicContentDocument(), { source: 'live', stale: true }).info.stale,
    ).toBe(true);
    expect(mapPublicContent(publicContentDocument(), { source: 'preview' }).info.source).toBe(
      'preview',
    );
  });

  it('rejects malformed documents instead of rendering garbage', () => {
    expect(() => mapPublicContent(null, { source: 'live' })).toThrow(ContentShapeError);
    expect(() => mapPublicContent({}, { source: 'live' })).toThrow(ContentShapeError);
    expect(() =>
      mapPublicContent(publicContentDocument({ schema_version: 2 }), { source: 'live' }),
    ).toThrow(/schema_version/);
    expect(() =>
      mapPublicContent(publicContentDocument({ plans: 'x' }), { source: 'live' }),
    ).toThrow(ContentShapeError);
    const bad = publicContentDocument();
    (bad.plans as Record<string, unknown>[])[0]!.unit_price = null; // an unpriced plan must never be rendered
    expect(() => mapPublicContent(bad, { source: 'live' })).toThrow(/unit_price/);
  });
});

describe('splitIncludes', () => {
  it('splits on commas, semicolons and new lines, trims and capitalises', () => {
    expect(splitIncludes('lunch only, Mon-Sat; by 1 PM\nfresh roti')).toEqual([
      'Lunch only',
      'Mon-Sat',
      'By 1 PM',
      'Fresh roti',
    ]);
    expect(splitIncludes('')).toEqual([]);
  });
});
