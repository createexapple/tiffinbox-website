/**
 * Static page copy (A-16: developer-maintained in v1, architecture sec. 4).
 *
 * Wording follows the operator's design export "Tiffin Box Lahore" (24 Nov 2026, CR-004 addendum), which wins over the
 * 23 Nov spec where the two differ in wording. Prices and rules are the same.
 *
 * Nothing here types a price, time, number or handle that the data holds: they are filled in from settings, pricing
 * rules, plans, dishes and add-ons, so editing those in the admin updates this copy too. Sentences about a feature the
 * data does not have (late night, delivery charge, the trial plan) are left out when the data is missing.
 */
import { formatRs, formatTime12h } from '@/lib/format';
import { describeSkipCutoff } from './derive';
import type {
  AddOnCard,
  Audience,
  DeliveryRow,
  PageCopy,
  Plan,
  PricingRules,
  SiteSettings,
} from './types';

/**
 * Late-night delivery window and its order cut-off. These two are NOT in the database (the late-night PRICES are, in
 * pricing_rules). They come from the 23 Nov 2026 app spec; change them here if the client changes them.
 */
export const LATE_NIGHT_WINDOW = '11 PM to 1 AM';
export const LATE_NIGHT_ORDER_CUTOFF = '9 PM';

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
}

/** Price used by the "Who's eating?" calculator: the most popular per-meal plan, else the first per-meal plan. */
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

