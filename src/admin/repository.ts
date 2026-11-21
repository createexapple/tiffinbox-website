/**
 * The only way admin screens read and write data. Every method is async.
 *
 * Stage 3: implemented by `ActionsAdminRepository` (./actions-repository), which calls the Supabase-backed
 * server actions in ./server (architecture sec. 4, grouped by area). The in-memory mock in ./mock implements the
 * same interface and is used ONLY by network-free unit and e2e tests (explicit test flag, see src/lib/env.ts).
 */
import type {
  AddonDraft,
  AuditEntry,
  AuditFilter,
  Customer,
  CustomerDetail,
  CustomerFilter,
  CustomerRow,
  DishDraft,
  FaqDraft,
  MediaItem,
  MenuSlot,
  MenuWeekView,
  OpsSettings,
  Overview,
  PaymentRow,
  PaymentFilter,
  PeriodRow,
  PlanDraft,
  PricingRules,
  PublishOverview,
  PublishResult,
  SiteSettingsDraft,
  SubscriptionRow,
} from './types';
import type { SubscriptionValue, PaymentValue } from './validation/operations';

export type RepoErrorCode =
  | 'load_failed'
  | 'publish_failed'
  | 'save_failed'
  | 'blocked'
  | 'not_found'
  | 'invalid'
  /** The database refused: the account is not an active admin (PT403 / RLS). */
  | 'forbidden'
  /** The session is gone or timed out; the client sends the admin to the login page. */
  | 'unauthenticated'
  /** Too many sign-in attempts. */
  | 'throttled';

/** Server-side failure to show to the admin (every form shows server errors, not only client ones). */
export class RepoError extends Error {
  readonly code: RepoErrorCode;
  /** Field-level messages when the database rejected specific fields (PT400), keyed by the database field name. */
  readonly fields?: Record<string, string>;
  constructor(code: RepoErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'RepoError';
    this.code = code;
    if (fields) this.fields = fields;
  }
}

export interface OrderedCollection<Row extends { id: string }, Values> {
  list(): Promise<Row[]>;
  /** `id` null creates. Returns the saved row. */
  save(id: string | null, values: Values): Promise<Row>;
  remove(id: string): Promise<void>;
  move(id: string, direction: 'up' | 'down'): Promise<{ position: number; total: number }>;
}

export type DishValues = Pick<DishDraft, 'name' | 'comesWith' | 'price' | 'isHidden'> & {
  mediaId: string | null;
};
export type AddonValues = Pick<AddonDraft, 'name' | 'price' | 'isHidden'>;
export type FaqValues = Pick<FaqDraft, 'question' | 'answer' | 'isHidden'>;

export interface MediaRow extends MediaItem {
  usedOn: string[];
  /** Public URL of the stored photo (absent in the test mock). */
  url?: string;
}

export interface PlanValues {
  name: string;
  audience: string;
  mealsIncluded: string;
  unitPrice: number;
  weeklyPrice: number;
  sortOrder: number;
  isActive: boolean;
}

export interface CustomerValues {
  type: Customer['type'];
  name: string;
  phone: string;
  address: string;
  orgName: string;
  contactPerson: string;
  memberCount: number | null;
  notes: string;
}

export interface AdminRepository {
  /** Today's date in Asia/Karachi. The mock returns a fixed sample date. */
  getToday(): Promise<string>;
  /** Current instant (ISO). The mock returns its own clock so sample statuses stay deterministic. */
  getNow(): Promise<string>;
  /** The signed-in admin (the mock returns a fixed sample account). */
  getSession(): Promise<{ displayName: string; email: string }>;
  /** FR-13. Rejects with `RepoError` code "invalid" (wrong credentials, generic) or "throttled". */
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** FR-13: needs the current password. Rejects with "invalid" and `fields` (current / next) on bad input. */
  changePassword(current: string, next: string, repeat: string): Promise<void>;

  // ---- Website content (drafts) ----
  getSettings(): Promise<{ site: SiteSettingsDraft; ops: OpsSettings }>;
  saveSettings(site: SiteSettingsDraft, ops: OpsSettings): Promise<void>;
  listPlans(): Promise<PlanDraft[]>;
  savePlans(
    values: { id: string; values: PlanValues }[],
    mostPopularId: string | null,
  ): Promise<void>;
  getPricingRules(): Promise<PricingRules>;
  savePricingRules(rules: Omit<PricingRules, 'teamMinPeople'>): Promise<void>;
  dishes: OrderedCollection<DishDraft, DishValues>;
  addons: OrderedCollection<AddonDraft, AddonValues>;
  faq: OrderedCollection<FaqDraft, FaqValues>;
  listMedia(): Promise<MediaRow[]>;
  /** The server checks type, size and content again, strips metadata, and stores a sanitised master. */
  uploadMedia(file: File, altText: string): Promise<MediaRow>;
  deleteMedia(id: string): Promise<void>;

  // ---- Menu weeks ----
  listMenuWeeks(): Promise<MenuWeekView[]>;
  /** Saves the 21 working slots of a week; creates the week if it does not exist. */
  saveMenuWeek(weekStart: string, slots: MenuSlot[]): Promise<MenuWeekView>;
  copyMenuWeek(fromWeekStart: string, toWeekStart: string): Promise<MenuWeekView>;
  scheduleMenuWeek(weekStart: string, goLiveAt: string): Promise<MenuWeekView>;
  cancelMenuSchedule(weekStart: string): Promise<MenuWeekView>;
  publishMenuNow(weekStart: string): Promise<MenuWeekView>;

  // ---- Preview and publish ----
  getPublishOverview(): Promise<PublishOverview>;
  publish(): Promise<PublishResult>;
  rollback(version: number): Promise<void>;

  // ---- Change history ----
  listAudit(filter: AuditFilter): Promise<AuditEntry[]>;

  // ---- Customers, subscriptions, payments ----
  getOverview(): Promise<Overview>;
  listCustomers(filter: CustomerFilter): Promise<CustomerRow[]>;
  getCustomerDetail(id: string): Promise<CustomerDetail>;
  createCustomer(values: CustomerValues): Promise<Customer>;
  updateCustomer(id: string, values: CustomerValues): Promise<Customer>;
  archiveCustomer(id: string): Promise<void>;
  restoreCustomer(id: string): Promise<void>;
  findDuplicatePhone(phone: string, excludeCustomerId?: string): Promise<Customer | null>;

  getSubscription(id: string): Promise<SubscriptionRow>;
  createSubscription(
    customerId: string,
    value: SubscriptionValue,
    renewedFromId?: string,
  ): Promise<SubscriptionRow>;
  updateSubscription(id: string, value: SubscriptionValue): Promise<SubscriptionRow>;
  findOverlap(
    customerId: string,
    startDate: string,
    endDate: string,
    excludeSubscriptionId?: string,
  ): Promise<SubscriptionRow | null>;

  listDues(filter: Pick<PaymentFilter, 'status' | 'from' | 'to'>): Promise<PeriodRow[]>;
  listPayments(filter: Pick<PaymentFilter, 'method' | 'from' | 'to'>): Promise<PaymentRow[]>;
  getPayment(id: string): Promise<PaymentRow>;
  createPayment(customerId: string, value: PaymentValue): Promise<PaymentRow>;
  updatePayment(id: string, value: PaymentValue): Promise<PaymentRow>;
  voidPayment(id: string, reason: string): Promise<PaymentRow>;
  findDuplicateReference(
    method: PaymentValue['method'],
    reference: string,
    excludePaymentId?: string,
  ): Promise<PaymentRow | null>;
}
