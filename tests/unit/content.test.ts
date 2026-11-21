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
    expect(plans.map((p) => p.name)).toEqual(['Budget', 'Student', 'Office Lunch', 'All 3 Meals']);
    expect(plans.filter((p) => p.mostPopular)).toHaveLength(1);
    expect(plans.find((p) => p.name === 'Student')?.priceUnresolved).toBe(true);
    const rules = await getPricingRules();
    expect(rules.monthlySavingPercent).toBe(5);
    expect(rules.breakfastAddOnPerDay).toBe(350);
    expect(rules.teamDeal.minPeople).toBe(10);
    expect(await getCustomDishes()).toHaveLength(6);
    expect(await getAddOns()).toHaveLength(6);
    expect((await getFaq()).length).toBeGreaterThan(0);
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
    expect(await getMealsFromPrice()).toBe(300);
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
    expect(copy.home.headline).toBe('Bhook lagi? Khana hazir.');
    expect(copy.home.tagline).toBe('Ghar ka khana, Ammi ke pyaar jaisa');
    expect(copy.home.benefits).toHaveLength(3);
    expect(copy.home.benefits[2]?.text).toContain('Meals from Rs 300');
    expect(copy.home.benefits[0]?.text).toContain('Lunch by 1 PM, dinner by 8 PM');
    expect(copy.steps.items[1]?.text).toContain('JazzCash, Easypaisa or bank transfer');
    expect(copy.howItWorks.skip).toContain('Up to 3 skips a week');
    expect(copy.plansLede).toContain('Meals start at Rs 300');
  });

  it('does not type the Urdu brand name anywhere in the copy', async () => {
    const copy = JSON.stringify(await getPageCopy());
    expect(copy).not.toMatch(/[؀-ۿ]/);
  });
});
