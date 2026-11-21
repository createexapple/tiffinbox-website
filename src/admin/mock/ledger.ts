/**
 * MOCK-ONLY money maths: lets the in-memory test mock behave like the SQL view `period_payment_status`
 * (architecture sec. 9.2). Production code must not import it; the database computes these values.
 */
import type { Period } from '../types';

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

/** "4 x weekly price, less the saving %" for the A-04 monthly price check (AS-09). Whole rupees. */
export function monthlyPriceCheck(weeklyPrice: number, savingPercent: number): number {
  return Math.round((weeklyPrice * 4 * (100 - savingPercent)) / 100);
}
