import { describe, expect, it } from 'vitest';
import { builderDefaults, whoEatingInput, whoNote } from '@/content/orders';
import { MOCK_CONTENT } from '@/content/mock';
import {
  builderMessage,
  builderResult,
  clampGroupPeople,
  guestsFrom,
  mealsInPeriod,
  planMessage,
  whoResult,
  type WhoInput,
} from '@/lib/order-math';

const who = whoEatingInput(MOCK_CONTENT.plans, MOCK_CONTENT.customDishes, 150) as WhoInput;

describe('whoEatingInput (from content data)', () => {
  it('uses the most popular plan: midpoint price, delivery, weekly total, priciest/Chicken biryani dish', () => {
    expect(who).toEqual({
      planName: 'Student',
      mealPrice: 775,
      delivery: 150,
      periodPrice: 10850,
      period: 'week',
      guestDish: { name: 'Chicken biryani', price: 700 },
      cheapestDish: 400,
    });
  });
  it('falls back to the priciest dish and to the first per-meal plan', () => {
    const dishes = MOCK_CONTENT.customDishes.filter((d) => d.name !== 'Chicken biryani');
    const plans = MOCK_CONTENT.plans.map((p) => ({ ...p, mostPopular: false }));
    const input = whoEatingInput(plans, dishes, 150);
    expect(input?.guestDish).toEqual({ name: 'Fried fish', price: 750 });
    expect(input?.planName).toBe('Starter');
    expect(input?.period).toBe('3 days');
  });
  it('is null without a per-meal plan or when delivery is not below the price', () => {
    expect(whoEatingInput([], MOCK_CONTENT.customDishes, 150)).toBeNull();
    expect(whoEatingInput(MOCK_CONTENT.plans, MOCK_CONTENT.customDishes, 900)).toBeNull();
  });
  it('writes the note under the calculator from data', () => {
    expect(whoNote(who)).toBe(
      'Example uses the Student plan (Rs 625 meal + Rs 150 delivery). Prices depend on supplier rates; we confirm your price on WhatsApp before you pay.',
    );
  });
});

describe('whoResult', () => {
  it('Just me: weekly price with meals × price (meal + delivery)', () => {
    expect(whoResult(who, 'me', 3)).toEqual({
      label: 'Per week, 1 person',
      value: 'Rs 10,850',
      note: '14 meals × Rs 775 (Rs 625 meal + Rs 150 delivery)',
      message: 'HI Tiffin Box, Student plan for 1 person.',
    });
  });
  it('Family or group: (per person × people + one delivery) per meal and × meals per week', () => {
    expect(whoResult(who, 'family', 3)).toEqual({
      label: 'Per week, 3 people',
      value: 'Rs 28,350',
      note: 'Each meal: Rs 625 × 3 + one Rs 150 delivery = Rs 2,025',
      message: 'HI Tiffin Box, Student plan for 3 people at one address.',
    });
    expect(whoResult(who, 'family', 10)?.value).toBe('Rs 89,600'); // (625 × 10 + 150) × 14
  });
  it('clamps the people count to 2 to 10', () => {
    expect(clampGroupPeople(1)).toBe(2);
    expect(clampGroupPeople(11)).toBe(10);
    expect(clampGroupPeople(Number.NaN)).toBe(3);
    expect(whoResult(who, 'family', 99)?.label).toBe('Per week, 10 people');
  });
  it('Guests: 4 × dish + one delivery, with "From" the cheapest dish plus delivery', () => {
    expect(whoResult(who, 'guests', 3)).toEqual({
      label: 'Example, 4 guests',
      value: 'Rs 2,950',
      note: '4 × Chicken biryani Rs 700 + one Rs 150 delivery',
      message: 'HI Tiffin Box, I want to order for guests.',
    });
    expect(guestsFrom(who)).toBe(550);
    expect(whoResult({ ...who, guestDish: null }, 'guests', 3)).toBeNull();
  });
  it('omits the breakdown when the period price is not a whole number of meals', () => {
    expect(mealsInPeriod({ mealPrice: 775, periodPrice: 10000 })).toBeNull();
    const odd = { ...who, periodPrice: 10000 };
    expect(whoResult(odd, 'me', 3)?.note).toBe('');
    expect(whoResult(odd, 'family', 3)).toMatchObject({
      label: 'Per meal, 3 people',
      value: 'Rs 2,025',
    });
  });
  it('handles a Starter-style plan period', () => {
    const starter = whoEatingInput(
      MOCK_CONTENT.plans.filter((p) => p.name === 'Starter'),
      MOCK_CONTENT.customDishes,
      150,
    ) as WhoInput;
    expect(whoResult(starter, 'me', 3)).toMatchObject({
      label: 'Per 3 days, 1 person',
      value: 'Rs 4,800',
      note: '6 meals × Rs 800 (Rs 650 meal + Rs 150 delivery)',
    });
  });
  it('leaves out delivery wording when there is no delivery charge', () => {
    const free = whoEatingInput(MOCK_CONTENT.plans, MOCK_CONTENT.customDishes, 0) as WhoInput;
    expect(whoResult(free, 'family', 2)?.note).toBe('Each meal: Rs 775 × 2 = Rs 1,550');
  });
});

