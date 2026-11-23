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

/** FR-20 site settings. Bracketed values such as "[WhatsApp number]" are placeholders for facts the client has not supplied. */
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
  /** Upper end of a per-meal price range (Student: Rs 750 to 800). Absent for a single price. */
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
  /** Total for the plan's period: a week, unless `periodLabel` says otherwise (Starter: "for 3 days"). */
  weeklyPrice: number;
  mostPopular: boolean;
  /** Badge text such as "New" or "Cheapest" (CR-004). Falls back to "Most popular" for the most popular plan; '' = no badge. */
  tag: string;
  /** What `weeklyPrice` covers when it is not a week, e.g. "for 3 days". '' means "a week". */
  periodLabel: string;
  /** Always false for published content (publishing refuses an unpriced plan). Kept for the mock and older callers. */
  priceUnresolved: boolean;
}

/** FR-16 pricing rules. */
export interface PricingRules {
  monthlySavingPercent: number;
  breakfastAddOnPerDay: number;
  teamDeal: { minPeople: number; text: string };
  /** Door-to-door delivery per order (CR-004). 0 when the published document predates the field. */
  deliveryCharge: number;
  /** Late-night meal (CR-004): meal price and late-night surcharge. Null when the document predates the field. */
  lateNight: { mealPrice: number; surcharge: number } | null;
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

/** A published photo (FR-21). `path` is the object path inside the public media bucket. */
export interface PublicImage {
  path: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** Photos assigned to fixed places on the site. Null while no photo is assigned (pages show the placeholder). */
export interface PageImages {
  homeHero: PublicImage | null;
  ogShare: PublicImage | null;
  menuHeader: PublicImage | null;
  aboutMain: PublicImage | null;
  logo: PublicImage | null;
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
  pageImages: PageImages;
}

/** Static page copy (A-16: developer-maintained in v1). Built from content data so no price or time is typed twice. */
export interface Benefit {
  title: string;
  text: string;
}
export interface Audience {
  title: string;
  text: string;
  /** The late-night card is dark. */
  dark?: boolean;
}
export interface Step {
  title: string;
  text: string;
}
/** One row of the How it works delivery table. */
export interface DeliveryRow {
  key: string;
  meal: string;
  deliveredBy: string;
  skipBefore: string;
  charge: string;
}
/** A card in the Plans page add-on strip. `dark` is the late-night card (moon icon, full width, price line). */
export interface AddOnCard {
  key: 'late-night' | 'breakfast' | 'team' | 'monthly';
  title: string;
  text: string;
  dark?: boolean;
  /** Price line of the late-night card ("Rs 900 a night"). */
  price?: string;
}
export interface PageCopy {
  home: {
    eyebrow: string;
    /** "Bhook lagi?" and, on its own line in brown, "Khana hazir.". */
    headline: string;
    headlineAccent: string;
    tagline: string;
    lede: string;
    /** Gold tags under the lede ("Meals from Rs 500, delivered", "Try 3 days for Rs 4,800"); the first is filled, the rest outlined. */
    tags: string[];
    benefitsEyebrow: string;
    benefitsHeadline: string;
    benefits: Benefit[];
    audienceEyebrow: string;
    audienceHeadline: string;
    audiences: Audience[];
    orderHeadline: string;
    orderLine: string;
  };
  steps: { eyebrow: string; headline: string; items: Step[]; linkText: string };
  menu: {
    eyebrow: string;
    intro: string;
    /** Under the day cards; '' when there is nothing to say. */
    note: string;
    customizeLink: string;
  };
  plansLede: string;
  planAddOns: AddOnCard[];
  /** Shown under the plans when the "Who's eating?" calculator cannot be built from the data. */
  priceDisclaimer: string;
  customizeIntro: string;
  customizeLateNight: string | null;
  about: {
    headline: string;
    mission: string;
    whereWeDeliver: string;
    contactLateNight: string | null;
  };
  howItWorks: {
    headline: string;
    steps: Step[];
    deliveryRows: DeliveryRow[];
    skip: string;
    pause: string;
    packaging: string;
    payment: string;
  };
}
