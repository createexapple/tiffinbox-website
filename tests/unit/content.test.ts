import { describe, expect, it } from 'vitest';
import {
  getAddOns,
  getContentInfo,
  getCustomDishes,
  getFaq,
  getMealsFromPrice,
  getMenu,
  getPageCopy,
  getPlans,
  getPricingRules,
  getSiteSettings,
} from '@/content';
import { isPlaceholder } from '@/lib/whatsapp';

describe('content layer (mock source)', () => {
  it('labels itself as mock content', async () => {
    const info = await getContentInfo();
    expect(info.source).toBe('mock');
    expect(info.note).toMatch(/placeholders/i);
  });

  it('seeds the brief reference data', async () => {
    const plans = await getPlans();
    expect(plans.map((p) => p.name)).toEqual([
      'Starter',
      'Budget',
      'Student',
      'Office Lunch',
      'All 3 Meals',
    ]);
    expect(plans.filter((p) => p.mostPopular)).toHaveLength(1);
    expect(plans.map((p) => p.tag)).toEqual(['New', 'Cheapest', 'Most popular', '', '']);
    expect(plans.find((p) => p.name === 'Student')?.price).toEqual({ from: 750, to: 800 });
    expect(plans.find((p) => p.name === 'Starter')).toMatchObject({
      weeklyPrice: 4800,
      periodLabel: 'for 3 days',
    });
    expect(plans.every((p) => !p.priceUnresolved)).toBe(true);
    const rules = await getPricingRules();
    expect(rules.monthlySavingPercent).toBe(5);
    expect(rules.breakfastAddOnPerDay).toBe(550);
    expect(rules.deliveryCharge).toBe(150);
    expect(rules.lateNight).toEqual({ mealPrice: 650, surcharge: 100 });
    expect(rules.teamDeal.minPeople).toBe(10);
    expect(await getCustomDishes()).toHaveLength(6);
    expect(await getAddOns()).toHaveLength(6);
    expect(await getFaq()).toHaveLength(12);
  });

  it('has a full seven-day menu week', async () => {
    const menu = await getMenu();
    expect(menu?.days.map((d) => d.day)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('derives "Meals from" from the plans', async () => {
    expect(await getMealsFromPrice()).toBe(500);
  });

  it('keeps unknown facts as placeholders, never invented values', async () => {
    const settings = await getSiteSettings();
    expect(isPlaceholder(settings.whatsappNumber)).toBe(true);
    expect(isPlaceholder(settings.orderHours)).toBe(true);
    expect(isPlaceholder(settings.legalNameAndAddress)).toBe(true);
    expect(settings.instagramHandle).toBe('tiffinbox.lhr');
  });

  it('builds page copy from settings and prices instead of typing them', async () => {
    const copy = await getPageCopy();
    expect(`${copy.home.headline} ${copy.home.headlineAccent}`).toBe('Bhook lagi? Khana hazir.');
    expect(copy.home.tagline).toBe('Ghar ka khana, Ammi ke pyaar jaisa');
    expect(copy.home.benefits).toHaveLength(3);
    expect(copy.home.benefits[2]?.text).toBe(
      'Meals from Rs 500 with door-to-door delivery included. Save 5% when you pay monthly.',
    );
    expect(copy.home.benefits[0]?.text).toBe(
      'Lunch by 1 PM, dinner by 8 PM, late night 11 PM to 1 AM. Sealed tiffins keep it hot and clean.',
    );
    expect(copy.home.tags).toEqual(['Meals from Rs 500, delivered', 'Try 3 days for Rs 4,800']);
    expect(copy.steps.items[1]?.text).toBe(
      'Starter, weekly or monthly. Pay by JazzCash, Easypaisa or bank transfer.',
    );
    expect(copy.howItWorks.steps[1]?.text).toBe(
      'Starter, weekly or monthly. JazzCash, Easypaisa or bank transfer, before your days start.',
    );
    expect(copy.howItWorks.skip).toContain('Up to 3 skips a week');
    expect(copy.plansLede).toBe(
      'Meals start at Rs 500, including Rs 150 door-to-door delivery. Monthly plans save 5%. Prices are for one person.',
    );
  });

  it('has no Urdu text in the copy (the Urdu name is in the logo image only)', async () => {
    const copy = JSON.stringify(await getPageCopy());
    expect(copy).not.toMatch(/[؀-ۿ]/);
  });

  it('shows no question codes or draft notes anywhere in the page copy', async () => {
    const copy = JSON.stringify(await getPageCopy());
    expect(copy).not.toMatch(/\bQ-\d+/);
    expect(copy).not.toMatch(/draft copy|replace before launch/i);
  });
});
