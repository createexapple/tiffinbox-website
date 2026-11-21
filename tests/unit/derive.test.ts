import { describe, expect, it } from 'vitest';
import { describeSkipCutoff, isMenuCurrent, lowestMealPrice } from '@/content/derive';
import { MOCK_CONTENT } from '@/content/mock';
import type { Plan } from '@/content';

const plan = (over: Partial<Plan>): Plan => ({
  id: 'p',
  name: 'P',
  audience: 'a',
  includes: [],
  price: { from: 500 },
  priceUnit: 'meal',
  weeklyPrice: 7000,
  mostPopular: false,
  priceUnresolved: false,
  ...over,
});

describe('lowestMealPrice (FR-05 "Meals from Rs X")', () => {
  it('is the lowest per-meal price in the seeded plans', () => {
    expect(lowestMealPrice(MOCK_CONTENT.plans)).toBe(300);
  });
  it('follows a price change with no code change', () => {
    const plans = [plan({ price: { from: 450 } }), plan({ id: 'q', price: { from: 520 } })];
    expect(lowestMealPrice(plans)).toBe(450);
  });
  it('ignores per-day plans, which are not per-meal prices', () => {
    const plans = [
      plan({ price: { from: 1500 }, priceUnit: 'day' }),
      plan({ price: { from: 550 } }),
    ];
    expect(lowestMealPrice(plans)).toBe(550);
  });
  it('uses the lower bound of a range', () => {
    expect(lowestMealPrice([plan({ price: { from: 550, to: 600 } })])).toBe(550);
  });
  it('is null when there is no per-meal plan', () => {
    expect(lowestMealPrice([])).toBeNull();
    expect(lowestMealPrice([plan({ priceUnit: 'day' })])).toBeNull();
  });
});

describe('describeSkipCutoff', () => {
  it('describes the brief cut-offs', () => {
    const { meals } = MOCK_CONTENT.settings;
    expect(describeSkipCutoff(meals.breakfast.skipCutoff)).toBe('10 PM the night before');
    expect(describeSkipCutoff(meals.lunch.skipCutoff)).toBe('10 AM the same day');
    expect(describeSkipCutoff(meals.dinner.skipCutoff)).toBe('5 PM the same day');
  });
});

describe('isMenuCurrent (FR-06 fallback)', () => {
  const week = { weekStart: '2026-11-23', weekEnd: '2026-11-29' };
  it('is current from the first to the last day of the week', () => {
    expect(isMenuCurrent(week, '2026-11-23')).toBe(true);
    expect(isMenuCurrent(week, '2026-11-29')).toBe(true);
  });
  it('is not current before or after the week', () => {
    expect(isMenuCurrent(week, '2026-11-22')).toBe(false);
    expect(isMenuCurrent(week, '2026-11-30')).toBe(false);
  });
});
