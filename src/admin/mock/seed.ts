/**
 * MOCK DATA (Stage 2). The only place sample admin records live. Everything is obviously synthetic:
 * names such as "Student Sample 01", phones 0300-000000x, no real people or businesses (NFR-12).
 *
 * The sample "today" is Sunday 22 Nov 2026 (design/assumptions.md DN-06), so statuses are deterministic.
 * Prices and menu mirror the approved prototype and the public mock content; they are unconfirmed
 * until the client answers Q-07, Q-08, Q-10 and Q-26.
 */
import type {
  AuditEntry,
  ContentSnapshot,
  Customer,
  DishDraft,
  MediaItem,
  MenuSlot,
  MenuWeek,
  OpsSettings,
  PageImageSlot,
  Payment,
  Period,
  PlanDraft,
  Subscription,
} from '../types';

export const MOCK_TODAY = '2026-11-22';
/** Mock clock: sample "now" is 6:42 PM; it advances one minute per saved change. */
export const MOCK_NOW_BASE = '2026-11-22T18:42:00+05:00';
export const MOCK_ACTOR = 'Staff Sample';
export const MOCK_ACCOUNT = { displayName: 'Staff Sample', email: 'staff.sample@example.test' };

export type MockScenario = 'sample' | 'ready' | 'no_drafts' | 'fresh';

export const SCENARIO_LABEL: Record<MockScenario, string> = {
  sample: 'Sample data (changes pending, publish blocked until settings are filled in)',
  ready: 'Sample data, settings filled in (ready to publish)',
  no_drafts: 'Sample data, nothing pending (A-10 "no changes")',
  fresh: 'Empty (no customers, no content, no history)',
};

export interface MockRelease {
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string;
  snapshot: ContentSnapshot;
}

export interface MockState {
  settings: ContentSnapshot['settings'];
  ops: OpsSettings;
  pricingRules: ContentSnapshot['pricingRules'];
  plans: PlanDraft[];
  dishes: DishDraft[];
  addons: ContentSnapshot['addons'];
  faq: ContentSnapshot['faq'];
  media: MediaItem[];
  pageImages: Partial<Record<PageImageSlot, string>>;
  published: ContentSnapshot;
  releases: MockRelease[];
  menuWeeks: MenuWeek[];
  customers: Customer[];
  subscriptions: Subscription[];
  periods: Period[];
  payments: Payment[];
  audit: AuditEntry[];
}

// ---------- Menu ----------

const MEALS = ['breakfast', 'lunch', 'dinner'] as const;

/** Builds 21 slots from 7 rows of [breakfast, lunch, dinner] (Monday first). */
function slotsFrom(rows: readonly (readonly [string, string, string])[]): MenuSlot[] {
  return rows.flatMap((row, day) =>
    MEALS.map((meal, i) => ({ day, meal, dishText: row[i] ?? '', notServed: false })),
  );
}

const THIS_WEEK_LIVE = slotsFrom([
  ['Aloo paratha, raita, chai', 'Aloo qeema + roti', 'Chicken biryani + raita'],
  ['Omelette, paratha, chai', 'Daal chana + roti', 'Chicken qorma + roti'],
  ['Mooli paratha, raita, chai', 'Mix sabzi + roti', 'Daal chawal'],
  ['Fried egg, paratha, chai', 'Karhi pakora', 'Aloo qeema + shami kebab'],
  ['Aloo paratha, raita, chai', 'Chicken biryani', 'Maash daal'],
  ['Omelette, paratha, chai', 'White chanay + roti', 'Fried fish + salad'],
  ['Boiled eggs, paratha, chai', 'Saag + roti', 'Chicken qorma + roti'],
]);

/** This week's working copy: one slot edited since it went live (Friday dinner), so one menu change is pending. */
const THIS_WEEK_WORKING = THIS_WEEK_LIVE.map((slot) =>
  slot.day === 4 && slot.meal === 'dinner' ? { ...slot, dishText: 'Maash daal + roti' } : slot,
);

const NEXT_WEEK = slotsFrom([
  ['Aloo paratha, raita, chai', 'Chicken pulao + raita', 'Daal mash + roti'],
  ['Omelette, paratha, chai', 'Mix sabzi + roti', 'Chicken karahi + roti'],
  ['Halwa puri', 'Daal chana + roti', 'Aloo gobi + roti'],
  ['Fried egg, paratha, chai', 'Kofta + roti', 'Chicken biryani + raita'],
  ['Aloo paratha, raita, chai', 'Karhi pakora', 'Daal chawal'],
  ['Omelette, paratha, chai', 'White chanay + roti', 'Fried fish + salad'],
  ['Boiled eggs, paratha, chai', 'Saag + roti', 'Chicken qorma + roti'],
]);

