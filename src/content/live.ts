/**
 * Maps the database's public content document (`get_public_content()` / `get_draft_content()`, shape in
 * docs/database.md sec. 5.2 and docs/api/openapi.yaml `PublicContent`) to the typed content model that the public
 * pages use. Pure: no I/O, no framework imports, unit-tested (tests/unit/content-live.test.ts).
 *
 * The document is untrusted input (it crossed the network or came from disk), so every field is checked; a
 * malformed document throws `ContentShapeError` and the reader falls back to the last good copy.
 */
import type {
  AddOn,
  ContentInfo,
  ContentSnapshot,
  CustomDish,
  FaqItem,
  MealKey,
  MealTiming,
  MenuDay,
  MenuWeek,
  PageImages,
  Plan,
  PricingRules,
  PublicImage,
  SiteSettings,
} from './types';

export class ContentShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentShapeError';
  }
}

type Json = Record<string, unknown>;

function obj(value: unknown, where: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContentShapeError(`${where} must be an object`);
  }
  return value as Json;
}
function arr(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new ContentShapeError(`${where} must be an array`);
  return value;
}
function str(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new ContentShapeError(`${where} must be a string`);
  return value;
}
function int(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ContentShapeError(`${where} must be a whole number`);
  }
  return value;
}
function num(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContentShapeError(`${where} must be a number`);
  }
  return value;
}

/** Optional text: a missing or non-string value is '' (fields added after the first published releases). */
function optStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
/** Optional whole number: a missing or invalid value is undefined (never throws). */
function optInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** Badge text for plans whose published document has no tag. */
export const MOST_POPULAR_TAG = 'Most popular';

const MEALS: readonly MealKey[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};
const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

