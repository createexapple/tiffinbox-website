/**
 * Row <-> domain mapping for the Supabase-backed repository. Pure functions, no I/O, unit-tested
 * (tests/unit/admin-mappers.test.ts). This is where every contract difference between the Stage 2 front end and
 * the database lives (docs/database.md sec. 10):
 *   - menu day index: front end 0..6 (Monday = 0), database `day_of_week` 1..7 (Monday = 1)
 *   - menu status word: front end `live`, database `published`
 *   - phone: front end local "03XXXXXXXXX", database E.164 "+923XXXXXXXXX"
 *   - snake_case columns <-> camelCase fields
 * Statuses, balances and totals are taken from the database views exactly as given; nothing here recalculates them.
 */
import type {
  AddonDraft,
  Customer,
  CustomerRow,
  CustomerType,
  DishDraft,
  FaqDraft,
  ManualState,
  MealKey,
  MediaItem,
  MenuSlot,
  MenuWeekStatus,
  MenuWeekView,
  OpsSettings,
  PaymentMethod,
  PaymentRow,
  PaymentStatus,
  PeriodRow,
  PlanDraft,
  PlanTerm,
  PriceUnit,
  PricingRules,
  SiteSettingsDraft,
  SubscriptionRow,
  SubscriptionStatus,
} from '../types';

// ---------- Primitive conversions ----------

export const MEAL_ORDER: readonly MealKey[] = ['breakfast', 'lunch', 'dinner'];

/** Front end 0..6 -> database 1..7. */
export function dayToDb(day: number): number {
  return day + 1;
}
/** Database 1..7 -> front end 0..6. */
export function dayFromDb(day: number): number {
  return day - 1;
}

/** "03001234567" -> "+923001234567". Returns the input unchanged when it is not a local mobile number. */
export function phoneToDb(local: string): string {
  return /^03\d{9}$/.test(local) ? `+92${local.slice(1)}` : local;
}
/** "+923001234567" -> "03001234567"; null (anonymised customer) -> "". */
export function phoneFromDb(e164: string | null): string {
  if (e164 === null) return '';
  return /^\+923\d{9}$/.test(e164) ? `0${e164.slice(3)}` : e164;
}

export function menuStatusFromDb(status: string): MenuWeekStatus {
  switch (status) {
    case 'published':
      return 'live';
    case 'scheduled':
      return 'scheduled';
    case 'past':
      return 'past';
    default:
      return 'draft';
  }
}

// ---------- Database row shapes (only the columns we read) ----------

export interface CustomerDb {
  id: string;
  type: CustomerType;
  name: string;
  phone_e164: string | null;
  address_text: string;
  org_name: string;
  contact_person: string;
  member_count: number | null;
  notes: string;
  archived_at: string | null;
}

export interface SubscriptionStatusDb {
  id: string;
  customer_id: string;
  plan_id: string;
  plan_name: string;
  term: PlanTerm;
  start_date: string;
  end_date: string;
  breakfast_addon: boolean;
  amount_per_period: number;
  amount_note: string;
  manual_state: ManualState;
  manual_state_on: string | null;
  renewed_from_id: string | null;
  notes: string;
  status: SubscriptionStatus;
  days_to_end: number;
  renewal_due: boolean;
}

export interface PeriodStatusDb {
  period_id: string;
  subscription_id: string;
  customer_id: string;
  customer_name: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  due_date: string;
  paid: number;
  balance: number;
  status: PaymentStatus;
}

export interface PaymentDb {
  id: string;
  customer_id: string;
  subscription_id: string;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  covers_from: string;
  covers_to: string;
  reference: string;
  note: string;
  voided_at: string | null;
  void_reason: string;
  /** PostgREST embeds (`customers(name)`, `subscriptions(plan_name_snapshot)`). */
  customers?: { name: string } | null;
  subscriptions?: { plan_name_snapshot: string } | null;
}

export interface CustomerSummaryDb {
  customer_id: string;
  current_subscription_id: string | null;
  current_status: SubscriptionStatus | null;
  subscription_statuses: SubscriptionStatus[] | null;
  renewal_due: boolean;
  payment_status: PaymentStatus | null;
  balance: number;
}

// ---------- Customers, subscriptions, periods, payments ----------

export function mapCustomer(row: CustomerDb): Customer {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    phone: phoneFromDb(row.phone_e164),
    address: row.address_text,
    orgName: row.org_name,
    contactPerson: row.contact_person,
    memberCount: row.member_count,
    notes: row.notes,
    archivedAt: row.archived_at,
  };
}

export function mapSubscriptionRow(row: SubscriptionStatusDb): SubscriptionRow {
  return {
    id: row.id,
    customerId: row.customer_id,
    planId: row.plan_id,
    planName: row.plan_name,
    term: row.term,
    startDate: row.start_date,
    endDate: row.end_date,
    breakfastAddon: row.breakfast_addon,
    amountPerPeriod: row.amount_per_period,
    amountNote: row.amount_note,
    manualState: row.manual_state,
    manualStateOn: row.manual_state_on,
    renewedFromId: row.renewed_from_id,
    notes: row.notes,
    status: row.status,
    renewalDue: row.renewal_due,
    daysToEnd: row.days_to_end,
  };
}