// ---------- Content ----------

function baseContent(): ContentSnapshot {
  return {
    settings: {
      whatsappNumber: '',
      instagramHandle: 'tiffinbox.lhr',
      orderHours: '',
      lastOrderTime: '',
      deliveryAreaText:
        'Johar Town, Lahore, including hostels and offices around UMT. More areas are coming soon.',
      deliveryTimes: { breakfast: '08:00', lunch: '13:00', dinner: '20:00' },
      skipCutoffs: { breakfast: '22:00', lunch: '10:00', dinner: '17:00' },
      skipsPerWeek: 3,
    },
    pricingRules: {
      monthlySavingPercent: 5,
      breakfastAddonPrice: 350,
      teamDealText: 'Offices with 10 or more people get a team discount and one monthly invoice.',
      teamMinPeople: 10,
    },
    plans: [
      {
        id: 'plan-budget',
        name: 'Budget',
        audience: 'Hostel students',
        mealsIncluded: 'Lunch + dinner, daal or sabzi + 2 roti',
        priceUnit: 'per_meal',
        unitPrice: 300,
        weeklyPrice: 4200,
        isMostPopular: false,
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 'plan-student',
        name: 'Student',
        audience: 'Students wanting the full menu',
        mealsIncluded: 'Lunch + dinner, full weekly menu',
        priceUnit: 'per_meal',
        unitPrice: 575,
        weeklyPrice: 8050,
        isMostPopular: true,
        isActive: true,
        sortOrder: 2,
        priceNote:
          'The brief prints a range for this price. The figure that matches the weekly price is used here. Client to confirm one price (Q-08); the plan stays unpublished until then.',
      },
      {
        id: 'plan-office',
        name: 'Office Lunch',
        audience: 'Offices and working people',
        mealsIncluded: 'Lunch only, Mon–Sat, by 1 PM',
        priceUnit: 'per_meal',
        unitPrice: 550,
        weeklyPrice: 3300,
        isMostPopular: false,
        isActive: true,
        sortOrder: 3,
      },
      {
        id: 'plan-all3',
        name: 'All 3 Meals',
        audience: 'People who don’t cook at all',
        mealsIncluded: 'Breakfast + lunch + dinner',
        priceUnit: 'per_day',
        unitPrice: 1500,
        weeklyPrice: 10500,
        isMostPopular: false,
        isActive: true,
        sortOrder: 4,
        priceNote: 'Priced per day, not per meal.',
      },
    ],
    dishes: [
      ['dish-daal-sabzi', 'Daal or sabzi', '2 roti', 400, null],
      ['dish-daal-chawal', 'Daal chawal', 'Full plate', 550, 'media-3'],
      ['dish-chicken-qorma', 'Chicken qorma', 'Half + 2 roti', 650, null],
      ['dish-aloo-qeema', 'Aloo qeema', 'Half + 2 roti', 650, null],
      ['dish-chicken-biryani', 'Chicken biryani', 'Full plate', 700, null],
      ['dish-fried-fish', 'Fried fish', '250 g + 2 roti', 750, null],
    ].map(([id, name, comesWith, price, mediaId], i) => ({
      id: String(id),
      name: String(name),
      comesWith: String(comesWith),
      price: Number(price),
      mediaId: mediaId === null ? null : String(mediaId),
      sortOrder: i + 1,
      isHidden: false,
    })),
    addons: [
      ['addon-achaar', 'Achaar', 30],
      ['addon-ketchup', 'Ketchup', 20],
      ['addon-raita', 'Raita', 80],
      ['addon-salad', 'Salad', 80],
      ['addon-roti', 'Extra roti', 30],
      ['addon-shami', 'Shami kebab', 90],
    ].map(([id, name, price], i) => ({
      id: String(id),
      name: String(name),
      price: Number(price),
      sortOrder: i + 1,
      isHidden: false,
    })),
    faq: [
      [
        'faq-where',
        'Where do you deliver?',
        'Johar Town, Lahore, including hostels and offices around UMT. More areas are coming soon.',
      ],
      [
        'faq-when',
        'When does food arrive?',
        'Breakfast by 8 AM, lunch by 1 PM and dinner by 8 PM.',
      ],
      [
        'faq-change',
        "Can I change a dish I don't like?",
        'Yes. Swap it for any dish on our Customize list; custom dishes cost a little more.',
      ],
      [
        'faq-home',
        'What if I go home for a few days?',
        'Skip up to 3 meals a week, or pause your plan on WhatsApp. Skipped meals are added to the end of your plan.',
      ],
      [
        'faq-pay',
        'How do I pay?',
        'JazzCash, Easypaisa or bank transfer, before your week or month starts.',
      ],
      [
        'faq-office',
        'Is there a discount for offices?',
        'Yes. Teams of 10 or more get a discount and one monthly bill.',
      ],
      [
        'faq-start',
        'How do I start?',
        'Send “HI” on WhatsApp. Your first meal can arrive the next day.',
      ],
    ].map(([id, question, answer], i) => ({
      id: String(id),
      question: String(question),
      answer: String(answer),
      sortOrder: i + 1,
      isHidden: false,
    })),
  };
}