function addDaysIso(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new ContentShapeError('week_start must be YYYY-MM-DD');
  const t = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** "Lunch + dinner, full weekly menu" becomes ["Lunch + dinner", "Full weekly menu"] (commas, semicolons, new lines). */
export function splitIncludes(mealsIncluded: string): string[] {
  return mealsIncluded
    .split(/[;\n,]/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
}

function mapSettings(raw: unknown): SiteSettings {
  const s = obj(raw, 'settings');
  const times = obj(s.delivery_times, 'settings.delivery_times');
  const cutoffs = obj(s.skip_cutoffs, 'settings.skip_cutoffs');
  const cutoffDays = obj(s.skip_cutoff_days, 'settings.skip_cutoff_days');
  const meals = {} as Record<MealKey, MealTiming>;
  for (const meal of MEALS) {
    const day = str(cutoffDays[meal], `skip_cutoff_days.${meal}`);
    meals[meal] = {
      label: MEAL_LABEL[meal],
      deliveredBy: str(times[meal], `delivery_times.${meal}`),
      skipCutoff: {
        time: str(cutoffs[meal], `skip_cutoffs.${meal}`),
        day: day === 'night_before' ? 'night_before' : 'same_day',
      },
    };
  }
  return {
    businessName: str(s.business_name, 'settings.business_name'),
    tagline: str(s.tagline, 'settings.tagline'),
    whatsappNumber: str(s.whatsapp_number, 'settings.whatsapp_number'),
    instagramHandle: str(s.instagram_handle, 'settings.instagram_handle'),
    orderHours: str(s.order_hours, 'settings.order_hours'),
    areaServed: str(s.area_served, 'settings.area_served'),
    areaServedDetail: str(s.delivery_area_text, 'settings.delivery_area_text'),
    deliveryBoundary: str(s.delivery_boundary_text, 'settings.delivery_boundary_text'),
    legalNameAndAddress: str(s.legal_name_and_address, 'settings.legal_name_and_address'),
    meals,
    maxSkipsPerWeek: int(s.skips_per_week, 'settings.skips_per_week'),
    paymentMethods: arr(s.payment_methods, 'settings.payment_methods').map((m, i) =>
      str(m, `settings.payment_methods[${i}]`),
    ),
  };
}

function mapPlans(raw: unknown): Plan[] {
  return arr(raw, 'plans').map((item, i) => {
    const p = obj(item, `plans[${i}]`);
    const unit = str(p.price_unit, `plans[${i}].price_unit`);
    const unitPrice = int(p.unit_price, `plans[${i}].unit_price`);
    // CR-004 fields are optional: an older published document has none of them.
    const to = optInt(p.unit_price_to);
    const mostPopular = p.is_most_popular === true;
    const tag = optStr(p.tag).trim();
    return {
      id: str(p.id, `plans[${i}].id`),
      name: str(p.name, `plans[${i}].name`),
      audience: str(p.audience, `plans[${i}].audience`),
      includes: splitIncludes(str(p.meals_included, `plans[${i}].meals_included`)),
      price: to !== undefined && to > unitPrice ? { from: unitPrice, to } : { from: unitPrice },
      priceUnit: unit === 'per_day' ? 'day' : 'meal',
      weeklyPrice: int(p.weekly_price, `plans[${i}].weekly_price`),
      mostPopular,
      tag: tag !== '' ? tag : mostPopular ? MOST_POPULAR_TAG : '',
      periodLabel: optStr(p.period_label).trim(),
      // Publishing refuses an active plan without prices, so a released plan is never unresolved.
      priceUnresolved: false,
    };
  });
}

function lateNight(r: Json): PricingRules['lateNight'] {
  const mealPrice = optInt(r.late_night_meal_price);
  const surcharge = optInt(r.late_night_surcharge);
  if (mealPrice === undefined || surcharge === undefined || mealPrice < 0 || surcharge < 0)
    return null;
  return { mealPrice, surcharge };
}

function mapPricingRules(raw: unknown): PricingRules {
  const r = obj(raw, 'pricing_rules');
  return {
    monthlySavingPercent: num(r.monthly_saving_percent, 'pricing_rules.monthly_saving_percent'),
    breakfastAddOnPerDay: int(r.breakfast_addon_price, 'pricing_rules.breakfast_addon_price'),
    teamDeal: {
      minPeople: int(r.team_min_people, 'pricing_rules.team_min_people'),
      text: str(r.team_deal_text, 'pricing_rules.team_deal_text'),
    },
    // CR-004 fields are optional: an older published document has none of them.
    deliveryCharge: Math.max(0, optInt(r.delivery_charge) ?? 0),
    lateNight: lateNight(r),
  };
}

function mapMenu(raw: unknown, publishedFallback: string): MenuWeek | null {
  if (raw === null || raw === undefined) return null;
  const m = obj(raw, 'menu');
  const weekStart = str(m.week_start, 'menu.week_start');
  const byKey = new Map<string, string>();
  for (const item of arr(m.slots, 'menu.slots')) {
    const slot = obj(item, 'menu.slots[]');
    const day = int(slot.day_of_week, 'slot.day_of_week');
    const meal = str(slot.meal, 'slot.meal');
    const text = slot.not_served === true ? 'Not served' : str(slot.dish_text, 'slot.dish_text');
    byKey.set(`${day}/${meal}`, text);
  }
  const days: MenuDay[] = DAY_NAMES.map((name, index) => ({
    day: name,
    breakfast: byKey.get(`${index + 1}/breakfast`) ?? '',
    lunch: byKey.get(`${index + 1}/lunch`) ?? '',
    dinner: byKey.get(`${index + 1}/dinner`) ?? '',
  }));
  const wentLive = typeof m.went_live_at === 'string' ? m.went_live_at : publishedFallback;
  return {
    weekStart,
    weekEnd: addDaysIso(weekStart, 6),
    publishedAt: wentLive,
    days,
    isCurrent: m.is_current_week === true,
  };
}

/** One published image, or null when the slot is empty or the value is not a usable image. Never throws. */
function mapImage(raw: unknown): PublicImage | null {
  if (raw === null || typeof raw !== 'object') return null;
  const image = raw as Record<string, unknown>;
  // Object paths are generated by the upload pipeline; anything else is ignored rather than rendered.
  if (typeof image.path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/.test(image.path)) {
    return null;
  }
  if (image.path.includes('..')) return null;
  const size = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
  return {
    path: image.path,
    alt: typeof image.alt === 'string' ? image.alt : '',
    width: size(image.width),
    height: size(image.height),
  };
}

function mapPageImages(raw: unknown): PageImages {
  const slots = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    homeHero: mapImage(slots.home_hero),
    ogShare: mapImage(slots.og_share),
    menuHeader: mapImage(slots.menu_header),
    aboutMain: mapImage(slots.about_main),
    logo: mapImage(slots.logo),
  };
}

export interface MapOptions {
  source: 'live' | 'preview';
  stale?: boolean;
}

/** Throws `ContentShapeError` when the document is not the expected version or shape. */
export function mapPublicContent(document: unknown, options: MapOptions): ContentSnapshot {
  const doc = obj(document, 'document');
  if (doc.schema_version !== 1) {
    throw new ContentShapeError(`unsupported schema_version ${String(doc.schema_version)}`);
  }
  const release = obj(doc.release, 'release');
  const publishedAt = typeof release.published_at === 'string' ? release.published_at : '';
  const info: ContentInfo = {
    source: options.source,
    note: '',
    releaseVersion: typeof release.version === 'number' ? release.version : null,
    stale: options.stale === true,
  };
  return {
    info,
    settings: mapSettings(doc.settings),
    plans: mapPlans(doc.plans),
    pricingRules: mapPricingRules(doc.pricing_rules),
    menu: mapMenu(doc.menu, publishedAt),
    customDishes: arr(doc.dishes, 'dishes').map((item, i): CustomDish => {
      const d = obj(item, `dishes[${i}]`);
      return {
        id: str(d.id, 'dish.id'),
        name: str(d.name, 'dish.name'),
        comesWith: str(d.comes_with, 'dish.comes_with'),
        price: int(d.price, 'dish.price'),
      };
    }),
    addOns: arr(doc.addons, 'addons').map((item, i): AddOn => {
      const a = obj(item, `addons[${i}]`);
      return {
        id: str(a.id, 'addon.id'),
        name: str(a.name, 'addon.name'),
        price: int(a.price, 'addon.price'),
      };
    }),
    faq: arr(doc.faq, 'faq').map((item, i): FaqItem => {
      const f = obj(item, `faq[${i}]`);
      return {
        id: str(f.id, 'faq.id'),
        question: str(f.question, 'faq.question'),
        answer: str(f.answer, 'faq.answer'),
      };
    }),
    pageImages: mapPageImages(doc.page_images),
  };
}
