/**
 * Admin domain types (architecture sec. 6 data model, in camelCase). Money is whole PKR (NFR-09).
 * Dates are "YYYY-MM-DD" Karachi calendar days; instants are ISO strings with offset.
 * Screens depend on these types and on `AdminRepository` only, so Stage 3 can swap the data source.
 */

// ---------- Website content (draft working copy, visible to visitors only after publish) ----------

export type PriceUnit = 'per_meal' | 'per_day';

/** FR-16 */
export interface PlanDraft {
  id: string;
  name: string;
  audience: string;
  mealsIncluded: string;
  priceUnit: PriceUnit;
  unitPrice: number | null;
  weeklyPrice: number | null;
  /**
   * Monthly price as the database computes it (stored override, else weekly price x 4 less the saving %, or
   * the calendar-month rule, Q-10). Read-only proposal shown before publishing; null when the plan is inactive
   * or has no weekly price. Never calculated in the browser.
   */
  monthlyPrice?: number | null;
  isMostPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  /** Optional hint shown under the price (for example an unresolved client question). */
  priceNote?: string;
}

/** FR-16 pricing rules */
export interface PricingRules {
  monthlySavingPercent: number;
  breakfastAddonPrice: number;
  teamDealText: string;
  teamMinPeople: number;
}

/** FR-17 */
export interface DishDraft {
  id: string;
  name: string;
  comesWith: string;
  price: number;
  mediaId: string | null;
  sortOrder: number;
  isHidden: boolean;
}

/** FR-18 */
export interface AddonDraft {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
  isHidden: boolean;
}

/** FR-19 */
export interface FaqDraft {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isHidden: boolean;
}

export type MealKey = 'breakfast' | 'lunch' | 'dinner';

/** FR-20. Empty strings mean "not set yet" (client has not supplied it). */
export interface SiteSettingsDraft {
  businessName: string;
  tagline: string;
  /** Short place name used in headings, for example "Johar Town, Lahore". */
  areaServed: string;
  /** Exact delivery boundary wording (Q-11). */
  deliveryBoundaryText: string;
  /** Business legal name and address shown in the footer (Q-27). */
  legalNameAndAddress: string;
  /** Payment methods named on the site, in display order. */
  paymentMethods: string[];
  whatsappNumber: string;
  instagramHandle: string;
  orderHours: string;
  /** Last time to order for next-day delivery, "HH:mm" or "". */
  lastOrderTime: string;
  deliveryAreaText: string;
  deliveryTimes: Record<MealKey, string>;
  skipCutoffs: Record<MealKey, string>;
  skipsPerWeek: number;
}

/** FR-27 / FR-29 settings. Saved immediately, never published (architecture sec. 6.2). */
export interface OpsSettings {
  renewalWindowDays: number;
  overdueGraceDays: number;
}

/** FR-21 */
export interface MediaItem {
  id: string;
  fileName: string;
  altText: string;
  width: number;
  height: number;
  bytes: number;
}

export type PageImageSlot = 'home_hero' | 'og_share';

/** Everything that is published as one release (architecture sec. 8.1). */
export interface ContentSnapshot {
  settings: SiteSettingsDraft;
  pricingRules: PricingRules;
  plans: PlanDraft[];
  dishes: DishDraft[];
  addons: AddonDraft[];
  faq: FaqDraft[];
}

// ---------- Menu weeks (FR-14, FR-15) ----------

export interface MenuSlot {
  /** 0 = Monday .. 6 = Sunday */
  day: number;
  meal: MealKey;
  dishText: string;
  notServed: boolean;
}

export type MenuWeekStatus = 'draft' | 'scheduled' | 'live' | 'past';

export interface MenuWeek {
  id: string;
  /** Monday */
  weekStart: string;
  slots: MenuSlot[];
  /** ISO instant; null while draft. */
  goLiveAt: string | null;
  /** The 21 slots as released or scheduled; null for a draft that was never scheduled. */
  releasedSlots: MenuSlot[] | null;
}

/** A menu week plus its derived status (a stand-in for the SQL rule in architecture sec. 8.3). */
export interface MenuWeekView extends MenuWeek {
  status: MenuWeekStatus;
  /** Working slots differ from the live or scheduled copy. */
  hasUnpublishedEdits: boolean;
}

// ---------- Publishing (FR-22) ----------

export type ContentArea =
  'Menu' | 'Plans' | 'Pricing rules' | 'Dishes' | 'Add-ons' | 'FAQ' | 'Settings' | 'Images';

export interface PendingChange {
  area: ContentArea;
  summary: string;
  /** Public page that shows this change when previewed. */
  previewHref: '/' | '/menu' | '/plans' | '/customize' | '/about';
}

export interface PublishCheckItem {
  ok: boolean;
  label: string;
  /** Why it is blocked and where to fix it. */
  fix?: string;
  fixHref?: string;
  fixLabel?: string;
}

export interface Release {
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string;
  isLive: boolean;
}