export function mapPeriodRow(row: PeriodStatusDb): PeriodRow {
  return {
    id: row.period_id,
    subscriptionId: row.subscription_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    planName: row.plan_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amountDue: row.amount_due,
    dueDate: row.due_date,
    paid: row.paid,
    balance: row.balance,
    status: row.status,
  };
}

/** PostgREST select for payments with the customer name and plan name embedded. */
export const PAYMENT_SELECT = '*, customers(name), subscriptions(plan_name_snapshot)';

export function mapPaymentRow(row: PaymentDb): PaymentRow {
  return {
    id: row.id,
    customerId: row.customer_id,
    subscriptionId: row.subscription_id,
    amount: row.amount,
    method: row.method,
    paidOn: row.paid_on,
    coversFrom: row.covers_from,
    coversTo: row.covers_to,
    reference: row.reference,
    note: row.note,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    customerName: row.customers?.name ?? 'Unknown customer',
    planName: row.subscriptions?.plan_name_snapshot ?? '',
  };
}

/** A customer list row: the customer, its `customer_summary` view row, and its subscriptions from `subscription_status`. */
export function mapCustomerRow(
  customer: Customer,
  summary: CustomerSummaryDb | undefined,
  subscriptions: readonly SubscriptionRow[],
): CustomerRow {
  const current =
    (summary?.current_subscription_id
      ? subscriptions.find((s) => s.id === summary.current_subscription_id)
      : undefined) ?? null;
  return {
    customer,
    current,
    subscriptionStatuses: summary?.subscription_statuses ?? [],
    renewalDue: summary?.renewal_due ?? false,
    paymentStatus: summary?.payment_status ?? null,
  };
}

/** Free-text customer search: name, organisation, contact person, and phone digits (FR-25). Pure, server-side. */
export function matchesCustomerSearch(customer: Customer, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (q === '') return true;
  const text = [customer.name, customer.orgName, customer.contactPerson].some((t) =>
    t.toLowerCase().includes(q),
  );
  // Phone matching only applies when the search looks like a phone number, so "Home Sample 03" is a name search.
  const digits = /^[\d\s\-+()]+$/.test(q) ? q.replace(/\D/g, '') : '';
  const phone = digits.length > 0 && customer.phone !== '' && customer.phone.includes(digits);
  return text || phone;
}

// ---------- Site content ----------

export interface SiteSettingsDb {
  business_name: string;
  tagline: string;
  whatsapp_number: string;
  instagram_handle: string;
  order_hours: string;
  last_order_time: string;
  area_served: string;
  delivery_area_text: string;
  delivery_boundary_text: string;
  legal_name_and_address: string;
  delivery_times: Record<MealKey, string>;
  skip_cutoffs: Record<MealKey, string>;
  skips_per_week: number;
  payment_methods: string[];
}

export interface OpsSettingsDb {
  renewal_window_days: number;
  overdue_grace_days: number;
}

export function mapSiteSettings(row: SiteSettingsDb): SiteSettingsDraft {
  return {
    businessName: row.business_name,
    tagline: row.tagline,
    areaServed: row.area_served,
    deliveryBoundaryText: row.delivery_boundary_text,
    legalNameAndAddress: row.legal_name_and_address,
    paymentMethods: [...row.payment_methods],
    whatsappNumber: row.whatsapp_number,
    instagramHandle: row.instagram_handle,
    orderHours: row.order_hours,
    lastOrderTime: row.last_order_time,
    deliveryAreaText: row.delivery_area_text,
    deliveryTimes: { ...row.delivery_times },
    skipCutoffs: { ...row.skip_cutoffs },
    skipsPerWeek: row.skips_per_week,
  };
}

export function siteSettingsToDb(site: SiteSettingsDraft): Record<string, unknown> {
  return {
    business_name: site.businessName,
    tagline: site.tagline,
    area_served: site.areaServed,
    delivery_boundary_text: site.deliveryBoundaryText,
    legal_name_and_address: site.legalNameAndAddress,
    payment_methods: site.paymentMethods,
    whatsapp_number: site.whatsappNumber,
    instagram_handle: site.instagramHandle,
    order_hours: site.orderHours,
    last_order_time: site.lastOrderTime,
    delivery_area_text: site.deliveryAreaText,
    delivery_times: site.deliveryTimes,
    skip_cutoffs: site.skipCutoffs,
    skips_per_week: site.skipsPerWeek,
  };
}

export function mapOpsSettings(row: OpsSettingsDb): OpsSettings {
  return { renewalWindowDays: row.renewal_window_days, overdueGraceDays: row.overdue_grace_days };
}