const MEDIA: MediaItem[] = [1, 2, 3, 4].map((n) => ({
  id: `media-${n}`,
  fileName: `sample-${n}.jpg`,
  altText: `Sample tiffin photo ${n} (placeholder)`,
  width: 1600,
  height: 1200,
  bytes: 480_000 + n * 1000,
}));

// ---------- Customers, subscriptions, payments ----------

function customer(
  id: string,
  type: Customer['type'],
  name: string,
  n: number,
  address: string,
  extra: Partial<Customer> = {},
): Customer {
  return {
    id,
    type,
    name,
    phone: `0300000000${n}`,
    address,
    orgName: '',
    contactPerson: '',
    memberCount: null,
    notes: '',
    archivedAt: null,
    ...extra,
  };
}

const CUSTOMERS: Customer[] = [
  customer('c-5b1d92e0', 'student', 'Student Sample 01', 1, 'Hostel Sample A, Room 12, Johar Town'),
  customer('c-8a47f3c1', 'student', 'Student Sample 02', 2, 'Hostel Sample B, Room 3, Johar Town'),
  customer('c-2e9c60d4', 'home', 'Home Sample 03', 3, 'House Sample 3, Street 4, Johar Town'),
  customer('c-71f0ab35', 'office', 'Office Sample Ltd.', 4, 'Ltd Sample Building, Block B', {
    orgName: 'Office Sample Ltd.',
    contactPerson: 'Contact Person 04 (sample)',
    memberCount: 12,
  }),
  customer('c-c3d85e17', 'student', 'Student Sample 05', 5, 'Hostel Sample A, Room 21, Johar Town'),
  customer('c-94a6b2f8', 'office', 'Office Sample Traders', 6, 'Traders Sample Building, Block C', {
    orgName: 'Office Sample Traders',
    contactPerson: 'Contact Person 06 (sample)',
    memberCount: 10,
  }),
  customer('c-1d6e7a93', 'home', 'Home Sample 07', 7, 'House Sample 7, Street 9, Johar Town'),
  customer('c-e05f48b2', 'student', 'Student Sample 08', 8, 'Hostel Sample C, Room 5, Johar Town'),
];

function sub(
  id: string,
  customerId: string,
  planId: string,
  planName: string,
  term: Subscription['term'],
  startDate: string,
  endDate: string,
  amountPerPeriod: number,
  extra: Partial<Subscription> = {},
): Subscription {
  return {
    id,
    customerId,
    planId,
    planName,
    term,
    startDate,
    endDate,
    breakfastAddon: false,
    amountPerPeriod,
    amountNote: '',
    manualState: 'active',
    manualStateOn: null,
    renewedFromId: null,
    notes: '',
    ...extra,
  };
}

const SUBSCRIPTIONS: Subscription[] = [
  sub(
    's-a1',
    'c-5b1d92e0',
    'plan-student',
    'Student',
    'monthly',
    '2026-11-09',
    '2026-12-06',
    30590,
  ),
  sub('s-a2', 'c-8a47f3c1', 'plan-budget', 'Budget', 'weekly', '2026-11-16', '2026-11-22', 4200, {
    manualState: 'paused',
    manualStateOn: '2026-11-20',
  }),
  sub(
    's-a3',
    'c-2e9c60d4',
    'plan-all3',
    'All 3 Meals',
    'weekly',
    '2026-11-16',
    '2026-11-22',
    10500,
  ),
  sub(
    's-a4',
    'c-71f0ab35',
    'plan-office',
    'Office Lunch',
    'monthly',
    '2026-11-01',
    '2026-11-28',
    12540,
  ),
  sub('s-a5', 'c-c3d85e17', 'plan-student', 'Student', 'weekly', '2026-11-23', '2026-11-29', 8050),
  sub(
    's-a6',
    'c-94a6b2f8',
    'plan-office',
    'Office Lunch',
    'monthly',
    '2026-11-01',
    '2026-11-28',
    12540,
  ),
  sub('s-a7', 'c-1d6e7a93', 'plan-budget', 'Budget', 'weekly', '2026-11-23', '2026-11-29', 4200),
  sub('s-a8', 'c-e05f48b2', 'plan-budget', 'Budget', 'weekly', '2026-11-09', '2026-11-15', 4200),
];

