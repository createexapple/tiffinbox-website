import { describe, expect, it } from 'vitest';
import { parsePositiveRupees, parseWholeNumber } from '@/admin/validation/common';
import {
  validateAddon,
  validateAltText,
  validateDish,
  validateFaq,
  validateGoLive,
  validateMediaFile,
  validateMenuSlots,
  validatePasswordChange,
  validatePlan,
  validatePricingRules,
  validateSettings,
  type SettingsInput,
} from '@/admin/validation/content';
import {
  formatPhone,
  normalisePhone,
  validateCustomer,
  validatePayment,
  validateSubscription,
  validateVoidReason,
  type CustomerInput,
  type PaymentInput,
  type SubscriptionInput,
} from '@/admin/validation/operations';
import { validateLogin } from '@/admin/validation/auth';
import type { MenuSlot } from '@/admin/types';

describe('whole-rupee parsing (NFR-09, FR-16, FR-28)', () => {
  it('accepts whole numbers, with thousands commas', () => {
    expect(parseWholeNumber('575')).toBe(575);
    expect(parseWholeNumber(' 8,050 ')).toBe(8050);
  });
  it('rejects ranges, decimals, negatives, letters and empty text', () => {
    for (const bad of ['550-600', '550–600', '5.5', '-5', 'abc', '', ' ', '1e3', 'Rs 5']) {
      expect(parseWholeNumber(bad)).toBeNull();
    }
  });
  it('requires more than zero for rupees', () => {
    expect(parsePositiveRupees('0')).toBeNull();
    expect(parsePositiveRupees('1')).toBe(1);
  });
});

describe('Pakistani mobile numbers (FR-24)', () => {
  it('normalises local and international forms to 03XXXXXXXXX', () => {
    expect(normalisePhone('0300-0000001')).toBe('03000000001');
    expect(normalisePhone('0300 0000001')).toBe('03000000001');
    expect(normalisePhone('+92 300 0000001')).toBe('03000000001');
    expect(normalisePhone('923000000001')).toBe('03000000001');
    expect(normalisePhone('00923000000001')).toBe('03000000001');
    expect(normalisePhone('3000000001')).toBe('03000000001');
  });
  it('rejects short, long, non-mobile and non-numeric input', () => {
    for (const bad of ['0300 12', '', '0300-00000012', '0421234567', 'abc', '+1 555 0100']) {
      expect(normalisePhone(bad)).toBeNull();
    }
  });
  it('formats for display', () => {
    expect(formatPhone('03000000001')).toBe('0300-0000001');
  });
});

describe('customer form (FR-24)', () => {
  const ok: CustomerInput = {
    type: 'student',
    name: 'Student Sample 09',
    phone: '0300-0000009',
    address: '',
    orgName: '',
    contactPerson: '',
    memberCount: '',
    notes: '',
  };
  it('accepts name, phone and type; address is optional', () => {
    const result = validateCustomer(ok);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.phone).toBe('03000000009');
  });
  it('blocks a missing name and an invalid phone with field-level messages', () => {
    const result = validateCustomer({ ...ok, name: ' ', phone: '0300 12' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBeDefined();
      expect(result.errors.phone).toMatch(/valid Pakistani mobile/);
    }
  });
  it('requires organisation, contact person and a whole member count >= 1 for offices', () => {
    const office = { ...ok, type: 'office' as const };
    const result = validateCustomer(office);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'contactPerson',
        'memberCount',
        'orgName',
      ]);
    }
    const zero = validateCustomer({
      ...office,
      orgName: 'X',
      contactPerson: 'Y',
      memberCount: '0',
    });
    expect(zero.ok).toBe(false);
    const fine = validateCustomer({
      ...office,
      orgName: 'X',
      contactPerson: 'Y',
      memberCount: '12',
    });
    expect(fine.ok && fine.value.memberCount).toBe(12);
  });
  it('drops office fields when the type is not office', () => {
    const result = validateCustomer({ ...ok, orgName: 'Stale', memberCount: '5' });
    expect(result.ok && result.value.orgName).toBe('');
    expect(result.ok && result.value.memberCount).toBeNull();
  });
  it('rejects markup', () => {
    expect(validateCustomer({ ...ok, name: '<b>x</b>' }).ok).toBe(false);
  });
});

