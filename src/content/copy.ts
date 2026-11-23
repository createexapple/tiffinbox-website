/**
 * Static page copy (A-16: developer-maintained in v1, architecture sec. 4).
 *
 * The Roman-Urdu headlines follow the client's "Full Spec to Match the App" (23 Nov 2026, CR-004).
 *
 * Nothing here types a price, time, number or handle that the data holds: they are filled in from settings, pricing
 * rules, plans, dishes and add-ons, so editing those in the admin updates this copy too, and worked examples
 * (customize total, "Who's eating?") are computed. Every example is left out when the data it needs is missing.
 */
import { formatRs, formatTime12h } from '@/lib/format';
import { describeSkipCutoff } from './derive';
import type {
  AddOn,
  AddOnCard,
  Audience,
  CustomDish,
  DeliveryRow,
  PageCopy,
  Plan,
  PricingRules,
  ServingOption,
  SiteSettings,
} from './types';

/**
 * Late-night delivery window and its order cut-off. These two are NOT in the database (the late-night PRICES are, in
 * pricing_rules). They come from the 23 Nov 2026 app spec; change them here if the client changes them.
 */
export const LATE_NIGHT_WINDOW = '11 PM – 1 AM';
export const LATE_NIGHT_ORDER_CUTOFF = '9 PM';

/** People counted in the worked "Who's eating?" examples (illustration only, not a price). */
const FAMILY_EXAMPLE_PEOPLE = 3;
const GUEST_EXAMPLE_PEOPLE = 4;
/** Nights in the late-night week total. */
const NIGHTS_IN_WEEK = 7;
/** Dish and add-on the spec uses in its examples; the first dish / add-on is used when they are not in the data. */
const EXAMPLE_CUSTOM_DISH = 'Chicken qorma';
const EXAMPLE_ADD_ON = 'Raita';
const EXAMPLE_GUEST_DISH = 'Chicken biryani';

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