/** One period per subscription, due the day before it starts (A-22). */
function periodFor(s: Subscription, dueDate: string): Period {
  return {
    id: `per-${s.id}`,
    subscriptionId: s.id,
    periodStart: s.startDate,
    periodEnd: s.endDate,
    amountDue: s.amountPerPeriod,
    dueDate,
  };
}

const PERIODS: Period[] = [
  periodFor(SUBSCRIPTIONS[0] as Subscription, '2026-11-08'),
  periodFor(SUBSCRIPTIONS[1] as Subscription, '2026-11-15'),
  periodFor(SUBSCRIPTIONS[2] as Subscription, '2026-11-15'),
  periodFor(SUBSCRIPTIONS[3] as Subscription, '2026-10-31'),
  periodFor(SUBSCRIPTIONS[4] as Subscription, '2026-11-22'),
  periodFor(SUBSCRIPTIONS[5] as Subscription, '2026-10-31'),
  periodFor(SUBSCRIPTIONS[6] as Subscription, '2026-11-22'),
  periodFor(SUBSCRIPTIONS[7] as Subscription, '2026-11-08'),
];

function pay(
  id: string,
  customerId: string,
  subscriptionId: string,
  amount: number,
  method: Payment['method'],
  paidOn: string,
  coversFrom: string,
  coversTo: string,
  reference: string,
): Payment {
  return {
    id,
    customerId,
    subscriptionId,
    amount,
    method,
    paidOn,
    coversFrom,
    coversTo,
    reference,
    note: '',
    voidedAt: null,
    voidReason: '',
  };
}

const PAYMENTS: Payment[] = [
  pay(
    'p-b1',
    'c-5b1d92e0',
    's-a1',
    30590,
    'easypaisa',
    '2026-11-08',
    '2026-11-09',
    '2026-12-06',
    'EP-0001',
  ),
  pay(
    'p-b2',
    'c-8a47f3c1',
    's-a2',
    4200,
    'jazzcash',
    '2026-11-15',
    '2026-11-16',
    '2026-11-22',
    'JC-0002',
  ),
  pay(
    'p-b3',
    'c-71f0ab35',
    's-a4',
    12540,
    'bank_transfer',
    '2026-10-31',
    '2026-11-01',
    '2026-11-28',
    'BT-0003',
  ),
  pay(
    'p-b4',
    'c-94a6b2f8',
    's-a6',
    6000,
    'bank_transfer',
    '2026-10-31',
    '2026-11-01',
    '2026-11-28',
    'BT-0004',
  ),
];

const AUDIT: AuditEntry[] = [
  {
    id: 'a-6',
    at: '2026-11-22T18:00:00+05:00',
    actor: 'Owner Sample',
    recordType: 'Content publish',
    summary: 'Published version v12 (menu 23–29 Nov live).',
  },
  {
    id: 'a-5',
    at: '2026-11-22T17:48:00+05:00',
    actor: 'Staff Sample',
    recordType: 'Plans',
    summary: 'Student: price per meal',
    diff: { from: 'Rs 550', to: 'Rs 575' },
  },
  {
    id: 'a-4',
    at: '2026-11-22T16:12:00+05:00',
    actor: 'Staff Sample',
    recordType: 'Subscription',
    summary: 'Created: Student weekly 23 – 29 Nov, Rs 8,050 (Student Sample 05)',
  },
  {
    id: 'a-3',
    at: '2026-11-22T16:10:00+05:00',
    actor: 'Staff Sample',
    recordType: 'Customer',
    summary: 'Created Student Sample 05 (student)',
  },
  {
    id: 'a-2',
    at: '2026-11-21T19:20:00+05:00',
    actor: 'Owner Sample',
    recordType: 'Payment',
    summary: 'Edited payment of Office Sample Traders: amount',
    diff: { from: 'Rs 5,000', to: 'Rs 6,000' },
    earlierValues:
      'Previous values kept: amount Rs 5,000, method Bank transfer, ref BT-0004, date 31 Oct.',
  },
  {
    id: 'a-1',
    at: '2026-11-21T19:05:00+05:00',
    actor: 'Owner Sample',
    recordType: 'Payment',
    summary: 'Recorded Rs 5,000, bank transfer (Office Sample Traders)',
  },
];

