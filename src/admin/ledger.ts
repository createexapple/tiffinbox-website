/**
 * Money maths for subscriptions and payments (whole PKR, NFR-09).
 *
 * STAGE 2 STAND-IN: at Stage 3 these rules live in SQL (`period_payment_status` view, architecture
 * sec. 9.2 and the "money and status rules live in SQL" rule in sec. 4) and are tested with pgTAP.
 * The UI only displays the results. This module exists so the mock repository can behave like the
 * views and so the rules are unit-tested now.
 */
import { addDays, inclusiveDays } from './dates';
import type { Payment, Period, PlanDraft, PlanTerm } from './types';

/** Non-voided payments only; voiding keeps the row but removes it from every total. */
export function activePayments<T extends Pick<Payment, 'voidedAt'>>(payments: readonly T[]): T[] {
  return payments.filter((p) => p.voidedAt === null);
}

export function sumAmounts(payments: readonly Pick<Payment, 'amount'>[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Applies a subscription's total payments to its periods, oldest period first (architecture sec. 9.2).
 * Part payments leave a balance; one payment can cover several periods. Money beyond the total due is
 * returned as `credit` (not lost, not assigned to a period).
 */
export function allocatePayments(
  periods: readonly Pick<Period, 'id' | 'periodStart' | 'amountDue'>[],
  totalPaid: number,
): { paidByPeriod: Map<string, number>; credit: number } {
  const ordered = [...periods].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const paidByPeriod = new Map<string, number>();
  let remaining = Math.max(0, totalPaid);
  for (const period of ordered) {
    const applied = Math.min(remaining, period.amountDue);
    paidByPeriod.set(period.id, applied);
    remaining -= applied;
  }
  return { paidByPeriod, credit: remaining };
}

export function balanceOf(amountDue: number, paid: number): number {
  return Math.max(0, amountDue - paid);
}

/** Proposed end date from the term (FR-26): weekly = 7 days, monthly = 4 weeks (Q-10 unresolved, editable). */
export function proposeEndDate(startDate: string, term: PlanTerm): string {
  return addDays(startDate, term === 'weekly' ? 6 : 27);
}

/** "4 x weekly price, less the saving %" for the A-04 monthly price check (AS-09). Whole rupees. */
export function monthlyPriceCheck(weeklyPrice: number, savingPercent: number): number {
  return Math.round((weeklyPrice * 4 * (100 - savingPercent)) / 100);
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