export interface PublishOverview {
  pending: PendingChange[];
  checks: PublishCheckItem[];
  canPublish: boolean;
  releases: Release[];
  liveVersion: number;
  /** Menu draft that is neither scheduled nor live (does not need publishing, shown for information). */
  unscheduledDraftWeeks: string[];
  scheduledWeeks: { weekStart: string; goLiveAt: string }[];
}

export interface PublishResult {
  version: number;
  publishedAt: string;
  /**
   * Whether the public site was confirmed to serve this version right after the cache refresh (architecture
   * sec. 8.1 step 4). False means the release is saved and live, but the cached pages may take up to a minute.
   * Undefined for the mock.
   */
  visibleOnSite?: boolean;
}

// ---------- Customers, subscriptions, payments (FR-24..FR-30) ----------

export type CustomerType = 'student' | 'office' | 'home';

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  /** Normalised local mobile number, digits only: "03000000001". */
  phone: string;
  address: string;
  orgName: string;
  contactPerson: string;
  memberCount: number | null;
  notes: string;
  archivedAt: string | null;
}

export type PlanTerm = 'weekly' | 'monthly';
export type ManualState = 'active' | 'paused';
export type SubscriptionStatus = 'active' | 'paused' | 'expired' | 'upcoming';
export type PaymentStatus = 'paid' | 'unpaid' | 'overdue';
export type PaymentMethod = 'jazzcash' | 'easypaisa' | 'bank_transfer';

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  /** Plan name copied at creation so later renames do not change history. */
  planName: string;
  term: PlanTerm;
  startDate: string;
  endDate: string;
  breakfastAddon: boolean;
  /** Copied from the plan at creation (A-20); never recalculated when plan prices change. */
  amountPerPeriod: number;
  amountNote: string;
  manualState: ManualState;
  manualStateOn: string | null;
  renewedFromId: string | null;
  notes: string;
}

export interface Period {
  id: string;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  amountDue: number;
  dueDate: string;
}

export interface Payment {
  id: string;
  customerId: string;
  subscriptionId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  coversFrom: string;
  coversTo: string;
  reference: string;
  note: string;
  voidedAt: string | null;
  voidReason: string;
}

/**
 * Read models. At Stage 3 these come from the SQL views `subscription_status` and
 * `period_payment_status` (architecture sec. 9); the UI only displays the status values.
 */
export interface SubscriptionRow extends Subscription {
  status: SubscriptionStatus;
  renewalDue: boolean;
  daysToEnd: number;
}

export interface PeriodRow extends Period {
  customerId: string;
  customerName: string;
  planName: string;
  paid: number;
  balance: number;
  status: PaymentStatus;
}

export interface PaymentRow extends Payment {
  customerName: string;
  planName: string;
}

export interface CustomerRow {
  customer: Customer;
  /** The most relevant subscription (active first), or null if the customer has none. */
  current: SubscriptionRow | null;
  /** All statuses present on the customer's subscriptions, for filtering. */
  subscriptionStatuses: SubscriptionStatus[];
  renewalDue: boolean;
  /** Worst payment status over the customer's periods, or null when there are no periods. */
  paymentStatus: PaymentStatus | null;
}

export interface CustomerFilter {
  /** Free text over name, phone and organisation. Never put in a URL (NFR-12). */
  search?: string;
  type?: CustomerType;
  subscription?: SubscriptionStatus | 'renewal_due';
  payment?: PaymentStatus;
  includeArchived?: boolean;
}

export interface CustomerDetail {
  customer: Customer;
  subscriptions: SubscriptionRow[];
  periods: PeriodRow[];
  payments: PaymentRow[];
  paymentStatus: PaymentStatus | null;
  /** Total unpaid balance across periods (Rs). */
  balance: number;
}

export interface PaymentFilter {
  /** Dues list: undefined = unpaid and overdue (open dues), "all" = every period. */
  status?: PaymentStatus | 'all';
  method?: PaymentMethod;
  from?: string;
  to?: string;
}

export interface Overview {
  today: string;
  activeSubscribers: number;
  /** Team members of active office customers, shown separately (architecture sec. 9.3). */
  officeMembers: number;
  unpaid: { count: number; total: number };
  overdue: { count: number; total: number };
  renewalDue: number;
  renewalWindowDays: number;
  totalCustomers: number;
  pendingChanges: number;
  scheduledMenu: { weekStart: string; goLiveAt: string } | null;
  liveMenuWeekStart: string | null;
  liveVersion: number;
  liveVersionPublishedAt: string;
  pendingAreas: string[];
}

// ---------- Change history (FR-23) ----------

export type RecordType =
  | 'Content publish'
  | 'Menu'
  | 'Plans'
  | 'Pricing rules'
  | 'Dishes'
  | 'Add-ons'
  | 'FAQ'
  | 'Settings'
  | 'Images'
  | 'Customer'
  | 'Subscription'
  | 'Payment';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  recordType: RecordType;
  summary: string;
  /** Before and after, rendered as "old -> new". */
  diff?: { from: string; to: string };
  /** Previous values kept when a payment is edited or voided (FR-23 AC 2). */
  earlierValues?: string;
}

export interface AuditFilter {
  recordType?: RecordType;
  from?: string;
  to?: string;
}
