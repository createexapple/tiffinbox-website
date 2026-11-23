import { describe, expect, it } from 'vitest';
import { buildPageCopy } from '@/content/copy';
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
  });
}

describe('page copy (design "Tiffin Box Lahore"): figures are computed from data', () => {
  it('builds the late-night card with the price line from the data', () => {
    const card = copyFor().planAddOns[0];
    expect(card).toMatchObject({ key: 'late-night', dark: true, price: 'Rs 900 a night' });
    expect(card?.text).toBe(
      'Delivered 11 PM to 1 AM. Rs 650 meal + Rs 150 delivery + Rs 100 late-night. Add to any plan; order or skip before 9 PM.',
    );
    const changed = copyFor({}, { lateNight: { mealPrice: 700, surcharge: 120 } }).planAddOns[0];
    expect(changed?.price).toBe('Rs 970 a night');
  });

  it('lists the four add-on cards with the design wording', () => {
    const cards = copyFor().planAddOns;
    expect(cards.map((c) => c.key)).toEqual(['late-night', 'breakfast', 'team', 'monthly']);
    expect(cards[1]?.text).toBe(
      'Paratha, egg and chai with any plan, Rs 550 a day, delivery included.',
    );
    expect(cards[3]).toMatchObject({
      title: 'Monthly saves 5%',
      text: 'Pay before the month starts and save 5% compared with paying weekly.',
    });
  });

  it('builds the delivery table: six rows with the design labels and charges', () => {
    const rows = copyFor().howItWorks.deliveryRows;
    expect(rows.map((r) => r.meal)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Late night',
      'Family or group',
      'Guest order',
    ]);
    expect(rows.map((r) => r.charge)).toEqual([
      'Rs 150, included',
      'Rs 150, included',
      'Rs 150, included',
      'Rs 150 + Rs 100 late-night',
      'One Rs 150 per address',
      'One Rs 150 per order',
    ]);
    expect(rows[3]).toMatchObject({
      deliveredBy: '11 PM to 1 AM',
      skipBefore: '9 PM the same day',
    });
    expect(rows[0]).toMatchObject({ deliveredBy: '8 AM', skipBefore: '10 PM the night before' });
  });

  it('writes the four small blocks of How it works', () => {
    const how = copyFor().howItWorks;
    expect(how.skip).toBe('Up to 3 skips a week. Skipped meals are added to the end of your plan.');
    expect(how.pause).toBe(
      "Going home or on leave? Pause on WhatsApp and restart when you're back.",
    );
    expect(how.packaging).toBe('Meals come sealed so they stay hot and clean.');
    expect(how.payment).toBe(
      'Weekly before Sunday, monthly before the 1st (5% cheaper), Starter before day 1. Offices get one monthly invoice.',
    );
  });

  it('drops every late-night and delivery sentence when the document has neither (old release)', () => {
    const copy = copyFor({}, { lateNight: null, deliveryCharge: 0 });
    expect(copy.planAddOns.map((c) => c.key)).toEqual(['breakfast', 'team', 'monthly']);
    expect(copy.menu.note).toBe('Budget plan meals are daal or sabzi with 2 roti.');
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
    expect(JSON.stringify(copy)).not.toMatch(/NaN|undefined/);
  });

  it('puts five "Who we serve" cards on Home: one paragraph each, Night owls dark', () => {
    const { audiences } = copyFor().home;
    expect(audiences.map((a) => a.title)).toEqual([
      'Hostel students',
      'Offices',
      "Can't cook at home",
      'Families and guests',
      'Night owls',
    ]);
    expect(audiences[0]?.text).toBe(
      'Tired of mess food? Budget plan from Rs 500 a meal, lunch and dinner to your room.',
    );
    expect(audiences[1]?.text).toBe(
      'Hot lunch at your desk by 1 PM, Monday to Saturday. One monthly bill for teams.',
    );
    expect(audiences[4]).toMatchObject({
      dark: true,
      text: 'Late shift or studying late? Late-night meal 11 PM to 1 AM, Rs 900 a night.',
    });
  });

  it('writes the Menu eyebrow, intro and note; the Budget sentence needs a Budget plan', () => {
    const { menu } = copyFor();
    expect(menu.eyebrow).toBe('This week');
    expect(menu.intro).toBe(
      'New menu every Sunday evening. Every lunch and dinner comes with fresh roti unless it is a rice dish.',
    );
    expect(menu.note).toBe(
      'Late-night meal (11 PM to 1 AM) is chosen from the dinner menu or the Customize list. Budget plan meals are daal or sabzi with 2 roti.',
    );
    const noBudget = copyFor({ plans: MOCK_CONTENT.plans.filter((p) => p.name !== 'Budget') });
    expect(noBudget.menu.note).toBe(
      'Late-night meal (11 PM to 1 AM) is chosen from the dinner menu or the Customize list.',
    );
    expect(menu.customizeLink).toBe("Don't like a dish? Customize it");
  });

  it('omits the trial tag and "Starter" wording when no plan has a period label', () => {
    const plans = MOCK_CONTENT.plans.filter((p) => p.periodLabel === '');
    const copy = copyFor({ plans });
    expect(copy.home.tags).toEqual(['Meals from Rs 500, delivered']);
    expect(copy.steps.items[1]?.text).toMatch(/^Weekly or monthly\./);
    expect(copy.howItWorks.payment).not.toMatch(/Starter/);
  });

  it('has no story block and a mission that starts "Our mission:"', () => {
    const { about } = copyFor();
    expect(about.mission.startsWith('Our mission: give people')).toBe(true);
    expect(about).not.toHaveProperty('story');
    expect(about.whereWeDeliver).toBe(
      'Johar Town, Lahore, including hostels, offices and homes around UMT. More areas soon.',
    );
    expect(about.contactLateNight).toBe('late-night orders until 9 PM');
  });

  it('writes the customize intro with the delivery charge from the data', () => {
    expect(copyFor().customizeIntro).toBe(
      'Swap any meal for a dish you love. Dish prices stay the same; Rs 150 delivery is added to every custom order, because we bring it to your door.',
    );
    expect(copyFor({}, { deliveryCharge: 200 }).customizeIntro).toContain('Rs 200 delivery');
  });
});

describe('stripQuestionCodes', () => {
  it('removes question codes from saved placeholders, leaving everything else alone', () => {
    expect(stripQuestionCodes('[delivery area text, Q-11]')).toBe('[delivery area text]');
    expect(stripQuestionCodes('[WhatsApp number] (Q-04)')).toBe('[WhatsApp number]');
    expect(stripQuestionCodes('9 AM to 9 PM')).toBe('9 AM to 9 PM');
  });
});