describe('plan message', () => {
  it('names the plan', () => {
    expect(planMessage('Starter')).toBe('HI Tiffin Box, I want the Starter plan.');
  });
});

describe('Customize builder', () => {
  const dishes = MOCK_CONTENT.customDishes;
  const addOns = MOCK_CONTENT.addOns;
  const defaults = builderDefaults(dishes, addOns);

  it('preselects Chicken qorma with Raita on', () => {
    expect(defaults).toEqual({ dishId: 'dish-chicken-qorma', addOnIds: ['addon-raita'] });
    expect(builderDefaults([{ id: 'x', name: 'Karhi', comesWith: '', price: 500 }], [])).toEqual({
      dishId: 'x',
      addOnIds: [],
    });
    expect(builderDefaults([], addOns)).toEqual({ dishId: null, addOnIds: ['addon-raita'] });
  });

  it('adds dish, the chosen add-ons and delivery', () => {
    const result = builderResult(dishes, addOns, defaults.dishId, defaults.addOnIds, 150);
    expect(result.lines).toEqual([
      { label: 'Chicken qorma', amount: 650 },
      { label: 'Raita', amount: 80 },
      { label: 'Delivery to your door', amount: 150 },
    ]);
    expect(result.total).toBe(880);
  });

  it('follows the selection and ignores unknown ids', () => {
    const result = builderResult(
      dishes,
      addOns,
      'dish-fried-fish',
      ['addon-achaar', 'addon-shami', 'nope'],
      150,
    );
    expect(result.total).toBe(750 + 30 + 90 + 150);
    expect(builderResult(dishes, addOns, 'nope', [], 150).total).toBe(150);
    expect(builderResult(dishes, addOns, 'dish-daal-chawal', [], 0).total).toBe(550);
  });

  it('writes the design message: "HI Tiffin Box, I want <dish> with <add-ons>. Total Rs X."', () => {
    const base = builderResult(dishes, addOns, defaults.dishId, defaults.addOnIds, 150);
    expect(builderMessage(base)).toBe(
      'HI Tiffin Box, I want Chicken qorma with Raita. Total Rs 880.',
    );
    const two = builderResult(
      dishes,
      addOns,
      'dish-aloo-qeema',
      ['addon-salad', 'addon-roti'],
      150,
    );
    expect(builderMessage(two)).toBe(
      'HI Tiffin Box, I want Aloo qeema with Salad, Extra roti. Total Rs 910.',
    );
    expect(builderMessage(builderResult(dishes, addOns, 'dish-daal-chawal', [], 150))).toBe(
      'HI Tiffin Box, I want Daal chawal. Total Rs 700.',
    );
  });
});
