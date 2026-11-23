import { describe, expect, it } from 'vitest';
import {
  buildSlots,
  dayFromDb,
  dayToDb,
  mapCustomer,
  mapCustomerRow,
  mapMenuWeek,
  mapPaymentRow,
  mapPlan,
  mapSiteSettings,
  matchesCustomerSearch,
  menuStatusFromDb,
  phoneFromDb,
  phoneToDb,
  siteSettingsToDb,
  slotsToDb,
  type CustomerDb,
  type CustomerSummaryDb,
  type MenuSlotDb,
  type PlanDb,
  type SiteSettingsDb,
} from '@/admin/server/mappers';
import type { MenuSlot, SubscriptionRow } from '@/admin/types';

describe('contract translations (docs/database.md sec. 10)', () => {
  it('day index: front end 0..6 <-> database 1..7', () => {
    expect([0, 1, 6].map(dayToDb)).toEqual([1, 2, 7]);
    expect([1, 2, 7].map(dayFromDb)).toEqual([0, 1, 6]);
  });

  it('menu status: published -> live, others unchanged, unknown -> draft', () => {
    expect(menuStatusFromDb('published')).toBe('live');
    expect(menuStatusFromDb('scheduled')).toBe('scheduled');
    expect(menuStatusFromDb('past')).toBe('past');
    expect(menuStatusFromDb('draft')).toBe('draft');
    expect(menuStatusFromDb('something else')).toBe('draft');
  });

  it('phone: local 03XXXXXXXXX <-> +923XXXXXXXXX; anonymised null -> empty', () => {
    expect(phoneToDb('03001234567')).toBe('+923001234567');
    expect(phoneFromDb('+923001234567')).toBe('03001234567');
    expect(phoneFromDb(null)).toBe('');
    expect(phoneToDb('not a number')).toBe('not a number');
    expect(phoneFromDb('+14155550100')).toBe('+14155550100');
  });
});

describe('menu slots', () => {
  const rows: MenuSlotDb[] = [
    { day_of_week: 1, meal: 'lunch', dish_text: 'Aloo qeema', not_served: false },
    { day_of_week: 7, meal: 'dinner', dish_text: '', not_served: true },
  ];

  it('always builds 21 slots, day-then-meal, with 0-based days', () => {
    const slots = buildSlots(rows);
    expect(slots).toHaveLength(21);
    expect(slots[0]).toEqual({ day: 0, meal: 'breakfast', dishText: '', notServed: false });
    expect(slots[1]).toEqual({ day: 0, meal: 'lunch', dishText: 'Aloo qeema', notServed: false });
    expect(slots[20]).toEqual({ day: 6, meal: 'dinner', dishText: '', notServed: true });
  });

  it('writes slots to the database shape (1..7, trimmed, not-served text cleared, photo kept)', () => {
    const slots: MenuSlot[] = [
      { day: 0, meal: 'lunch', dishText: '  Daal  ', notServed: false },
      { day: 6, meal: 'dinner', dishText: 'ignored', notServed: true },
    ];
    const out = slotsToDb(slots, new Map([['1/lunch', 'media-1']]));
    expect(out).toEqual([
      { day_of_week: 1, meal: 'lunch', dish_text: 'Daal', not_served: false, media_id: 'media-1' },
      { day_of_week: 7, meal: 'dinner', dish_text: '', not_served: true, media_id: null },
    ]);
  });

  it('maps a week with its derived status and released copy', () => {
    const view = mapMenuWeek(
      {
        id: 'w1',
        week_start: '2026-11-23',
        go_live_at: '2026-11-22T13:00:00+00:00',
        live_payload: { slots: rows },
      },
      rows,
      { id: 'w1', status: 'published', differs_from_released: true },
    );
    expect(view.status).toBe('live');
    expect(view.hasUnpublishedEdits).toBe(true);
    expect(view.releasedSlots).toHaveLength(21);
    const draft = mapMenuWeek(
      { id: 'w2', week_start: '2026-11-30', go_live_at: null, live_payload: null },
      [],
      { id: 'w2', status: 'draft', differs_from_released: false },
    );
    expect(draft.releasedSlots).toBeNull();
    expect(draft.status).toBe('draft');
  });
});