// ---------- Scenarios ----------

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Fresh state for a scenario. Always returns new objects, so a reset never shares references. */
export function buildScenario(scenario: MockScenario): MockState {
  const content = baseContent();
  const live = clone(content);
  // Published (live v12) differs from the drafts in two places: Student price and one FAQ answer.
  const student = live.plans.find((p) => p.id === 'plan-student');
  if (student) student.unitPrice = 550;
  const pay = live.faq.find((f) => f.id === 'faq-pay');
  if (pay) pay.answer = 'JazzCash, Easypaisa or bank transfer.';
  const v11 = clone(live);
  const v11Student = v11.plans.find((p) => p.id === 'plan-student');
  if (v11Student) v11Student.unitPrice = 500;

  const state: MockState = {
    settings: clone(content.settings),
    ops: { renewalWindowDays: 7, overdueGraceDays: 0 },
    pricingRules: clone(content.pricingRules),
    plans: clone(content.plans),
    dishes: clone(content.dishes),
    addons: clone(content.addons),
    faq: clone(content.faq),
    media: clone(MEDIA),
    pageImages: { home_hero: 'media-1', og_share: 'media-2' },
    published: live,
    releases: [
      {
        version: 12,
        publishedAt: '2026-11-22T18:00:00+05:00',
        publishedBy: 'Owner Sample',
        note: '',
        snapshot: clone(live),
      },
      {
        version: 11,
        publishedAt: '2026-11-15T18:04:00+05:00',
        publishedBy: MOCK_ACTOR,
        note: '',
        snapshot: v11,
      },
    ],
    menuWeeks: [
      {
        id: 'mw-this',
        weekStart: '2026-11-23',
        slots: clone(THIS_WEEK_WORKING),
        goLiveAt: '2026-11-22T18:00:00+05:00',
        releasedSlots: clone(THIS_WEEK_LIVE),
      },
      {
        id: 'mw-next',
        weekStart: '2026-11-30',
        slots: clone(NEXT_WEEK),
        goLiveAt: '2026-11-29T18:00:00+05:00',
        releasedSlots: clone(NEXT_WEEK),
      },
    ],
    customers: clone(CUSTOMERS),
    subscriptions: clone(SUBSCRIPTIONS),
    periods: clone(PERIODS),
    payments: clone(PAYMENTS),
    audit: clone(AUDIT),
  };

  if (scenario === 'ready' || scenario === 'no_drafts') {
    // Settings filled in with obviously synthetic values so the publish check can pass.
    state.settings.whatsappNumber = '920000000000';
    state.settings.orderHours = 'Sample hours (placeholder)';
    state.published.settings = clone(state.settings);
  }
  if (scenario === 'no_drafts') {
    state.published = clone({
      settings: state.settings,
      pricingRules: state.pricingRules,
      plans: state.plans,
      dishes: state.dishes,
      addons: state.addons,
      faq: state.faq,
    });
    state.releases[0] = { ...(state.releases[0] as MockRelease), snapshot: clone(state.published) };
    const thisWeek = state.menuWeeks[0];
    if (thisWeek) thisWeek.slots = clone(thisWeek.releasedSlots ?? thisWeek.slots);
  }
  if (scenario === 'fresh') {
    state.customers = [];
    state.subscriptions = [];
    state.periods = [];
    state.payments = [];
    state.audit = [];
    state.dishes = [];
    state.addons = [];
    state.faq = [];
    state.media = [];
    state.pageImages = {};
    state.menuWeeks = [
      {
        id: 'mw-this',
        weekStart: '2026-11-23',
        slots: clone(THIS_WEEK_LIVE),
        goLiveAt: '2026-11-22T18:00:00+05:00',
        releasedSlots: clone(THIS_WEEK_LIVE),
      },
    ];
    state.settings.whatsappNumber = '920000000000';
    state.settings.orderHours = 'Sample hours (placeholder)';
    state.plans = clone(content.plans);
    state.plans.forEach((p) => {
      if (p.id === 'plan-student') p.unitPrice = 550;
    });
    state.published = clone({
      settings: state.settings,
      pricingRules: state.pricingRules,
      plans: state.plans,
      dishes: [],
      addons: [],
      faq: [],
    });
    state.releases = [
      {
        version: 1,
        publishedAt: '2026-11-22T18:00:00+05:00',
        publishedBy: MOCK_ACTOR,
        note: '',
        snapshot: clone(state.published),
      },
    ];
  }
  return state;
}
