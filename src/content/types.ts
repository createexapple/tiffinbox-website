/**
 * Typed content model for the public site (architecture sec. 4, 5). Pages and components depend on
 * these types only. Stage 3 replaces the data source behind `index.ts` without changing them.
 * Money is whole PKR (NFR-09). Times are 24-hour "HH:mm" and formatted for display in src/lib/format.ts.
 */

export type MealKey = 'breakfast' | 'lunch' | 'dinner';

export interface MealTiming {
  label: string;
  /** Delivery time, 24-hour "HH:mm". */
  deliveredBy: string;
  /** Last time to ask for a skip. */
  skipCutoff: { time: string; day: 'night_before' | 'same_day' };
}

/** FR-20 site settings. Bracketed values such as "[WhatsApp number]" are placeholders (Q-04, Q-06, Q-11, Q-27). */
export interface SiteSettings {
  businessName: string;
  tagline: string;
  whatsappNumber: string;
  instagramHandle: string;
  orderHours: string;
  areaServed: string;
  areaServedDetail: string;
  deliveryBoundary: string;
  legalNameAndAddress: string;
  meals: Record<MealKey, MealTiming>;
  maxSkipsPerWeek: number;
  paymentMethods: string[];
}

export interface PriceSpec {
  from: number;
  /** Set only while the brief's range is unresolved (Q-08). */
  to?: number;
}

/** FR-07 plan. */
export interface Plan {
  id: string;
  name: string;
  audience: string;
  includes: string[];
  price: PriceSpec;
  priceUnit: 'meal' | 'day';
  weeklyPrice: number;
  mostPopular: boolean;
  /** True while the figure is ambiguous and needs one confirmed price from the client (Q-08). FR-07: must not go live like this. */
  priceUnresolved: boolean;
}

/** FR-16 pricing rules. */
export interface PricingRules {
  monthlySavingPercent: number;
  breakfastAddOnPerDay: number;
  teamDeal: { minPeople: number; text: string };
}

export interface MenuDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
}

/** FR-06: one published week. Dates are calendar dates "YYYY-MM-DD" in Asia/Karachi; `publishedAt` is an ISO instant. */
export interface MenuWeek {
  weekStart: string;
  weekEnd: string;
  publishedAt: string;
  days: MenuDay[];
  /**
   * Set by the live reader from the database (`is_current_week`): false when the newest released week is older
   * than this calendar week (FR-06 "last updated" case). Absent in mock content, where the page derives it.
   */
  isCurrent?: boolean;
}

export interface CustomDish {
  id: string;
  name: string;
  comesWith: string;
  price: number;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/** Where the content comes from, so pages can say so honestly. */
export interface ContentInfo {
  /** "mock": test-only sample content. "live": the published release. "preview": admin draft preview. */
  source: 'mock' | 'live' | 'preview';
  /** Shown in the banner when source is "mock". */
  note: string;
  /** Published release version when `source` is "live" or "preview" has none (null). */
  releaseVersion?: number | null;
  /** True when the document came from the last-good file because the backend could not be reached (NFR-08). */
  stale?: boolean;
}

/** Everything the content layer can hold, as one object. Used by the mock module and, later, the live source. */
export interface ContentSnapshot {
  info: ContentInfo;
  settings: SiteSettings;
  plans: Plan[];
  pricingRules: PricingRules;
  menu: MenuWeek | null;
  customDishes: CustomDish[];
  addOns: AddOn[];
  faq: FaqItem[];
}

/** Static page copy (A-16: developer-maintained in v1). Built from content data so no price or time is typed twice. */
export interface Benefit {
  title: string;
  text: string;
}
export interface Audience {
  title: string;
  problem: string;
  offer: string;
}
export interface Step {
  title: string;
  text: string;
}
export interface PageCopy {
  home: {
    eyebrow: string;
    headline: string;
    tagline: string;
    lede: string;
    benefitsEyebrow: string;
    benefitsHeadline: string;
    benefits: Benefit[];
    audienceEyebrow: string;
    audienceHeadline: string;
    audiences: Audience[];
    orderHeadline: string;
    orderLine: string;
  };
  steps: { eyebrow: string; headline: string; items: Step[] };
  menuIntro: string;
  planNote: string;
  plansLede: string;
  customizeIntro: string;
  about: { headline: string; mission: string; story: string };
  howItWorks: {
    headline: string;
    lede: string;
    weeklyMenuLine: string;
    skip: string;
    pause: string;
    packaging: string;
    paymentIntro: string;
    paymentPoints: { label: string; text: string }[];
  };
  priceDisclaimer: string;
  /** True while this copy is a draft awaiting client confirmation (Q-14, AS-05). */
  draft: boolean;
}
