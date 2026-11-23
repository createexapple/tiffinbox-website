import { describe, expect, it } from 'vitest';
import { buildPageCopy, customizeExample, LATE_NIGHT_WINDOW } from '@/content/copy';
import { mapPublicContent, MOST_POPULAR_TAG } from '@/content/live';
import { MOCK_CONTENT } from '@/content/mock';
import type { ContentSnapshot, PricingRules } from '@/content';
import { stripQuestionCodes } from '@/lib/format';
import { publicContentDocument } from './fixtures/public-content';

type Rec = Record<string, unknown>;

/** The fixture is an OLD published document: no tag, range, period label, delivery or late-night keys. */
function oldDocument() {
  return publicContentDocument();
}

function newDocument() {
  const doc = publicContentDocument();
  const plans = doc.plans as Rec[];
  plans[0] = { ...plans[0], tag: 'Cheapest', unit_price: 500, weekly_price: 7000 };
  plans[1] = { ...plans[1], is_most_popular: true, tag: '' };
  plans.unshift({
    id: '10000000-0000-4000-8000-000000000005',
    name: 'Starter',
    audience: 'Try us for 3 days',
    meals_included: 'Lunch + dinner, full menu, 3 days',
    price_unit: 'per_meal',
    unit_price: 750,
    unit_price_to: 800,
    weekly_price: 4800,
    monthly_price: 18240,
    is_most_popular: false,
    sort_order: 0,
    tag: 'New',
    period_label: 'for 3 days',
  });
  return {
    ...doc,
    plans,
    pricing_rules: {
      ...(doc.pricing_rules as Rec),
      delivery_charge: 150,
      late_night_meal_price: 650,
      late_night_surcharge: 100,
    },
  };
}

describe('mapPublicContent: CR-004 fields', () => {
  const map = (doc: unknown) => mapPublicContent(doc, { source: 'live' });

  it('maps tag, price range, period label, delivery charge and late-night prices', () => {
    const { plans, pricingRules } = map(newDocument());
    expect(plans[0]).toMatchObject({
      name: 'Starter',
      tag: 'New',
      periodLabel: 'for 3 days',
      price: { from: 750, to: 800 },
      weeklyPrice: 4800,
    });
    expect(plans[1]?.tag).toBe('Cheapest');
    expect(pricingRules.deliveryCharge).toBe(150);
    expect(pricingRules.lateNight).toEqual({ mealPrice: 650, surcharge: 100 });
  });

  it('falls back to "Most popular" for the most popular plan with an empty tag', () => {
    const popular = map(newDocument()).plans.find((p) => p.mostPopular);
    expect(popular?.tag).toBe(MOST_POPULAR_TAG);
  });

  it('keeps working on an OLD document without the new fields (no throw, safe fallbacks)', () => {
    const { plans, pricingRules } = map(oldDocument());
    expect(plans.map((p) => [p.tag, p.periodLabel])).toEqual([
      ['', ''],
      [MOST_POPULAR_TAG, ''],
    ]);
    expect(plans[0]?.price).toEqual({ from: 300 });
    expect(pricingRules.deliveryCharge).toBe(0);
    expect(pricingRules.lateNight).toBeNull();
  });

  it('ignores invalid new values instead of throwing', () => {
    const doc = newDocument();
    (doc.plans[1] as Rec).unit_price_to = 'lots';
    (doc.plans[2] as Rec).unit_price_to = 100; // not above the price: no range
    (doc.plans[1] as Rec).tag = 7;
    (doc.plans[1] as Rec).period_label = null;
    (doc.pricing_rules as Rec).delivery_charge = '150';
    (doc.pricing_rules as Rec).late_night_surcharge = null;
    const { plans, pricingRules } = map(doc);
    expect(plans[1]?.price).toEqual({ from: 500 });
    expect(plans[2]?.price).toEqual({ from: 1500 });
    expect(plans[1]?.tag).toBe('');
    expect(plans[1]?.periodLabel).toBe('');
    expect(pricingRules.deliveryCharge).toBe(0);
    expect(pricingRules.lateNight).toBeNull();
  });

  it('never marks a live plan as price-unresolved', () => {
    expect(map(newDocument()).plans.every((p) => !p.priceUnresolved)).toBe(true);
  });
});

