/**
 * Static page copy (A-16: developer-maintained in v1, architecture sec. 4).
 *
 * DRAFT: the three Home benefits and "Our story" are not in the brief (Q-14), and the Roman-Urdu
 * headlines beyond the brief are design drafts that need a native-speaker review (design/assumptions.md AS-05).
 *
 * Nothing here types a price, time, number or handle: they are filled in from settings, pricing rules
 * and plans, so editing those in the admin (Stage 3) updates this copy too.
 */
import { formatRs, formatTime12h } from '@/lib/format';
import { describeSkipCutoff } from './derive';
import type { PageCopy, PricingRules, SiteSettings } from './types';

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

export interface CopyInputs {
  settings: SiteSettings;
  rules: PricingRules;
  /** Lowest per-meal plan price, or null when there is no per-meal plan. */
  mealsFrom: number | null;
}

export function buildPageCopy({ settings, rules, mealsFrom }: CopyInputs): PageCopy {
  const lunch = formatTime12h(settings.meals.lunch.deliveredBy);
  const dinner = formatTime12h(settings.meals.dinner.deliveredBy);
  const mealsFromText = mealsFrom === null ? null : `Meals from ${formatRs(mealsFrom)}`;
  const savingText = `save ${rules.monthlySavingPercent}% when you pay monthly`;

  return {
    draft: true,
    home: {
      eyebrow: settings.areaServed,
      headline: 'Bhook lagi? Khana hazir.',
      tagline: settings.tagline,
      lede: 'Your favourite home-style meal, on time, every day.',
      benefitsEyebrow: 'Why Tiffin Box',
      benefitsHeadline: 'Khana, bina jhanjhat.',
      benefits: [
        {
          title: 'Waqt par, har roz',
          text: `Lunch by ${lunch}, dinner by ${dinner}. Sealed in tiffin boxes so it stays hot and clean.`,
        },
        {
          title: 'Ghar jaisa swaad',
          text: 'Home-style Pakistani food that tastes like Ammi made it.',
        },
        {
          title: 'Munasib daam',
          text: `${mealsFromText ? `${mealsFromText}. ` : ''}Pay weekly or monthly, and ${savingText}.`,
        },
      ],
      audienceEyebrow: 'Who we serve',
      audienceHeadline: 'Aap ke liye.',
      audiences: [
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
      ],
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
          text: `Choose weekly or monthly and pay by ${joinList(settings.paymentMethods)}.`,
        },
        {
          title: 'Eat on time',
          text: `Your first meal arrives the next day: lunch by ${lunch}, dinner by ${dinner}.`,
        },
      ],
    },
    menuIntro: 'Every lunch and dinner comes with fresh roti unless it is a rice dish.',
    planNote: 'Budget is daal or sabzi + 2 roti; Office Lunch is lunch only, Mon–Sat.',
    plansLede: `${mealsFrom === null ? 'Pick the plan that suits you' : `Meals start at ${formatRs(mealsFrom)}`}, and monthly plans save ${rules.monthlySavingPercent}%. All prices are in Pakistani Rupees.`,
    customizeIntro:
      'Any meal can be swapped for another dish from this list. Tell us on WhatsApp which one you want.',
    about: {
      headline: 'Ghar se door, ghar ka swaad.',
      mission:
        'Our mission: give people who live away from home, or have no time to cook, food that tastes like home at a fair weekly price.',
      story: '[client to supply, Q-14]',
    },
    howItWorks: {
      headline: 'Ordering is easy.',
      lede: 'Three steps and one message.',
      weeklyMenuLine:
        'The weekly menu is shared every Sunday evening on WhatsApp, Instagram and the website.',
      skip: `Up to ${settings.maxSkipsPerWeek} skips a week. Skipped meals are added to the end of your plan. Tell us on WhatsApp before the cut-off.`,
      pause: 'Going home or on leave? Pause the plan on WhatsApp and restart when you’re back.',
      packaging: 'Meals come sealed in tiffin boxes so they stay hot and clean.',
      paymentIntro: 'You pay in advance, weekly or monthly.',
      paymentPoints: [
        { label: 'Methods', text: `${joinList(settings.paymentMethods)}.` },
        { label: 'Weekly plans', text: 'paid before the week starts (Sunday).' },
        {
          label: 'Monthly plans',
          text: `paid before the month starts; ${rules.monthlySavingPercent}% cheaper than weekly.`,
        },
        { label: 'Offices', text: 'one monthly invoice for the whole team.' },
        { label: 'Receipts', text: 'sent on WhatsApp after every payment.' },
      ],
    },
    priceDisclaimer:
      'Prices depend on our supplier’s rates and may change. We confirm your price on WhatsApp before you pay.',
  };
}

/** Skip cut-off rows for the How it works table. */
export function skipRows(settings: SiteSettings) {
  return (['breakfast', 'lunch', 'dinner'] as const).map((key) => {
    const meal = settings.meals[key];
    return {
      key,
      label: meal.label,
      deliveredBy: formatTime12h(meal.deliveredBy),
      skipBefore: describeSkipCutoff(meal.skipCutoff),
    };
  });
}
