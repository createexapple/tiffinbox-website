/**
 * Public content read path (architecture sec. 5). Pages read ONLY through these functions.
 *
 * Today every function returns the labelled mock snapshot from ./mock. In Stage 3, `getContentSnapshot()`
 * becomes the Supabase-backed reader (`get_public_content`, last-good file fallback) and nothing else changes.
 * Each function is async so callers already handle a real network read.
 */
import { buildPageCopy } from './copy';
import { lowestMealPrice } from './derive';
import { MOCK_CONTENT } from './mock';
import type {
  AddOn,
  ContentInfo,
  ContentSnapshot,
  CustomDish,
  FaqItem,
  MenuWeek,
  PageCopy,
  Plan,
  PricingRules,
  SiteSettings,
} from './types';

export type * from './types';

async function getContentSnapshot(): Promise<ContentSnapshot> {
  return MOCK_CONTENT; // Stage 3: replace with the live reader.
}

/** Where the content comes from ("mock" until Stage 3); drives the Stage 2 preview banner. */
export async function getContentInfo(): Promise<ContentInfo> {
  return (await getContentSnapshot()).info;
}

/** FR-20 settings: WhatsApp number, Instagram handle, order hours, area, delivery times and skip cut-offs. */
export async function getSiteSettings(): Promise<SiteSettings> {
  return (await getContentSnapshot()).settings;
}

/** FR-07 plans in display order. */
export async function getPlans(): Promise<Plan[]> {
  return (await getContentSnapshot()).plans;
}

/** FR-16 pricing rules: monthly saving, breakfast add-on, team deal. */
export async function getPricingRules(): Promise<PricingRules> {
  return (await getContentSnapshot()).pricingRules;
}

/** FR-06 published menu week, or null when none has ever been published. */
export async function getMenu(): Promise<MenuWeek | null> {
  return (await getContentSnapshot()).menu;
}

/** FR-08 custom dishes in display order. */
export async function getCustomDishes(): Promise<CustomDish[]> {
  return (await getContentSnapshot()).customDishes;
}

/** FR-08 add-ons in display order. */
export async function getAddOns(): Promise<AddOn[]> {
  return (await getContentSnapshot()).addOns;
}

/** FR-11 FAQ entries in admin-defined order. */
export async function getFaq(): Promise<FaqItem[]> {
  return (await getContentSnapshot()).faq;
}

/** FR-05 "Meals from Rs X": derived from the lowest per-meal plan price, never typed. */
export async function getMealsFromPrice(): Promise<number | null> {
  return lowestMealPrice((await getContentSnapshot()).plans);
}

/** Static page copy, filled in from settings, pricing rules and plans. */
export async function getPageCopy(): Promise<PageCopy> {
  const { settings, pricingRules, plans } = await getContentSnapshot();
  return buildPageCopy({
    settings,
    rules: pricingRules,
    mealsFrom: lowestMealPrice(plans),
  });
}