export interface PricingRulesDb {
  monthly_saving_percent: number | string;
  breakfast_addon_price: number;
  team_deal_text: string;
  team_min_people: number;
}

export function mapPricingRules(row: PricingRulesDb): PricingRules {
  return {
    monthlySavingPercent: Number(row.monthly_saving_percent),
    breakfastAddonPrice: row.breakfast_addon_price,
    teamDealText: row.team_deal_text,
    teamMinPeople: row.team_min_people,
  };
}

export interface PlanDb {
  id: string;
  name: string;
  audience: string;
  meals_included: string;
  price_unit: PriceUnit;
  unit_price: number | null;
  weekly_price: number | null;
  monthly_price: number | null;
  is_most_popular: boolean;
  is_active: boolean;
  sort_order: number;
  price_note: string;
}

/** `derivedMonthly` is the value in the database's draft document (the DB computes it; null when unavailable). */
export function mapPlan(row: PlanDb, derivedMonthly: number | null): PlanDraft {
  return {
    id: row.id,
    name: row.name,
    audience: row.audience,
    mealsIncluded: row.meals_included,
    priceUnit: row.price_unit,
    unitPrice: row.unit_price,
    weeklyPrice: row.weekly_price,
    monthlyPrice: row.monthly_price ?? derivedMonthly,
    isMostPopular: row.is_most_popular,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    ...(row.price_note !== '' ? { priceNote: row.price_note } : {}),
  };
}

export interface DishDb {
  id: string;
  name: string;
  comes_with: string;
  price: number;
  media_id: string | null;
  sort_order: number;
  is_hidden: boolean;
}
export function mapDish(row: DishDb): DishDraft {
  return {
    id: row.id,
    name: row.name,
    comesWith: row.comes_with,
    price: row.price,
    mediaId: row.media_id,
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
  };
}

export interface AddonDb {
  id: string;
  name: string;
  price: number;
  sort_order: number;
  is_hidden: boolean;
}
export function mapAddon(row: AddonDb): AddonDraft {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
  };
}

export interface FaqDb {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_hidden: boolean;
}
export function mapFaq(row: FaqDb): FaqDraft {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
  };
}

export interface MediaDb {
  id: string;
  storage_path: string;
  file_name: string;
  alt_text: string;
  width: number;
  height: number;
  bytes: number;
}
export function mapMedia(row: MediaDb): MediaItem {
  return {
    id: row.id,
    fileName: row.file_name !== '' ? row.file_name : row.storage_path,
    altText: row.alt_text,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
  };
}

// ---------- Menu weeks ----------

export interface MenuSlotDb {
  menu_week_id?: string;
  day_of_week: number;
  meal: MealKey;
  dish_text: string;
  not_served: boolean;
  media_id?: string | null;
}

export interface MenuWeekDb {
  id: string;
  week_start: string;
  go_live_at: string | null;
  live_payload: { slots?: MenuSlotDb[] } | null;
}

export interface MenuWeekStatusDb {
  id: string;
  status: string;
  differs_from_released: boolean;
}

/** Exactly 21 slots in day-then-meal order; a slot that does not exist yet is an empty slot. */
export function buildSlots(rows: readonly MenuSlotDb[]): MenuSlot[] {
  const byKey = new Map(rows.map((r) => [`${r.day_of_week}/${r.meal}`, r]));
  const out: MenuSlot[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (const meal of MEAL_ORDER) {
      const row = byKey.get(`${dayToDb(day)}/${meal}`);
      out.push({
        day,
        meal,
        dishText: row?.not_served ? '' : (row?.dish_text ?? ''),
        notServed: row?.not_served ?? false,
      });
    }
  }
  return out;
}

export function mapMenuWeek(
  week: MenuWeekDb,
  slots: readonly MenuSlotDb[],
  status: MenuWeekStatusDb | undefined,
): MenuWeekView {
  return {
    id: week.id,
    weekStart: week.week_start,
    slots: buildSlots(slots),
    goLiveAt: week.go_live_at,
    releasedSlots: week.live_payload?.slots ? buildSlots(week.live_payload.slots) : null,
    status: status ? menuStatusFromDb(status.status) : 'draft',
    hasUnpublishedEdits: status?.differs_from_released ?? false,
  };
}

/** The 21 slots as `save_menu_week` wants them. `mediaBySlot` keeps a slot's photo, if it already has one. */
export function slotsToDb(
  slots: readonly MenuSlot[],
  mediaBySlot: ReadonlyMap<string, string | null>,
): {
  day_of_week: number;
  meal: MealKey;
  dish_text: string;
  not_served: boolean;
  media_id: string | null;
}[] {
  return slots.map((slot) => ({
    day_of_week: dayToDb(slot.day),
    meal: slot.meal,
    dish_text: slot.notServed ? '' : slot.dishText.trim(),
    not_served: slot.notServed,
    media_id: mediaBySlot.get(`${dayToDb(slot.day)}/${slot.meal}`) ?? null,
  }));
}