describe('subscription form (FR-26)', () => {
  const ok: SubscriptionInput = {
    planId: 'plan-student',
    term: 'weekly',
    startDate: '2026-11-23',
    endDate: '2026-11-29',
    breakfastAddon: false,
    amount: '8050',
    amountNote: '',
    manualState: 'active',
    notes: '',
  };
  const ctx = { planIds: ['plan-student'], suggestedAmount: 8050 };
  it('accepts a valid subscription', () => {
    expect(validateSubscription(ok, ctx).ok).toBe(true);
  });
  it('blocks an end date before the start date', () => {
    const result = validateSubscription(
      { ...ok, startDate: '2026-11-29', endDate: '2026-11-23' },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.endDate).toMatch(/before the start/);
  });
  it('allows a one-day subscription (end equals start)', () => {
    expect(validateSubscription({ ...ok, endDate: ok.startDate }, ctx).ok).toBe(true);
  });
  it('requires a whole-rupee amount greater than zero', () => {
    for (const amount of ['', '0', '-1', '80.5', 'abc']) {
      expect(validateSubscription({ ...ok, amount }, ctx).ok).toBe(false);
    }
  });
  it('requires a reason when the amount differs from the plan price (A-20)', () => {
    const changed = validateSubscription({ ...ok, amount: '7000' }, ctx);
    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.errors.amountNote).toBeDefined();
    expect(
      validateSubscription({ ...ok, amount: '7000', amountNote: 'Friend discount' }, ctx).ok,
    ).toBe(true);
  });
  it('needs no reason for monthly terms, where there is no suggested amount', () => {
    expect(
      validateSubscription(
        { ...ok, term: 'monthly', amount: '30590' },
        { ...ctx, suggestedAmount: null },
      ).ok,
    ).toBe(true);
  });
  it('rejects a plan that is not in the active list', () => {
    expect(validateSubscription({ ...ok, planId: 'gone' }, ctx).ok).toBe(false);
  });
});

describe('payment form (FR-28)', () => {
  const ok: PaymentInput = {
    subscriptionId: 's-1',
    coversFrom: '2026-11-23',
    coversTo: '2026-11-29',
    amount: '8050',
    paidOn: '2026-11-22',
    method: 'jazzcash',
    reference: '',
    note: '',
  };
  it('accepts a valid payment', () => {
    const result = validatePayment(ok);
    expect(result.ok && result.value.amount).toBe(8050);
  });
  it('blocks missing amount, date, method and period with field-level messages', () => {
    const result = validatePayment({ ...ok, amount: '', paidOn: '', method: '', coversFrom: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'amount',
        'coversFrom',
        'method',
        'paidOn',
      ]);
    }
  });
  it('rejects zero, negative and fractional amounts', () => {
    for (const amount of ['0', '-5', '100.50'])
      expect(validatePayment({ ...ok, amount }).ok).toBe(false);
  });
  it('rejects a covered period that ends before it starts', () => {
    expect(validatePayment({ ...ok, coversTo: '2026-11-01' }).ok).toBe(false);
  });
  it('requires a reason to void', () => {
    expect(validateVoidReason('')).not.toBeNull();
    expect(validateVoidReason('Entered twice')).toBeNull();
  });
});

describe('plans and pricing rules (FR-16)', () => {
  const plan = {
    name: 'Student',
    audience: 'Students',
    mealsIncluded: 'Lunch + dinner',
    unitPrice: '575',
    weeklyPrice: '8050',
    sortOrder: '2',
    isActive: true,
  };
  it('accepts whole-rupee prices', () => {
    expect(validatePlan(plan).ok).toBe(true);
  });
  it('rejects a range, a negative and a non-numeric price (Q-08 sample)', () => {
    for (const unitPrice of ['550–600', '-300', 'free', '0']) {
      const result = validatePlan({ ...plan, unitPrice });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.unitPrice).toMatch(/whole rupees/);
    }
  });
  it('validates pricing rules', () => {
    expect(
      validatePricingRules({
        monthlySavingPercent: '5',
        breakfastAddonPrice: '350',
        teamDealText: 'x',
      }).ok,
    ).toBe(true);
    expect(
      validatePricingRules({
        monthlySavingPercent: '150',
        breakfastAddonPrice: '350',
        teamDealText: '',
      }).ok,
    ).toBe(false);
    expect(
      validatePricingRules({
        monthlySavingPercent: '5',
        breakfastAddonPrice: '-1',
        teamDealText: '',
      }).ok,
    ).toBe(false);
  });
});

describe('dishes, add-ons and FAQ (FR-17..19)', () => {
  it('require a name and a whole-rupee price', () => {
    expect(
      validateDish({ name: 'Qorma', comesWith: '2 roti', price: '650', isHidden: false }).ok,
    ).toBe(true);
    expect(validateDish({ name: '', comesWith: '', price: '650', isHidden: false }).ok).toBe(false);
    expect(validateDish({ name: 'Qorma', comesWith: '', price: '6.5', isHidden: false }).ok).toBe(
      false,
    );
    expect(validateAddon({ name: 'Raita', price: '80', isHidden: false }).ok).toBe(true);
    expect(validateAddon({ name: 'Raita', price: '', isHidden: false }).ok).toBe(false);
  });
  it('FAQ takes plain text only', () => {
    expect(validateFaq({ question: 'Q?', answer: 'A.', isHidden: false }).ok).toBe(true);
    expect(validateFaq({ question: 'Q?', answer: '<script>x</script>', isHidden: false }).ok).toBe(
      false,
    );
  });
});

