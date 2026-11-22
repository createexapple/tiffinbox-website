/**
 * Public content read path (architecture sec. 5). Pages read ONLY through these functions.
 *
 * Stage 3: `getContentSnapshot()` (./reader) reads the published release through `get_public_content()`, cached
 * with a tag and a 60 s lifetime, with a last-good file fallback. Under the test-only mock flag it serves the
 * labelled sample content in ./mock instead. If nothing can be shown it throws `ContentUnavailableError`, which
 * the public error boundary renders as the designed error state.
 */
import { buildPageCopy } from './copy';
import { lowestMealPrice } from './derive';
import { getContentSnapshot } from './reader';
import type {
  AddOn,
  ContentInfo,
  CustomDish,
  FaqItem,
  PageImages,
  MenuWeek,
  PageCopy,
  Plan,
  PricingRules,
  SiteSettings,
} from './types';

export type * from './types';

export { ContentUnavailableError } from './reader';
export { ContentShapeError } from './live';

/** Where the content comes from ("live", "preview", or "mock" under the test flag); drives the banners. */
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
export async function getPageImages(): Promise<PageImages> {
  return (await getContentSnapshot()).pageImages;
}

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