describe('customers and statuses come from the views unchanged', () => {
  const dbRow: CustomerDb = {
    id: 'c1',
    type: 'office',
    name: 'Office Sample',
    phone_e164: '+923000000001',
    address_text: 'Hall 2',
    org_name: 'Sample Org',
    contact_person: 'Sample Person',
    member_count: 22,
    notes: '',
    archived_at: null,
  };
  const sub = { id: 's1', status: 'active', renewalDue: true } as unknown as SubscriptionRow;

  it('maps a customer to the front end shape (local phone)', () => {
    const c = mapCustomer(dbRow);
    expect(c.phone).toBe('03000000001');
    expect(c.orgName).toBe('Sample Org');
    expect(c.memberCount).toBe(22);
  });

  it('uses the customer_summary view for statuses; does not recompute them', () => {
    const summary: CustomerSummaryDb = {
      customer_id: 'c1',
      current_subscription_id: 's1',
      current_status: 'active',
      subscription_statuses: ['active', 'expired'],
      renewal_due: true,
      payment_status: 'overdue',
      balance: 8500,
    };
    const row = mapCustomerRow(mapCustomer(dbRow), summary, [sub]);
    expect(row.current).toBe(sub);
    expect(row.subscriptionStatuses).toEqual(['active', 'expired']);
    expect(row.paymentStatus).toBe('overdue');
    expect(row.renewalDue).toBe(true);
    const none = mapCustomerRow(mapCustomer(dbRow), undefined, []);
    expect(none).toMatchObject({
      current: null,
      paymentStatus: null,
      renewalDue: false,
      subscriptionStatuses: [],
    });
  });

  it('searches name, organisation and phone digits; a text search with digits stays a name search', () => {
    const c = mapCustomer(dbRow);
    expect(matchesCustomerSearch(c, 'office')).toBe(true);
    expect(matchesCustomerSearch(c, 'sample person')).toBe(true);
    expect(matchesCustomerSearch(c, '0300-0000001')).toBe(true);
    expect(matchesCustomerSearch(c, '0300')).toBe(true);
    expect(matchesCustomerSearch(c, 'Office Sample 03')).toBe(false);
    expect(matchesCustomerSearch(c, '')).toBe(true);
    expect(matchesCustomerSearch({ ...c, phone: '' }, '0300')).toBe(false);
  });

  it('maps a payment with the embedded customer and plan names', () => {
    const row = mapPaymentRow({
      id: 'p1',
      customer_id: 'c1',
      subscription_id: 's1',
      amount: 4200,
      method: 'easypaisa',
      paid_on: '2026-11-20',
      covers_from: '2026-11-23',
      covers_to: '2026-11-29',
      reference: 'EP123',
      note: '',
      voided_at: null,
      void_reason: '',
      customers: { name: 'Student Sample 01' },
      subscriptions: { plan_name_snapshot: 'Budget' },
    });
    expect(row).toMatchObject({
      customerName: 'Student Sample 01',
      planName: 'Budget',
      amount: 4200,
      voidReason: '',
    });
  });
});

describe('site settings, plans', () => {
  const settingsDb: SiteSettingsDb = {
    business_name: 'Tiffin Box',
    tagline: 'Ghar ka khana',
    whatsapp_number: '920000000000',
    instagram_handle: 'tiffinbox.lhr',
    order_hours: '9 to 9',
    last_order_time: '',
    area_served: 'Johar Town',
    delivery_area_text: 'Around UMT',
    delivery_boundary_text: '',
    legal_name_and_address: '',
    delivery_times: { breakfast: '08:00', lunch: '13:00', dinner: '20:00' },
    skip_cutoffs: { breakfast: '22:00', lunch: '10:00', dinner: '17:00' },
    skips_per_week: 3,
    payment_methods: ['JazzCash', 'Easypaisa'],
  };

  it('round-trips the settings, including the fields added for the public site', () => {
    const draft = mapSiteSettings(settingsDb);
    expect(draft.businessName).toBe('Tiffin Box');
    expect(draft.paymentMethods).toEqual(['JazzCash', 'Easypaisa']);
    expect(siteSettingsToDb(draft)).toEqual(settingsDb);
  });

  it('maps a plan: stored monthly override wins over the database-derived proposal', () => {
    const row: PlanDb = {
      id: 'p',
      name: 'Student',
      audience: '',
      meals_included: 'Lunch + dinner',
      price_unit: 'per_meal',
      unit_price: null,
      weekly_price: 8050,
      monthly_price: null,
      is_most_popular: true,
      is_active: true,
      sort_order: 2,
      price_note: 'Q-08',
    };
    expect(mapPlan(row, 30590).monthlyPrice).toBe(30590);
    expect(mapPlan({ ...row, monthly_price: 30000 }, 30590).monthlyPrice).toBe(30000);
    expect(mapPlan(row, null)).toMatchObject({
      unitPrice: null,
      priceNote: 'Q-08',
      monthlyPrice: null,
    });
    expect(mapPlan({ ...row, price_note: '' }, null)).not.toHaveProperty('priceNote');
  });
});
