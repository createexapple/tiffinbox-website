/**
 * Pure math and message text for the two order widgets (Plans "Who's eating?" and the Customize builder) and the
 * plan buttons. No React, no I/O: unit-tested in tests/unit/order-math.test.ts. Money is whole PKR.
 * Messages contain only numbers and choices made from the lists on the page, never text typed by a visitor.
 */
import { formatRs } from './format';

export const MIN_GROUP_PEOPLE = 2;
export const MAX_GROUP_PEOPLE = 10;
export const DEFAULT_GROUP_PEOPLE = 3;
/** Guests counted in the "Guests coming" example (illustration, not a price). */
export const GUEST_EXAMPLE_COUNT = 4;

export function clampGroupPeople(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GROUP_PEOPLE;
  return Math.min(MAX_GROUP_PEOPLE, Math.max(MIN_GROUP_PEOPLE, Math.trunc(value)));
}

/** "HI Tiffin Box, I want the Starter plan." */
export function planMessage(planName: string): string {
  return `HI Tiffin Box, I want the ${planName} plan.`;
}

// ---------- Who's eating? ----------

export type WhoMode = 'me' | 'family' | 'guests';

export interface WhoInput {
  planName: string;
  /** Per-meal price of the example plan (midpoint of a range), delivery included. */
  mealPrice: number;
  /** Delivery charge inside that price (0 when the data has none). */
  delivery: number;
  /** Total for the plan's period. */
  periodPrice: number;
  /** "week", "3 days": what the period price covers. */
  period: string;
  /** Dish for the guest example: "Chicken biryani" else the priciest dish; null when there are no dishes. */
  guestDish: { name: string; price: number } | null;
  /** Cheapest dish price, for "From Rs ..." on the guests option. */
  cheapestDish: number | null;
}

export interface WhoResult {
  label: string;
  value: string;
  note: string;
  message: string;
}

/** Meal price without the delivery that is part of it (each extra person pays this). */
export function perPersonPrice(input: Pick<WhoInput, 'mealPrice' | 'delivery'>): number {
  return input.mealPrice - input.delivery;
}

/** Meals in the plan period when the period price is a whole number of meals, else null. */
export function mealsInPeriod(input: Pick<WhoInput, 'mealPrice' | 'periodPrice'>): number | null {
  if (input.mealPrice <= 0 || input.periodPrice % input.mealPrice !== 0) return null;
  return input.periodPrice / input.mealPrice;
}

/** The "From Rs ..." label of the guests option: cheapest dish plus one delivery. */
export function guestsFrom(input: Pick<WhoInput, 'cheapestDish' | 'delivery'>): number | null {
  return input.cheapestDish === null ? null : input.cheapestDish + input.delivery;
}

export function guestsTotal(dish: { price: number }, delivery: number): number {
  return dish.price * GUEST_EXAMPLE_COUNT + delivery;
}

function oneDelivery(delivery: number): string {
  return delivery > 0 ? `one ${formatRs(delivery)} delivery` : 'no delivery charge';
}

/** What the green total panel shows for the chosen option. Returns null for guests when there is no dish. */
export function whoResult(input: WhoInput, mode: WhoMode, people: number): WhoResult | null {
  const perPerson = perPersonPrice(input);
  const meals = mealsInPeriod(input);
  if (mode === 'me') {
    const breakdown =
      meals === null
        ? ''
        : `${meals} meals × ${formatRs(input.mealPrice)}${
            input.delivery > 0
              ? ` (${formatRs(perPerson)} meal + ${formatRs(input.delivery)} delivery)`
              : ''
          }`;
    return {
      label: `Per ${input.period}, 1 person`,
      value: formatRs(input.periodPrice),
      note: breakdown,
      message: `HI Tiffin Box, ${input.planName} plan for 1 person.`,
    };
  }
  if (mode === 'family') {
    const n = clampGroupPeople(people);
    const perMeal = perPerson * n + input.delivery;
    const delivered = input.delivery > 0 ? ` + ${oneDelivery(input.delivery)}` : '';
    return {
      label: meals === null ? `Per meal, ${n} people` : `Per ${input.period}, ${n} people`,
      value: formatRs(meals === null ? perMeal : perMeal * meals),
      note: `Each meal: ${formatRs(perPerson)} × ${n}${delivered} = ${formatRs(perMeal)}`,
      message: `HI Tiffin Box, ${input.planName} plan for ${n} people at one address.`,
    };
  }
  if (!input.guestDish) return null;
  return {
    label: `Example, ${GUEST_EXAMPLE_COUNT} guests`,
    value: formatRs(guestsTotal(input.guestDish, input.delivery)),
    note: `${GUEST_EXAMPLE_COUNT} × ${input.guestDish.name} ${formatRs(input.guestDish.price)}${
      input.delivery > 0 ? ` + ${oneDelivery(input.delivery)}` : ''
    }`,
    message: 'HI Tiffin Box, I want to order for guests.',
  };
}

// ---------- Customize builder ----------

export interface BuilderItem {
  id: string;
  name: string;
  price: number;
}

export interface BuilderLine {
  label: string;
  amount: number;
}

export interface BuilderResult {
  dish: BuilderItem | null;
  addOns: BuilderItem[];
  lines: BuilderLine[];
  total: number;
}

/** Dish + the switched-on add-ons + delivery. Unknown ids are ignored; each add-on counts once. */
export function builderResult(
  dishes: readonly BuilderItem[],
  addOns: readonly BuilderItem[],
  dishId: string | null,
  selectedAddOnIds: readonly string[],
  delivery: number,
): BuilderResult {
  const dish = dishes.find((d) => d.id === dishId) ?? null;
  const chosen = addOns.filter((a) => selectedAddOnIds.includes(a.id));
  const lines: BuilderLine[] = [];
  if (dish) lines.push({ label: dish.name, amount: dish.price });
  for (const addOn of chosen) lines.push({ label: addOn.name, amount: addOn.price });
  if (delivery > 0) lines.push({ label: 'Delivery to your door', amount: delivery });
  return { dish, addOns: chosen, lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

/** "HI Tiffin Box, I want Chicken qorma with Raita. Total Rs 880." */
export function builderMessage(result: BuilderResult): string {
  const dish = result.dish?.name ?? 'a custom meal';
  const extras =
    result.addOns.length > 0 ? ` with ${result.addOns.map((a) => a.name).join(', ')}` : '';
  return `HI Tiffin Box, I want ${dish}${extras}. Total ${formatRs(result.total)}.`;
}
