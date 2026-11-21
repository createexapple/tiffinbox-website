import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, inclusiveDays, isIsoDate, rangesOverlap } from '@/admin/dates';
import {
  isRenewalDue,
  menuWeekStatus,
  periodPaymentStatus,
  pickCurrentSubscription,
  subscriptionStatus,
  worstPaymentStatus,
} from '@/admin/mock/status-rules';
import { badgeFor } from '@/admin/status';

const TODAY = '2026-11-22';

describe('subscription status (architecture sec. 9.1, FR-27)', () => {
  const base = { manualState: 'active' as const, startDate: '2026-11-16', endDate: '2026-11-29' };

  it('is active inside the date range, including the first and last day', () => {
    expect(subscriptionStatus(base, TODAY)).toBe('active');
    expect(subscriptionStatus({ ...base, startDate: TODAY }, TODAY)).toBe('active');
    expect(subscriptionStatus({ ...base, endDate: TODAY }, TODAY)).toBe('active');
  });
  it('is expired once the end date has passed, without admin action', () => {
    expect(subscriptionStatus({ ...base, endDate: '2026-11-21' }, TODAY)).toBe('expired');
  });
  it('is upcoming before the start date', () => {
    expect(subscriptionStatus({ ...base, startDate: '2026-11-23' }, TODAY)).toBe('upcoming');
  });
  it('is paused when manually paused, and paused wins over expired and upcoming', () => {
    expect(subscriptionStatus({ ...base, manualState: 'paused' }, TODAY)).toBe('paused');
    expect(
      subscriptionStatus({ ...base, manualState: 'paused', endDate: '2026-11-01' }, TODAY),
    ).toBe('paused');
    expect(
      subscriptionStatus({ ...base, manualState: 'paused', startDate: '2026-12-01' }, TODAY),
    ).toBe('paused');
  });
});

describe('renewal due (FR-27)', () => {
  it('flags an active plan ending within the window, inclusive', () => {
    expect(isRenewalDue('active', '2026-11-29', TODAY, 7)).toBe(true);
    expect(isRenewalDue('active', '2026-11-30', TODAY, 7)).toBe(false);
    expect(isRenewalDue('active', TODAY, TODAY, 0)).toBe(true);
  });
  it('never flags paused, upcoming or expired plans', () => {
    for (const status of ['paused', 'upcoming', 'expired'] as const) {
      expect(isRenewalDue(status, '2026-11-23', TODAY, 7)).toBe(false);
    }
  });
});

describe('period payment status (architecture sec. 9.2, FR-29)', () => {
  const period = { amountDue: 1000, dueDate: '2026-11-22' };
  it('is paid when payments cover the amount due, or more', () => {
    expect(periodPaymentStatus(period, 1000, TODAY, 0)).toBe('paid');
    expect(periodPaymentStatus(period, 1500, TODAY, 0)).toBe('paid');
  });
  it('is unpaid until the day after the due date', () => {
    expect(periodPaymentStatus(period, 0, '2026-11-22', 0)).toBe('unpaid');
    expect(periodPaymentStatus(period, 0, '2026-11-23', 0)).toBe('overdue');
  });
  it('treats a part payment as unpaid or overdue, not paid', () => {
    expect(periodPaymentStatus(period, 999, '2026-11-22', 0)).toBe('unpaid');
    expect(periodPaymentStatus(period, 999, '2026-11-23', 0)).toBe('overdue');
  });
  it('applies grace days before overdue (Q-32)', () => {
    expect(periodPaymentStatus(period, 0, '2026-11-24', 2)).toBe('unpaid');
    expect(periodPaymentStatus(period, 0, '2026-11-25', 2)).toBe('overdue');
  });
});

describe('customer-level helpers', () => {
  it('takes the worst payment status: overdue, then unpaid, then paid', () => {
    expect(worstPaymentStatus(['paid', 'unpaid', 'overdue'])).toBe('overdue');
    expect(worstPaymentStatus(['paid', 'unpaid'])).toBe('unpaid');
    expect(worstPaymentStatus(['paid'])).toBe('paid');
    expect(worstPaymentStatus([])).toBeNull();
  });
  it('picks the active subscription first, then paused, upcoming, expired', () => {
    const subs = [
      { id: 'a', status: 'expired' as const, endDate: '2026-11-15' },
      { id: 'b', status: 'upcoming' as const, endDate: '2026-12-01' },
      { id: 'c', status: 'active' as const, endDate: '2026-11-25' },
    ];
    expect(pickCurrentSubscription(subs)?.id).toBe('c');
    expect(pickCurrentSubscription(subs.slice(0, 2))?.id).toBe('b');
    expect(pickCurrentSubscription([])).toBeNull();
  });
});

describe('menu week status (architecture sec. 8.3)', () => {
  const now = '2026-11-22T18:42:00+05:00';
  const weeks = [
    { id: 'old', goLiveAt: '2026-11-15T18:00:00+05:00' },
    { id: 'now', goLiveAt: '2026-11-22T18:00:00+05:00' },
    { id: 'next', goLiveAt: '2026-11-29T18:00:00+05:00' },
    { id: 'draft', goLiveAt: null },
  ];
  it('derives draft, scheduled, live and past', () => {
    const status = (id: string) =>
      menuWeekStatus(weeks.find((w) => w.id === id) ?? { id, goLiveAt: null }, weeks, now);
    expect(status('draft')).toBe('draft');
    expect(status('next')).toBe('scheduled');
    expect(status('now')).toBe('live');
    expect(status('old')).toBe('past');
  });
});

describe('badges', () => {
  it('give every status its own wording and class (colour is never the only signal)', () => {
    const keys = [
      'active',
      'paused',
      'expired',
      'upcoming',
      'paid',
      'unpaid',
      'overdue',
      'renewal_due',
    ] as const;
    const labels = keys.map((k) => badgeFor(k).label);
    expect(new Set(labels).size).toBe(keys.length);
    expect(badgeFor('overdue')).toEqual({ label: 'Overdue', className: 'b-overdue' });
    expect(badgeFor('renewal_due').label).toBe('Renewal due');
  });
});

describe('date helpers', () => {
  it('does calendar arithmetic across months and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-11-22', '2026-11-29')).toBe(7);
    expect(inclusiveDays('2026-11-23', '2026-11-29')).toBe(7);
  });
  it('validates real calendar dates only', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
    expect(isIsoDate('2026-11-22')).toBe(true);
  });
  it('detects overlapping inclusive ranges', () => {
    expect(rangesOverlap('2026-11-01', '2026-11-28', '2026-11-28', '2026-12-05')).toBe(true);
    expect(rangesOverlap('2026-11-01', '2026-11-28', '2026-11-29', '2026-12-05')).toBe(false);
  });
});
