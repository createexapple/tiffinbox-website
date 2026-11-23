/**
 * Inputs for the two order widgets, built from content data (never typed). Pure; unit-tested.
 */
import { formatRs } from '@/lib/format';
import { perPersonPrice, type WhoInput } from '@/lib/order-math';
import { examplePlan, midPrice } from './copy';
import type { AddOn, CustomDish, Plan } from './types';

/** Dish and add-on the design preselects; the first dish / no add-on is used when they are not in the data. */
const DEFAULT_DISH = 'Chicken qorma';
const DEFAULT_ADD_ON = 'Raita';
const GUEST_DISH = 'Chicken biryani';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Inputs of the "Who's eating?" calculator, or null when the data cannot support it (no per-meal plan, or delivery not below the price). */
export function whoEatingInput(
  plans: readonly Plan[],
  dishes: readonly CustomDish[],
  delivery: number,
): WhoInput | null {
  const plan = examplePlan(plans);
  if (!plan) return null;
  const mealPrice = midPrice(plan);
  if (mealPrice - delivery <= 0) return null;
  const guest =
    dishes.find((d) => same(d.name, GUEST_DISH)) ??
    [...dishes].sort((a, b) => b.price - a.price)[0] ??
    null;
  return {
    planName: plan.name,
    mealPrice,
    delivery,
    periodPrice: plan.weeklyPrice,
    period: plan.periodLabel !== '' ? plan.periodLabel.replace(/^for\s+/i, '') : 'week',
    guestDish: guest ? { name: guest.name, price: guest.price } : null,
    cheapestDish: dishes.length > 0 ? Math.min(...dishes.map((d) => d.price)) : null,
  };
}

/** Starting selection of the Customize builder: Chicken qorma else the first dish; Raita on when it exists. */
export function builderDefaults(
  dishes: readonly CustomDish[],
  addOns: readonly AddOn[],
): { dishId: string | null; addOnIds: string[] } {
  const dish = dishes.find((d) => same(d.name, DEFAULT_DISH)) ?? dishes[0];
  const addOn = addOns.find((a) => same(a.name, DEFAULT_ADD_ON));
  return { dishId: dish?.id ?? null, addOnIds: addOn ? [addOn.id] : [] };
}

/** Note under the calculator: which plan the example uses and its meal and delivery parts. */
export function whoNote(input: WhoInput): string {
  const parts = [`${formatRs(perPersonPrice(input))} meal`];
  if (input.delivery > 0) parts.push(`${formatRs(input.delivery)} delivery`);
  return `Example uses the ${input.planName} plan (${parts.join(' + ')}). Prices depend on supplier rates; we confirm your price on WhatsApp before you pay.`;
}
