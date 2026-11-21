/**
 * MOCK-ONLY status rules. At Stage 3 the real statuses are computed by the SQL views (`subscription_status`,
 * `period_payment_status`, `customer_summary`, `menu_week_status`; architecture sec. 9) and the app only displays
 * them. This module exists so the in-memory test mock can behave like the views; production code must not import it.
 * Unit-tested in tests/unit/admin-status.test.ts.
 */
import { addDays, daysBetween } from '../dates';
import type {
  ManualState,
  MenuSlot,
  MenuWeekStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '../types';

/** Architecture sec. 9.1, first match wins: paused, expired, upcoming, otherwise active. */
export function subscriptionStatus(
  sub: { manualState: ManualState; startDate: string; endDate: string },
  today: string,
): SubscriptionStatus {
  if (sub.manualState === 'paused') return 'paused';
  if (sub.endDate < today) return 'expired';
  if (sub.startDate > today) return 'upcoming';
  return 'active';
}

/** Renewal due: Active and the end date is within the renewal window (FR-27, default 7 days). */
export function isRenewalDue(
  status: SubscriptionStatus,
  endDate: string,
  today: string,
  renewalWindowDays: number,
): boolean {
  return status === 'active' && daysBetween(today, endDate) <= renewalWindowDays;
}

/** Architecture sec. 9.2: paid when covered, overdue once today is past due date + grace days, else unpaid. */
export function periodPaymentStatus(
  period: { amountDue: number; dueDate: string },
  paid: number,
  today: string,
  graceDays: number,
): PaymentStatus {
  if (paid >= period.amountDue) return 'paid';
  return today > addDays(period.dueDate, graceDays) ? 'overdue' : 'unpaid';
}

const PAYMENT_RANK: Record<PaymentStatus, number> = { paid: 0, unpaid: 1, overdue: 2 };

/** Customer-level payment status is the worst status among the customer's periods (sec. 9.2). */
export function worstPaymentStatus(statuses: readonly PaymentStatus[]): PaymentStatus | null {
  let worst: PaymentStatus | null = null;
  for (const status of statuses) {
    if (worst === null || PAYMENT_RANK[status] > PAYMENT_RANK[worst]) worst = status;
  }
  return worst;
}

const SUBSCRIPTION_RANK: Record<SubscriptionStatus, number> = {
  active: 0,
  paused: 1,
  upcoming: 2,
  expired: 3,
};

/** Picks the subscription to show on a customer row: active first, then paused, upcoming, expired; latest end wins ties. */
export function pickCurrentSubscription<T extends { status: SubscriptionStatus; endDate: string }>(
  subs: readonly T[],
): T | null {
  const sorted = [...subs].sort(
    (a, b) =>
      SUBSCRIPTION_RANK[a.status] - SUBSCRIPTION_RANK[b.status] ||
      b.endDate.localeCompare(a.endDate),
  );
  return sorted[0] ?? null;
}

/**
 * Architecture sec. 8.3 menu week status. Draft: no go-live time. Scheduled: go-live in the future.
 * Live: the released week with the latest go-live that is not in the future. Past: released and superseded.
 */
export function menuWeekStatus(
  week: { id: string; goLiveAt: string | null },
  allWeeks: readonly { id: string; goLiveAt: string | null }[],
  nowIso: string,
): MenuWeekStatus {
  if (week.goLiveAt === null) return 'draft';
  const now = Date.parse(nowIso);
  if (Date.parse(week.goLiveAt) > now) return 'scheduled';
  const released = allWeeks
    .filter((w) => w.goLiveAt !== null && Date.parse(w.goLiveAt) <= now)
    .sort((a, b) => Date.parse(b.goLiveAt ?? '') - Date.parse(a.goLiveAt ?? ''));
  return released[0]?.id === week.id ? 'live' : 'past';
}

export function slotsEqual(a: readonly MenuSlot[], b: readonly MenuSlot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((slot, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      slot.day === other.day &&
      slot.meal === other.meal &&
      slot.notServed === other.notServed &&
      slot.dishText.trim() === other.dishText.trim()
    );
  });
}
