import { describe, expect, it } from 'vitest';
import {
  findDuplicatePhone,
  findDuplicateReference,
  findOverlappingSubscription,
  isFutureDate,
} from '@/admin/rules';
import type { Customer, Payment, Subscription } from '@/admin/types';

const customer = (id: string, phone: string): Customer => ({
  id,
  type: 'student',
  name: `Student ${id}`,
  phone,
  address: '',
  orgName: '',
  contactPerson: '',
  memberCount: null,
  notes: '',
  archivedAt: null,
});

describe('duplicate phone warning (FR-24)', () => {
  const customers = [customer('a', '03000000001'), customer('b', '03000000002')];
  it('finds another customer with the same number', () => {
    expect(findDuplicatePhone(customers, '03000000001')?.id).toBe('a');
  });
  it('does not flag the customer being edited, or a new number', () => {
    expect(findDuplicatePhone(customers, '03000000001', 'a')).toBeNull();
    expect(findDuplicatePhone(customers, '03000000009')).toBeNull();
  });
});

describe('overlapping subscription warning (FR-26)', () => {
  const sub = (
    id: string,
    start: string,
    end: string,
    manualState: 'active' | 'paused' = 'active',
  ): Subscription => ({
    id,
    customerId: 'a',
    planId: 'p',
    planName: 'Student',
    term: 'weekly',
    startDate: start,
    endDate: end,
    breakfastAddon: false,
    amountPerPeriod: 1,
    amountNote: '',
    manualState,
    manualStateOn: null,
    renewedFromId: null,
    notes: '',
  });
  const subs = [sub('s1', '2026-11-09', '2026-12-06')];
  it('finds an active subscription of the same customer whose dates overlap', () => {
    expect(findOverlappingSubscription(subs, 'a', '2026-12-06', '2026-12-13')?.id).toBe('s1');
  });
  it('ignores other customers, non-overlapping dates, paused subscriptions and the one being edited', () => {
    expect(findOverlappingSubscription(subs, 'z', '2026-11-10', '2026-11-12')).toBeNull();
    expect(findOverlappingSubscription(subs, 'a', '2026-12-07', '2026-12-13')).toBeNull();
    expect(
      findOverlappingSubscription(
        [sub('s2', '2026-11-09', '2026-12-06', 'paused')],
        'a',
        '2026-11-10',
        '2026-11-12',
      ),
    ).toBeNull();
    expect(findOverlappingSubscription(subs, 'a', '2026-11-10', '2026-11-12', 's1')).toBeNull();
  });
});

describe('duplicate reference warning (FR-28)', () => {
  const payment = (
    id: string,
    method: Payment['method'],
    reference: string,
    voidedAt: string | null = null,
  ): Payment => ({
    id,
    customerId: 'a',
    subscriptionId: 's',
    amount: 1,
    method,
    paidOn: '2026-11-08',
    coversFrom: '2026-11-09',
    coversTo: '2026-11-15',
    reference,
    note: '',
    voidedAt,
    voidReason: '',
  });
  const payments = [payment('p1', 'easypaisa', 'EP-0001')];
  it('matches the same method and reference, ignoring case and spaces', () => {
    expect(findDuplicateReference(payments, 'easypaisa', ' ep-0001 ')?.id).toBe('p1');
  });
  it('does not match another method, an empty reference, a voided payment or the payment being edited', () => {
    expect(findDuplicateReference(payments, 'jazzcash', 'EP-0001')).toBeNull();
    expect(findDuplicateReference(payments, 'easypaisa', '')).toBeNull();
    expect(
      findDuplicateReference(
        [payment('p2', 'easypaisa', 'X', '2026-11-22T00:00:00Z')],
        'easypaisa',
        'X',
      ),
    ).toBeNull();
    expect(findDuplicateReference(payments, 'easypaisa', 'EP-0001', 'p1')).toBeNull();
  });
});

describe('future payment date (FR-28)', () => {
  it('flags only dates after today', () => {
    expect(isFutureDate('2026-11-25', '2026-11-22')).toBe(true);
    expect(isFutureDate('2026-11-22', '2026-11-22')).toBe(false);
  });
});