export function buildPageCopy({ settings, rules, mealsFrom, plans = [] }: CopyInputs): PageCopy {
  const lunch = formatTime12h(settings.meals.lunch.deliveredBy);
  const dinner = formatTime12h(settings.meals.dinner.deliveredBy);
  const delivery = rules.deliveryCharge;
  const deliveryText = delivery > 0 ? formatRs(delivery) : null;
  const mealsFromText = mealsFrom === null ? null : `Meals from ${formatRs(mealsFrom)}`;
  const saving = `${rules.monthlySavingPercent}%`;
  const lateNight = rules.lateNight;
  const night = lateNightPerNight(rules);
  const trial = trialPlan(plans);
  const hasBudget = plans.some((p) => p.name.trim().toLowerCase() === 'budget');
  const trialTag = trial
    ? `Try ${trial.periodLabel.replace(/^for\s+/i, '')} for ${formatRs(trial.weeklyPrice)}`
    : null;
  const methods = joinList(settings.paymentMethods);

  const audiences: Audience[] = [
    {
      title: 'Hostel students',
      text:
        mealsFrom === null
          ? 'Tired of mess food? Budget plan, lunch and dinner to your room.'
          : `Tired of mess food? Budget plan from ${formatRs(mealsFrom)} a meal, lunch and dinner to your room.`,
    },
    {
      title: 'Offices',
      text: `Hot lunch at your desk by ${lunch}, Monday to Saturday. One monthly bill for teams.`,
    },
    {
      title: "Can't cook at home",
      text: 'Living alone, elderly or a busy family? Breakfast, lunch and dinner plans.',
    },
    {
      title: 'Families and guests',
      text: 'One delivery for the whole family, or a one-time order when guests are coming.',
    },
  ];
  if (lateNight !== null && night !== null) {
    audiences.push({
      title: 'Night owls',
      text: `Late shift or studying late? Late-night meal ${LATE_NIGHT_WINDOW}, ${formatRs(night)} a night.`,
      dark: true,
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
      text: `Delivered ${LATE_NIGHT_WINDOW}. ${terms.join(' + ')}. Add to any plan; order or skip before ${LATE_NIGHT_ORDER_CUTOFF}.`,
      price: `${formatRs(night)} a night`,
    });
  }
  planAddOns.push(
    {
      key: 'breakfast',
      title: 'Add breakfast',
      text: `Paratha, egg and chai with any plan, ${formatRs(rules.breakfastAddOnPerDay)} a day${delivery > 0 ? ', delivery included' : ''}.`,
    },
    {
      key: 'team',
      title: 'Office team deal',
      text: `Offices with ${rules.teamDeal.minPeople} or more people get ${rules.teamDeal.text}.`,
    },
    {
      key: 'monthly',
      title: `Monthly saves ${saving}`,
      text: `Pay before the month starts and save ${saving} compared with paying weekly.`,
    },
  );

  const deliveryRows: DeliveryRow[] = (['breakfast', 'lunch', 'dinner'] as const).map((key) => {
    const meal = settings.meals[key];
    return {
      key,
      meal: meal.label,
      deliveredBy: formatTime12h(meal.deliveredBy),
      skipBefore: describeSkipCutoff(meal.skipCutoff),
      charge: deliveryText === null ? 'Included' : `${deliveryText}, included`,
    };
  });
  if (lateNight !== null) {
    deliveryRows.push({
      key: 'late-night',
      meal: 'Late night',
      deliveredBy: LATE_NIGHT_WINDOW,
      skipBefore: `${LATE_NIGHT_ORDER_CUTOFF} the same day`,
      charge: `${deliveryText ? `${deliveryText} + ` : ''}${formatRs(lateNight.surcharge)} late-night`,
    });
  }
  deliveryRows.push(
    {
      key: 'family',
      meal: 'Family or group',
      deliveredBy: 'Same times',
      skipBefore: 'Same cut-offs',
      charge: `One ${deliveryText ?? 'delivery'} per address`,
    },
    {
      key: 'guest',
      meal: 'Guest order',
      deliveredBy: 'Time you choose',
      skipBefore: 'Order 1 day ahead',
      charge: `One ${deliveryText ?? 'delivery'} per order`,
    },
  );

  const paymentParts = [
    'Weekly before Sunday',
    'monthly before the 1st (5% cheaper)'.replace('5%', saving),
    ...(trial ? [`${trial.name} before day 1`] : []),
  ];

  return {
    home: {
      eyebrow: settings.areaServed,
      headline: 'Bhook lagi?',
      headlineAccent: 'Khana hazir.',
      tagline: settings.tagline,
      lede: 'Your favourite home-style meal, delivered to your room, desk or door, on time, every day.',
      tags: [mealsFromText ? `${mealsFromText}, delivered` : null, trialTag].filter(
        (tag): tag is string => tag !== null,
      ),
      benefitsEyebrow: 'Why Tiffin Box',
      benefitsHeadline: 'Khana, bina jhanjhat.',
      benefits: [
        {
          title: 'Waqt par, har roz',
          text: `Lunch by ${lunch}, dinner by ${dinner}${lateNight ? `, late night ${LATE_NIGHT_WINDOW}` : ''}. Sealed tiffins keep it hot and clean.`,
        },
        {
          title: 'Ghar jaisa swaad',
          text: 'Home-style Pakistani food that tastes like Ammi made it. New menu every week.',
        },
        {
          title: 'Munasib daam',
          text: `${mealsFromText ? `${mealsFromText} with door-to-door delivery included. ` : ''}Save ${saving} when you pay monthly.`,
        },
      ],
      audienceEyebrow: 'Who we serve',
      audienceHeadline: 'Aap ke liye.',
      audiences,
      orderHeadline: 'Bhook lagi? Bas "HI" bhejein.',
      orderLine: 'Your first meal can arrive the next day.',
    },
    steps: {
      eyebrow: 'How it works',
      headline: 'Teen steps, ek message.',
      items: [
        {
          title: 'Message us',
          text: `Send "HI" on WhatsApp or DM @${settings.instagramHandle} on Instagram.`,
        },
        {
          title: 'Pick a plan and pay',
          text: `${trial ? `${trial.name}, weekly or monthly` : 'Weekly or monthly'}. Pay by ${methods}.`,
        },
        { title: 'Eat on time', text: 'Your first meal arrives the next day.' },
      ],
      linkText: 'Delivery times, skipping and payment',
    },
    menu: {
      eyebrow: 'This week',
      intro:
        'New menu every Sunday evening. Every lunch and dinner comes with fresh roti unless it is a rice dish.',
      note: [
        lateNight
          ? `Late-night meal (${LATE_NIGHT_WINDOW}) is chosen from the dinner menu or the Customize list.`
          : null,
        hasBudget ? 'Budget plan meals are daal or sabzi with 2 roti.' : null,
      ]
        .filter((part): part is string => part !== null)
        .join(' '),
      customizeLink: "Don't like a dish? Customize it",
    },
    plansLede: `${mealsFrom === null ? 'Pick the plan that suits you' : `Meals start at ${formatRs(mealsFrom)}`}${deliveryText ? `, including ${deliveryText} door-to-door delivery` : ''}. Monthly plans save ${saving}. Prices are for one person.`,
    planAddOns,
    priceDisclaimer:
      'Prices depend on supplier rates; we confirm your price on WhatsApp before you pay.',
    customizeIntro: `Swap any meal for a dish you love. Dish prices stay the same${
      deliveryText
        ? `; ${deliveryText} delivery is added to every custom order, because we bring it to your door`
        : ''
    }.`,
    customizeLateNight:
      lateNight === null
        ? null
        : `Custom dishes can also be ordered as your late-night meal (+${formatRs(lateNight.surcharge)} late-night charge).`,
    about: {
      headline: 'Ghar se door, ghar ka swaad.',
      mission:
        'Our mission: give people who live away from home, or have no time to cook, food that tastes like home at a fair weekly price.',
      whereWeDeliver: `${settings.areaServed}, including hostels, offices and homes around UMT. More areas soon.`,
      contactLateNight:
        lateNight === null ? null : `late-night orders until ${LATE_NIGHT_ORDER_CUTOFF}`,
    },
    howItWorks: {
      headline: 'Ordering is easy.',
      steps: [
        {
          title: 'Message us',
          text: `Send "HI" on WhatsApp or DM @${settings.instagramHandle} on Instagram.`,
        },
        {
          title: 'Pick a plan and pay',
          text: `${trial ? `${trial.name}, weekly or monthly` : 'Weekly or monthly'}. ${methods}, before your days start.`,
        },
        {
          title: 'Eat on time',
          text: 'Your first meal arrives the next day. The weekly menu is shared every Sunday evening.',
        },
      ],
      deliveryRows,
      skip: `Up to ${settings.maxSkipsPerWeek} skips a week. Skipped meals are added to the end of your plan.`,
      pause: "Going home or on leave? Pause on WhatsApp and restart when you're back.",
      packaging: 'Meals come sealed so they stay hot and clean.',
      payment: `${paymentParts.join(', ')}. Offices get one monthly invoice.`,
    },
  };
}
