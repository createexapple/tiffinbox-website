/**
 * Display and form helpers for subscriptions and payments (whole PKR, NFR-09). Money and status rules (period
 * allocation, balances, paid / unpaid / overdue) live in SQL (`period_payment_status`, architecture sec. 9.2) and
 * are NOT calculated here: the app only displays what the database returns. What remains is arithmetic on values
 * already on screen (a list total, the form's suggested end date and amount).
 */
import { addDays, inclusiveDays } from './dates';
import type { Payment, PlanDraft, PlanTerm } from './types';

/** Non-voided payments only; voiding keeps the row but removes it from every total. */
export function activePayments<T extends Pick<Payment, 'voidedAt'>>(payments: readonly T[]): T[] {
  return payments.filter((p) => p.voidedAt === null);
}

export function sumAmounts(payments: readonly Pick<Payment, 'amount'>[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Proposed end date from the term (FR-26): weekly = 7 days, monthly = 4 weeks (Q-10 unresolved, editable). */
export function proposeEndDate(startDate: string, term: PlanTerm): string {
  return addDays(startDate, term === 'weekly' ? 6 : 27);
}

export interface DefaultAmountInput {
  plan: Pick<PlanDraft, 'weeklyPrice'>;
  term: PlanTerm;
  breakfastAddon: boolean;
  breakfastPerDay: number;
  startDate: string;
  endDate: string;
}

/**
 * Amount per period proposed from the plan's current price (FR-26). Weekly: the weekly price plus the
 * breakfast add-on for each day in range. Monthly: null, because the monthly rule is not confirmed
 * (Q-10) and the amount is typed by hand.
 */
export function defaultAmount(input: DefaultAmountInput): number | null {
  if (input.term === 'monthly') return null;
  if (input.plan.weeklyPrice === null) return null;
  const breakfast = input.breakfastAddon
    ? input.breakfastPerDay * inclusiveDays(input.startDate, input.endDate)
    : 0;
  return input.plan.weeklyPrice + breakfast;
}