describe('site settings (FR-20, FR-27)', () => {
  const ok: SettingsInput = {
    whatsappNumber: '920000000000',
    instagramHandle: 'tiffinbox.lhr',
    orderHours: 'Sample hours',
    lastOrderTime: '',
    deliveryAreaText: 'Johar Town',
    deliveryTimes: { breakfast: '08:00', lunch: '13:00', dinner: '20:00' },
    skipCutoffs: { breakfast: '22:00', lunch: '10:00', dinner: '17:00' },
    skipsPerWeek: '3',
    renewalWindowDays: '7',
    overdueGraceDays: '0',
  };
  it('accepts valid settings, and an empty WhatsApp number (the client has not supplied it)', () => {
    expect(validateSettings(ok).ok).toBe(true);
    expect(validateSettings({ ...ok, whatsappNumber: '' }).ok).toBe(true);
  });
  it('requires the WhatsApp number in international digits-only format', () => {
    for (const bad of ['+92 300 0000000', '0300-0000000', '92300', 'abc']) {
      const result = validateSettings({ ...ok, whatsappNumber: bad });
      expect(result.ok).toBe(false);
    }
  });
  it('requires valid times', () => {
    const result = validateSettings({
      ...ok,
      deliveryTimes: { breakfast: '', lunch: '25:00', dinner: '20:00' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['deliveryTimes.breakfast']).toBeDefined();
      expect(result.errors['deliveryTimes.lunch']).toBeDefined();
    }
  });
  it('requires whole-number day counts', () => {
    expect(validateSettings({ ...ok, renewalWindowDays: '-1' }).ok).toBe(false);
    expect(validateSettings({ ...ok, overdueGraceDays: '1.5' }).ok).toBe(false);
  });
});

describe('password change (FR-13)', () => {
  it('needs the current password, 12+ characters and a matching repeat', () => {
    expect(validatePasswordChange({ current: '', next: 'short', repeat: 'other' })).toMatchObject({
      current: expect.any(String),
      next: expect.any(String),
      repeat: expect.any(String),
    });
    expect(
      validatePasswordChange({
        current: 'a',
        next: 'a-long-new-passphrase',
        repeat: 'a-long-new-passphrase',
      }),
    ).toEqual({});
  });
  it('refuses a new password equal to the current one', () => {
    const same = 'same-long-password';
    expect(validatePasswordChange({ current: same, next: same, repeat: same }).next).toBeDefined();
  });
});

describe('login form (A-01, mock auth)', () => {
  it('requires an email shaped like one and a non-empty password', () => {
    expect(validateLogin({ email: '', password: '' }).ok).toBe(false);
    expect(validateLogin({ email: 'not-an-email', password: 'x' }).ok).toBe(false);
    expect(validateLogin({ email: 'staff.sample@example.test', password: 'x' }).ok).toBe(true);
  });
});

describe('menu (FR-14, FR-15)', () => {
  const slot = (
    day: number,
    meal: MenuSlot['meal'],
    dishText: string,
    notServed = false,
  ): MenuSlot => ({
    day,
    meal,
    dishText,
    notServed,
  });
  it('refuses an empty slot unless it is marked not served', () => {
    expect(Object.keys(validateMenuSlots([slot(0, 'lunch', '')]))).toEqual(['0-lunch']);
    expect(validateMenuSlots([slot(0, 'lunch', '', true)])).toEqual({});
  });
  it('rejects over-long text and markup with a clear message', () => {
    expect(validateMenuSlots([slot(2, 'dinner', 'x'.repeat(121))])['2-dinner']).toMatch(/too long/);
    expect(validateMenuSlots([slot(2, 'dinner', '<b>Daal</b>')])['2-dinner']).toMatch(/plain text/);
    expect(validateMenuSlots([slot(2, 'dinner', 'x'.repeat(120))])).toEqual({});
  });
  it('requires a go-live time in the future', () => {
    const now = '2026-11-22T18:42:00+05:00';
    expect(validateGoLive('2026-11-29', '18:00', now)).toBeNull();
    expect(validateGoLive('2026-11-22', '18:00', now)).toMatch(/future/);
    expect(validateGoLive('', '18:00', now)).not.toBeNull();
    expect(validateGoLive('2026-11-29', '', now)).not.toBeNull();
  });
});

describe('image upload (FR-21)', () => {
  const file = (name: string, type: string, size: number) => ({ name, type, size });
  it('accepts JPG, PNG and WebP up to 8 MB', () => {
    expect(validateMediaFile(file('a.jpg', 'image/jpeg', 1000))).toEqual([]);
    expect(validateMediaFile(file('a.webp', 'image/webp', 8 * 1024 * 1024))).toEqual([]);
  });
  it('rejects unsupported and oversized files, stating nothing was saved', () => {
    expect(validateMediaFile(file('a.heic', 'image/heic', 1000))[0]).toMatch(/not supported/);
    expect(validateMediaFile(file('big.jpg', 'image/jpeg', 11 * 1024 * 1024))[0]).toMatch(/11 MB/);
    expect(validateMediaFile(null)).toHaveLength(1);
  });
  it('requires alt text', () => {
    expect(validateAltText('')).not.toBeNull();
    expect(validateAltText('Steel tiffin boxes')).toBeNull();
  });
});