function copyFor(over: Partial<ContentSnapshot> = {}, rules: Partial<PricingRules> = {}) {
  const snap = { ...MOCK_CONTENT, ...over };
  return buildPageCopy({
    settings: snap.settings,
    rules: { ...snap.pricingRules, ...rules },
    mealsFrom: 500,
    plans: snap.plans,
    dishes: snap.customDishes,
    addOns: snap.addOns,
  });
}

describe('page copy: figures are computed from data', () => {
  it('computes the late-night card and week total', () => {
    const card = copyFor().planAddOns[0];
    expect(card?.dark).toBe(true);
    expect(card?.text).toBe(
      `Delivered ${LATE_NIGHT_WINDOW}. Rs 650 meal + Rs 150 delivery + Rs 100 late-night = Rs 900 a night, Rs 6,300 for 7 nights. Add to any plan. Order or skip before 9 PM.`,
    );
    const changed = copyFor({}, { lateNight: { mealPrice: 700, surcharge: 120 } }).planAddOns[0];
    expect(changed?.text).toContain('Rs 970 a night, Rs 6,790 for 7 nights');
  });

  it('lists the four add-on cards in order with breakfast from the data', () => {
    const cards = copyFor().planAddOns;
    expect(cards.map((c) => c.key)).toEqual(['late-night', 'breakfast', 'team', 'monthly']);
    expect(cards[1]?.text).toBe(
      'Breakfast can be added to any plan for Rs 550 a day, delivery included.',
    );
  });

  it('computes the three "Who’s eating?" examples from the plan midpoint, delivery and dishes', () => {
    const [justMe, family, guests] = copyFor().servingOptions;
    expect(justMe?.example).toBe('Student: Rs 775 a meal');
    expect(family?.example).toBe('3 people on Student: Rs 625 × 3 + Rs 150 = Rs 2,025 a meal');
    expect(guests?.example).toBe('4 × Chicken biryani Rs 700 + Rs 150 = Rs 2,950');
  });

  it('follows data changes: another delivery charge and dish price', () => {
    const dishes = MOCK_CONTENT.customDishes.map((d) =>
      d.name === 'Chicken biryani' ? { ...d, price: 720 } : d,
    );
    const [, family, guests] = copyFor(
      { customDishes: dishes },
      { deliveryCharge: 200 },
    ).servingOptions;
    expect(family?.example).toBe('3 people on Student: Rs 575 × 3 + Rs 200 = Rs 1,925 a meal');
    expect(guests?.example).toBe('4 × Chicken biryani Rs 720 + Rs 200 = Rs 3,080');
  });

  it('uses the priciest dish when there is no Chicken biryani, and omits examples without data', () => {
    const dishes = MOCK_CONTENT.customDishes.filter((d) => d.name !== 'Chicken biryani');
    expect(copyFor({ customDishes: dishes }).servingOptions[2]?.example).toBe(
      '4 × Fried fish Rs 750 + Rs 150 = Rs 3,150',
    );
    const bare = copyFor({ customDishes: [], plans: [] });
    expect(bare.servingOptions.map((o) => o.example)).toEqual([null, null, null]);
    expect(bare.customizeExample).toBeNull();
  });

  it('builds the customize example: Chicken qorma + Raita + delivery', () => {
    expect(copyFor().customizeExample).toBe(
      'Chicken qorma Rs 650 + raita Rs 80 + delivery Rs 150 = Rs 880.',
    );
  });

  it('customize example falls back to the first dish and first add-on, and skips a zero delivery', () => {
    const dishes = MOCK_CONTENT.customDishes.filter((d) => d.name !== 'Chicken qorma');
    const addOns = MOCK_CONTENT.addOns.filter((a) => a.name !== 'Raita');
    expect(customizeExample(dishes, addOns, 150)).toBe(
      'Daal or sabzi Rs 400 + achaar Rs 30 + delivery Rs 150 = Rs 580.',
    );
    expect(customizeExample(dishes, [], 0)).toBe('Daal or sabzi Rs 400 = Rs 400.');
    expect(customizeExample([], addOns, 150)).toBeNull();
  });

  it('builds the delivery table: six rows, charges from the data', () => {
    const rows = copyFor().howItWorks.deliveryRows;
    expect(rows.map((r) => r.meal)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Late night',
      'Family or group order',
      'Guest order',
    ]);
    expect(rows.map((r) => r.charge)).toEqual([
      'Rs 150 (included in plan price)',
      'Rs 150 (included)',
      'Rs 150 (included)',
      'Rs 150 + Rs 100 late-night',
      'One Rs 150 for everyone at one address',
      'One Rs 150 for the whole order',
    ]);
    expect(rows[3]).toMatchObject({ deliveredBy: '11 PM – 1 AM', skipBefore: '9 PM the same day' });
    expect(rows[0]).toMatchObject({ deliveredBy: '8 AM', skipBefore: '10 PM the night before' });
  });

  it('drops every late-night and delivery sentence when the document has neither (old release)', () => {
    const copy = copyFor({}, { lateNight: null, deliveryCharge: 0 });
    expect(copy.planAddOns.map((c) => c.key)).toEqual(['breakfast', 'team', 'monthly']);
    expect(copy.menuLateNightNote).toBeNull();
    expect(copy.customizeLateNight).toBeNull();
    expect(copy.about.contactLateNight).toBeNull();
    expect(copy.home.audiences).toHaveLength(4);
    expect(copy.howItWorks.deliveryRows.map((r) => r.key)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'family',
      'guest',
    ]);
    expect(copy.plansLede).not.toMatch(/delivery/);
    expect(copy.customizeIntro).not.toMatch(/delivery/);
    expect(copy.servingOptions[1]?.example).toBeNull();
    expect(JSON.stringify(copy)).not.toMatch(/NaN|undefined/);
  });

  it('puts five audiences on Home, with the two new cards', () => {
    const { audiences } = copyFor().home;
    expect(audiences.map((a) => a.title)).toEqual([
      'Hostel students',
      'Offices and working people',
      'People who can’t cook at home',
      'Families and guests',
      'Night shifts and late studiers',
    ]);
    expect(audiences[0]?.offer).toContain('Rs 500 a meal');
    expect(audiences[4]?.offer).toBe('Late-night meal 11 PM – 1 AM, Rs 900 a night');
  });

  it('omits the trial tag and "Starter" wording when no plan has a period label', () => {
    const plans = MOCK_CONTENT.plans.filter((p) => p.periodLabel === '');
    const copy = copyFor({ plans });
    expect(copy.home.tags).toEqual(['Meals from Rs 500, delivered']);
    expect(copy.steps.items[1]?.text).toMatch(/^Choose weekly or monthly/);
  });

  it('keeps an honest story placeholder without a question code', () => {
    const { about } = copyFor();
    expect(about.story).toBe('[Our story — coming soon]');
    expect(about.storyIsPlaceholder).toBe(true);
    expect(about.contactLateNight).toBe('late-night orders until 9 PM');
  });
});

describe('stripQuestionCodes', () => {
  it('removes question codes from saved placeholders, leaving everything else alone', () => {
    expect(stripQuestionCodes('[delivery area text, Q-11]')).toBe('[delivery area text]');
    expect(stripQuestionCodes('[WhatsApp number] (Q-04)')).toBe('[WhatsApp number]');
    expect(stripQuestionCodes('9 AM to 9 PM')).toBe('9 AM to 9 PM');
  });
});
