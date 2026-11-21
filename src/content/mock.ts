/**
 * MOCK CONTENT (Stage 2). This is the ONLY file that holds sample data for the public site.
 *
 * Everything here is seeded from the client brief as recorded in docs/PRD.md ("Reference data from the
 * brief") and the approved prototype. It is unconfirmed: prices and menu are sample content until the
 * client confirms them (Q-07, Q-08, Q-26), and bracketed values are placeholders for facts we do not
 * have yet (Q-04 WhatsApp number, Q-06 order hours, Q-11 delivery boundary, Q-27 legal name/address).
 *
 * Stage 3 replaces `getContentSnapshot()` in ./index.ts with the Supabase-backed reader
 * (`get_public_content`, architecture sec. 5). Pages and components never import this file.
 */
import type { ContentSnapshot } from './types';

export const MOCK_CONTENT: ContentSnapshot = {
  info: {
    source: 'mock',
    note:
      'Logo, photos, WhatsApp number, order hours and website are placeholders ' +
      'until the client supplies them. Prices and menu are unconfirmed.',
  },

  settings: {
    businessName: 'Tiffin Box',
    tagline: 'Ghar ka khana, Ammi ke pyaar jaisa',
    whatsappNumber: '[WhatsApp number]',
    instagramHandle: 'tiffinbox.lhr',
    orderHours: '[order hours]',
    areaServed: 'Johar Town, Lahore',
    areaServedDetail:
      'Johar Town, Lahore, including hostels, offices and homes around UMT. Other areas will be added later.',
    deliveryBoundary: '[delivery area text, Q-11]',
    legalNameAndAddress: '[Business legal name / address]',
    meals: {
      breakfast: {
        label: 'Breakfast',
        deliveredBy: '08:00',
        skipCutoff: { time: '22:00', day: 'night_before' },
      },
      lunch: {
        label: 'Lunch',
        deliveredBy: '13:00',
        skipCutoff: { time: '10:00', day: 'same_day' },
      },
      dinner: {
        label: 'Dinner',
        deliveredBy: '20:00',
        skipCutoff: { time: '17:00', day: 'same_day' },
      },
    },
    maxSkipsPerWeek: 3,
    paymentMethods: ['JazzCash', 'Easypaisa', 'bank transfer'],
  },

  plans: [
    {
      id: 'plan-budget',
      name: 'Budget',
      audience: 'Hostel students',
      includes: ['Lunch + dinner', 'Daal or sabzi + 2 roti'],
      price: { from: 300 },
      priceUnit: 'meal',
      weeklyPrice: 4200,
      mostPopular: false,
      priceUnresolved: false,
    },
    {
      id: 'plan-student',
      name: 'Student',
      audience: 'Students wanting the full menu',
      includes: ['Lunch + dinner', 'Full weekly menu'],
      // The brief prints a range (Q-08). One confirmed figure is needed before launch, so this plan is flagged.
      price: { from: 550, to: 600 },
      priceUnit: 'meal',
      weeklyPrice: 8050,
      mostPopular: true,
      priceUnresolved: true,
    },
    {
      id: 'plan-office',
      name: 'Office Lunch',
      audience: 'Offices and working people',
      includes: ['Lunch only, Mon–Sat', 'Delivered by 1 PM'],
      price: { from: 550 },
      priceUnit: 'meal',
      weeklyPrice: 3300,
      mostPopular: false,
      priceUnresolved: false,
    },
    {
      id: 'plan-all3',
      name: 'All 3 Meals',
      audience: 'People who don’t cook at all',
      includes: ['Breakfast + lunch + dinner'],
      price: { from: 1500 },
      priceUnit: 'day',
      weeklyPrice: 10500,
      mostPopular: false,
      priceUnresolved: false,
    },
  ],

  pricingRules: {
    monthlySavingPercent: 5,
    breakfastAddOnPerDay: 350,
    teamDeal: { minPeople: 10, text: 'a team discount and one monthly invoice' },
  },

  // Sample week from the brief. Dates are Asia/Karachi calendar dates.
  menu: {
    weekStart: '2026-11-23',
    weekEnd: '2026-11-29',
    publishedAt: '2026-11-22T18:00:00+05:00',
    days: [
      {
        day: 'Monday',
        breakfast: 'Aloo paratha, raita, chai',
        lunch: 'Aloo qeema + roti',
        dinner: 'Chicken biryani + raita',
      },
      {
        day: 'Tuesday',
        breakfast: 'Omelette, paratha, chai',
        lunch: 'Daal chana + roti',
        dinner: 'Chicken qorma + roti',
      },
      {
        day: 'Wednesday',
        breakfast: 'Mooli paratha, raita, chai',
        lunch: 'Mix sabzi + roti',
        dinner: 'Daal chawal',
      },
      {
        day: 'Thursday',
        breakfast: 'Fried egg, paratha, chai',
        lunch: 'Karhi pakora',
        dinner: 'Aloo qeema + shami kebab',
      },
      {
        day: 'Friday',
        breakfast: 'Aloo paratha, raita, chai',
        lunch: 'Chicken biryani',
        dinner: 'Maash daal + roti',
      },
      {
        day: 'Saturday',
        breakfast: 'Omelette, paratha, chai',
        lunch: 'White chanay + roti',
        dinner: 'Fried fish + salad',
      },
      {
        day: 'Sunday',
        breakfast: 'Boiled eggs, paratha, chai',
        lunch: 'Saag + roti',
        dinner: 'Chicken qorma + roti',
      },
    ],
  },

  customDishes: [
    { id: 'dish-daal-sabzi', name: 'Daal or sabzi', comesWith: '2 roti', price: 400 },
    { id: 'dish-daal-chawal', name: 'Daal chawal', comesWith: 'Full plate', price: 550 },
    { id: 'dish-chicken-qorma', name: 'Chicken qorma', comesWith: 'Half + 2 roti', price: 650 },
    { id: 'dish-aloo-qeema', name: 'Aloo qeema', comesWith: 'Half + 2 roti', price: 650 },
    { id: 'dish-chicken-biryani', name: 'Chicken biryani', comesWith: 'Full plate', price: 700 },
    { id: 'dish-fried-fish', name: 'Fried fish', comesWith: '250 g + 2 roti', price: 750 },
  ],

  addOns: [
    { id: 'addon-achaar', name: 'Achaar', price: 30 },
    { id: 'addon-ketchup', name: 'Ketchup', price: 20 },
    { id: 'addon-raita', name: 'Raita', price: 80 },
    { id: 'addon-salad', name: 'Salad', price: 80 },
    { id: 'addon-roti', name: 'Extra roti', price: 30 },
    { id: 'addon-shami', name: 'Shami kebab', price: 90 },
  ],

  faq: [
    {
      id: 'faq-where',
      question: 'Where do you deliver?',
      answer:
        'Johar Town, Lahore, including hostels and offices around UMT. More areas are coming soon.',
    },
    {
      id: 'faq-when',
      question: 'When does food arrive?',
      answer: 'Breakfast by 8 AM, lunch by 1 PM and dinner by 8 PM.',
    },
    {
      id: 'faq-change',
      question: "Can I change a dish I don't like?",
      answer: 'Yes. Swap it for any dish on our Customize list; custom dishes cost a little more.',
    },
    {
      id: 'faq-home',
      question: 'What if I go home for a few days?',
      answer:
        'Skip up to 3 meals a week, or pause your plan on WhatsApp. Skipped meals are added to the end of your plan.',
    },
    {
      id: 'faq-pay',
      question: 'How do I pay?',
      answer: 'JazzCash, Easypaisa or bank transfer, before your week or month starts.',
    },
    {
      id: 'faq-office',
      question: 'Is there a discount for offices?',
      answer: 'Yes. Teams of 10 or more get a discount and one monthly bill.',
    },
    {
      id: 'faq-start',
      question: 'How do I start?',
      answer: 'Send “HI” on WhatsApp. Your first meal can arrive the next day.',
    },
  ],
};
