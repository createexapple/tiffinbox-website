import { formatTime12h } from '@/lib/format';
import type { MealTiming, MenuWeek, Plan } from './types';

/**
 * "Meals from Rs X" (FR-05): the lowest per-meal price among plans priced per meal.
 * Plans priced per day (All 3 Meals) are not per-meal prices and are ignored. Returns null if there is none.
 */
export function lowestMealPrice(plans: readonly Plan[]): number | null {
  const prices = plans.filter((p) => p.priceUnit === 'meal').map((p) => p.price.from);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** "10 PM the night before" / "10 AM the same day". */
export function describeSkipCutoff(cutoff: MealTiming['skipCutoff']): string {
  const when = cutoff.day === 'night_before' ? 'the night before' : 'the same day';
  return `${formatTime12h(cutoff.time)} ${when}`;
}

/** FR-06: a menu is "current" when today (Karachi calendar date "YYYY-MM-DD") falls inside its week. */
export function isMenuCurrent(
  week: Pick<MenuWeek, 'weekStart' | 'weekEnd'>,
  todayKey: string,
): boolean {
  return week.weekStart <= todayKey && todayKey <= week.weekEnd;
}