export interface CopyInputs {
  settings: SiteSettings;
  rules: PricingRules;
  /** Lowest per-meal plan price, or null when there is no per-meal plan. */
  mealsFrom: number | null;
  plans?: readonly Plan[];
  dishes?: readonly CustomDish[];
  addOns?: readonly AddOn[];
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Price used in "Just me" and the family example: the most popular per-meal plan, else the first per-meal plan. */
export function examplePlan(plans: readonly Plan[]): Plan | null {
  const perMeal = plans.filter((p) => p.priceUnit === 'meal');
  return perMeal.find((p) => p.mostPopular) ?? perMeal[0] ?? null;
}

/** Midpoint of a plan's per-meal price (the range's middle; the price itself when there is no range). */
export function midPrice(plan: Plan): number {
  return plan.price.to === undefined
    ? plan.price.from
    : Math.round((plan.price.from + plan.price.to) / 2);
}

/** Night total of the late-night meal: meal + delivery + late-night surcharge. */
export function lateNightPerNight(rules: PricingRules): number | null {
  if (rules.lateNight === null) return null;
  return rules.lateNight.mealPrice + rules.deliveryCharge + rules.lateNight.surcharge;
}

/** The plan that is not a weekly one (Starter, "for 3 days"), if any. */
export function trialPlan(plans: readonly Plan[]): Plan | null {
  return plans.find((p) => p.periodLabel !== '') ?? null;
}

/** "Chicken qorma Rs 650 + raita Rs 80 + delivery Rs 150 = Rs 880." or null when there are no dishes. */
export function customizeExample(
  dishes: readonly CustomDish[],
  addOns: readonly AddOn[],
  deliveryCharge: number,
): string | null {
  const dish = dishes.find((d) => sameName(d.name, EXAMPLE_CUSTOM_DISH)) ?? dishes[0];
  if (!dish) return null;
  const addOn = addOns.find((a) => sameName(a.name, EXAMPLE_ADD_ON)) ?? addOns[0];
  const parts = [`${dish.name} ${formatRs(dish.price)}`];
  let total = dish.price;
  if (addOn) {
    parts.push(
      `${addOn.name.charAt(0).toLowerCase()}${addOn.name.slice(1)} ${formatRs(addOn.price)}`,
    );
    total += addOn.price;
  }
  if (deliveryCharge > 0) {
    parts.push(`delivery ${formatRs(deliveryCharge)}`);
    total += deliveryCharge;
  }
  return `${parts.join(' + ')} = ${formatRs(total)}.`;
}

function servingOptions(
  plans: readonly Plan[],
  dishes: readonly CustomDish[],
  delivery: number,
): ServingOption[] {
  const plan = examplePlan(plans);
  const oneDelivery = delivery > 0 ? `one ${formatRs(delivery)} delivery` : 'one delivery';

  let justMe: string | null = null;
  let family: string | null = null;
  if (plan) {
    const mid = midPrice(plan);
    justMe = `${plan.name}: ${formatRs(mid)} a meal`;
    // Each extra person pays the meal price only (price minus the delivery that is part of it).
    const perPerson = mid - delivery;
    if (delivery > 0 && perPerson > 0) {
      family = `${FAMILY_EXAMPLE_PEOPLE} people on ${plan.name}: ${formatRs(perPerson)} × ${FAMILY_EXAMPLE_PEOPLE} + ${formatRs(delivery)} = ${formatRs(perPerson * FAMILY_EXAMPLE_PEOPLE + delivery)} a meal`;
    }
  }

  let guests: string | null = null;
  const dish =
    dishes.find((d) => sameName(d.name, EXAMPLE_GUEST_DISH)) ??
    [...dishes].sort((a, b) => b.price - a.price)[0];
  if (dish) {
    const total = dish.price * GUEST_EXAMPLE_PEOPLE + delivery;
    guests = `${GUEST_EXAMPLE_PEOPLE} × ${dish.name} ${formatRs(dish.price)}${delivery > 0 ? ` + ${formatRs(delivery)}` : ''} = ${formatRs(total)}`;
  }

  return [
    {
      title: 'Just me',
      how: 'One meal, one delivery, any plan.',
      example: justMe,
    },
    {
      title: 'Family or group',
      how: `Same address, ${oneDelivery} for everyone; each extra person pays the meal price only.`,
      example: family,
    },
    {
      title: 'Guests coming',
      how: `One-time order for guests at home; each guest picks a dish from the Customize list; ${oneDelivery}; order 1 day ahead.`,
      example: guests,
    },
  ];
}

export function buildPageCopy({
  settings,
  rules,
  mealsFrom,
  plans = [],
  dishes = [],
  addOns = [],
}: CopyInputs): PageCopy {
  const lunch = formatTime12h(settings.meals.lunch.deliveredBy);
  const dinner = formatTime12h(settings.meals.dinner.deliveredBy);
  const delivery = rules.deliveryCharge;
  const deliveryText = delivery > 0 ? formatRs(delivery) : null;
  const mealsFromText = mealsFrom === null ? null : `Meals from ${formatRs(mealsFrom)}`;
  const saving = `${rules.monthlySavingPercent}%`;
  const lateNight = rules.lateNight;
  const night = lateNightPerNight(rules);
  const trial = trialPlan(plans);
  const trialTag = trial
    ? `Try ${trial.periodLabel.replace(/^for\s+/i, '')} for ${formatRs(trial.weeklyPrice)}`
    : null;

  const audiences: Audience[] = [
    {
      title: 'Hostel students',
      problem: 'Tired of mess food, no kitchen, tight budget',
      offer:
        mealsFrom === null
          ? 'Budget plan, lunch and dinner to the room'
          : `Budget plan from ${formatRs(mealsFrom)} a meal, lunch and dinner to the room`,
    },
    {
      title: 'Offices and working people',
      problem: 'No time to cook or order every day',
      offer: `Hot lunch at the desk by ${lunch}, Mon–Sat, one monthly bill for teams`,
    },
    {
      title: 'People who can’t cook at home',
      problem: 'Living alone, elderly, busy families',
      offer: 'Full plans with breakfast, lunch and dinner',
    },
    {
      title: 'Families and guests',
      problem: 'Feeding several people, or guests arriving',
      offer: 'One delivery for the whole family; one-time guest orders',
    },
  ];
  if (lateNight !== null && night !== null) {
    audiences.push({
      title: 'Night shifts and late studiers',
      problem: 'Hungry after the kitchen closes',
      offer: `Late-night meal ${LATE_NIGHT_WINDOW}, ${formatRs(night)} a night`,
    });
  }

  const planAddOns: AddOnCard[] = [];
  if (lateNight !== null && night !== null) {
    const terms = [
      `${formatRs(lateNight.mealPrice)} meal`,
      ...(delivery > 0 ? [`${formatRs(delivery)} delivery`] : []),
      `${formatRs(lateNight.surcharge)} late-night`,
    ];
    planAddOns.push({
      key: 'late-night',
      title: 'Late-night meal',
      dark: true,
      text: `Delivered ${LATE_NIGHT_WINDOW}. ${terms.join(' + ')} = ${formatRs(night)} a night, ${formatRs(night * NIGHTS_IN_WEEK)} for ${NIGHTS_IN_WEEK} nights. Add to any plan. Order or skip before ${LATE_NIGHT_ORDER_CUTOFF}.`,
    });
  }
  planAddOns.push(
    {
      key: 'breakfast',
      title: 'Add breakfast',
      text: `Breakfast can be added to any plan for ${formatRs(rules.breakfastAddOnPerDay)} a day${delivery > 0 ? ', delivery included' : ''}.`,
    },
    {
      key: 'team',
      title: 'Office team deal',
      text: `Offices with ${rules.teamDeal.minPeople} or more people get ${rules.teamDeal.text}.`,
    },
    {
      key: 'monthly',
      title: `Monthly saves ${saving}`,
      text: `Pay monthly, before the month starts, and save ${saving} compared with paying weekly.`,
    },
  );

  const deliveryRows: DeliveryRow[] = (['breakfast', 'lunch', 'dinner'] as const).map(
    (key, index) => {
      const meal = settings.meals[key];
      return {
        key,
        meal: meal.label,
        deliveredBy: formatTime12h(meal.deliveredBy),
        skipBefore: describeSkipCutoff(meal.skipCutoff),
        charge:
          deliveryText === null
            ? 'Included in plan price'
            : `${deliveryText} (${index === 0 ? 'included in plan price' : 'included'})`,
      };
    },
  );
  if (lateNight !== null) {
    deliveryRows.push({
      key: 'late-night',
      meal: 'Late night',
      deliveredBy: LATE_NIGHT_WINDOW,
      skipBefore: `${LATE_NIGHT_ORDER_CUTOFF} the same day`,
      charge: `${deliveryText ?? 'No delivery charge'} + ${formatRs(lateNight.surcharge)} late-night`,
    });
  }
  deliveryRows.push(
    {
      key: 'family',
      meal: 'Family or group order',
      deliveredBy: 'Same times',
      skipBefore: 'Same cut-offs',
      charge: `One ${deliveryText ?? 'delivery charge'} for everyone at one address`,
    },
    {
      key: 'guest',
      meal: 'Guest order',
      deliveredBy: 'Time you choose',
      skipBefore: 'Order 1 day ahead',
      charge: `One ${deliveryText ?? 'delivery charge'} for the whole order`,
    },
  );

  const methods = joinList(settings.paymentMethods);

  return {
    home: {
      eyebrow: settings.areaServed,
      headline: 'Bhook lagi? Khana hazir.',
      tagline: settings.tagline,
      lede: 'Your favourite home-style meal, on time, every day.',
      tags: [mealsFromText ? `${mealsFromText}, delivered` : null, trialTag].filter(
        (tag): tag is string => tag !== null,
      ),
      benefitsEyebrow: 'Why Tiffin Box',
      benefitsHeadline: 'Khana, bina jhanjhat.',
      benefits: [
        {
          title: 'Waqt par, har roz',
          text: `Lunch by ${lunch}, dinner by ${dinner}${lateNight ? `, late night ${LATE_NIGHT_WINDOW}` : ''}. Sealed tiffin boxes keep it hot and clean.`,
        },
        {
          title: 'Ghar jaisa swaad',
          text: 'Home-style Pakistani food that tastes like Ammi made it.',
        },
        {
          title: 'Munasib daam',
          text: `${mealsFromText ? `${mealsFromText} with door-to-door delivery included. ` : ''}Save ${saving} when you pay monthly.`,
        },
      ],
      audienceEyebrow: 'Who we serve',
      audienceHeadline: 'Aap ke liye.',
      audiences,
      orderHeadline: 'Bhook lagi? Bas “HI” bhejein.',
      orderLine: 'Your first meal can arrive the next day.',
    },
    steps: {
      eyebrow: 'How it works',
      headline: 'Teen steps, ek message.',
      items: [
        {
          title: 'Message us',
          text: `Send “HI” on WhatsApp or DM @${settings.instagramHandle} on Instagram.`,
        },
        {
          title: 'Pick a plan and pay',
          text: `Choose ${trial ? `${trial.name}, ` : ''}weekly or monthly, and pay by ${methods}.`,
        },
        {
          title: 'Eat on time',
          text: 'Your first meal arrives the next day.',
        },
      ],
    },
    menuIntro: 'Every lunch and dinner comes with fresh roti unless it is a rice dish.',
    menuLateNightNote:
      lateNight === null
        ? null
        : `Late-night meal (${LATE_NIGHT_WINDOW}) is chosen from the dinner menu or the Customize list.`,
    planNote: 'Budget is daal or sabzi + 2 roti; Office Lunch is lunch only, Mon–Sat.',
    plansLede: `${mealsFrom === null ? 'Pick the plan that suits you' : `Meals start at ${formatRs(mealsFrom)}`}${deliveryText ? `, including ${deliveryText} door-to-door delivery` : ''}. Monthly plans save ${saving}. All prices in Pakistani Rupees.`,
    plansSub: `Prices below are for one person${delivery > 0 ? ' and include delivery' : ''}.`,
    planAddOns,
    servingEyebrow: 'Serving options',
    servingHeadline: 'Who’s eating?',
    servingOptions: servingOptions(plans, dishes, delivery),
    customizeIntro: `Any meal can be swapped for one of these dishes. Dish prices stay the same${
      deliveryText
        ? `; ${deliveryText} delivery is added to every custom order, because we deliver door to door`
        : ''
    }. Add-ons are extra. Tell us your choice on WhatsApp${
      deliveryText ? `; the total is dish + add-ons + ${deliveryText} delivery` : ''
    }.`,
    customizeExample: customizeExample(dishes, addOns, delivery),
    customizeLateNight:
      lateNight === null
        ? null
        : `Custom dishes can also be ordered as your late-night meal (+${formatRs(lateNight.surcharge)} late-night charge).`,
    about: {
      headline: 'Ghar se door, ghar ka swaad.',
      mission:
        'Give people who live away from home, or have no time to cook, food that tastes like home at a fair weekly price.',
      // The story is not in the database and the client has not supplied it: keep an honest placeholder.
      story: '[Our story — coming soon]',
      storyIsPlaceholder: true,
      contactLateNight:
        lateNight === null ? null : `late-night orders until ${LATE_NIGHT_ORDER_CUTOFF}`,
    },
    howItWorks: {
      headline: 'Ordering is easy.',
      lede: 'Three steps and one message.',
      weeklyMenuLine:
        'The weekly menu is shared every Sunday evening on WhatsApp, Instagram and the website.',
      deliveryRows,
      skip: `Up to ${settings.maxSkipsPerWeek} skips a week. Skipped meals are added to the end of your plan. Tell us on WhatsApp before the cut-off.`,
      pause: 'Going home or on leave? Pause the plan on WhatsApp and restart when you’re back.',
      packaging: 'Meals come sealed in tiffin boxes so they stay hot and clean.',
      paymentIntro: 'You pay before your days start.',
      paymentPoints: [
        { label: 'Methods', text: `${methods}.` },
        { label: 'Weekly plans', text: 'paid before Sunday.' },
        {
          label: 'Monthly plans',
          text: `paid before the 1st; ${saving} cheaper than weekly.`,
        },
        ...(trial ? [{ label: trial.name, text: 'paid before day 1.' }] : []),
        { label: 'Offices', text: 'one monthly invoice for the whole team.' },
        { label: 'Receipts', text: 'sent on WhatsApp after every payment.' },
      ],
    },
    priceDisclaimer:
      'Prices depend on our supplier’s rates and may change. We confirm your price on WhatsApp before you pay.',
  };
}
