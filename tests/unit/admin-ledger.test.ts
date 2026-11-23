import { describe, expect, it } from 'vitest';
import { activePayments, defaultAmount, proposeEndDate, sumAmounts } from '@/admin/ledger';
import { allocatePayments, balanceOf, monthlyPriceCheck } from '@/admin/mock/ledger';

describe('allocatePayments (oldest period first, architecture sec. 9.2)', () => {
  const periods = [
    { id: 'p2', periodStart: '2026-12-01', amountDue: 1000 },
    { id: 'p1', periodStart: '2026-11-01', amountDue: 1000 },
  ];
  it('leaves a balance on a part payment', () => {
    const { paidByPeriod, credit } = allocatePayments(periods, 600);
    expect(paidByPeriod.get('p1')).toBe(600);
    expect(paidByPeriod.get('p2')).toBe(0);
    expect(credit).toBe(0);
    expect(balanceOf(1000, paidByPeriod.get('p1') ?? 0)).toBe(400);
  });
  it('lets one payment cover two periods, filling the oldest first', () => {
    const { paidByPeriod } = allocatePayments(periods, 1500);
    expect(paidByPeriod.get('p1')).toBe(1000);
    expect(paidByPeriod.get('p2')).toBe(500);
  });
  it('reports money beyond the total due as credit, never negative balances', () => {
    const { paidByPeriod, credit } = allocatePayments(periods, 2500);
    expect(paidByPeriod.get('p1')).toBe(1000);
    expect(paidByPeriod.get('p2')).toBe(1000);
    expect(credit).toBe(500);
    expect(balanceOf(1000, 1200)).toBe(0);
  });
  it('allocates nothing for no payments', () => {
    expect(allocatePayments(periods, 0).paidByPeriod.get('p1')).toBe(0);
  });
});

describe('payment totals', () => {
  it('excludes voided payments from totals (void keeps the row)', () => {
    const payments = [
      { amount: 5000, voidedAt: null },
      { amount: 3000, voidedAt: '2026-11-22T18:00:00+05:00' },
    ];
    expect(sumAmounts(activePayments(payments))).toBe(5000);
    expect(activePayments(payments)).toHaveLength(1);
  });
});

describe('proposed end date and default amount (FR-26)', () => {
  it('proposes 7 days for weekly and 4 weeks for monthly, inclusive', () => {
    expect(proposeEndDate('2026-11-23', 'weekly')).toBe('2026-11-29');
    expect(proposeEndDate('2026-11-09', 'monthly')).toBe('2026-12-06');
  });
  it('defaults a weekly amount to the plan weekly price, plus breakfast per day when chosen', () => {
    const input = {
      plan: { weeklyPrice: 8050 },
      term: 'weekly' as const,
      breakfastAddon: false,
      breakfastPerDay: 350,
      startDate: '2026-11-23',
      endDate: '2026-11-29',
    };
    expect(defaultAmount(input)).toBe(8050);
    expect(defaultAmount({ ...input, breakfastAddon: true })).toBe(8050 + 350 * 7);
  });
  it('has no default for monthly terms (typed by hand until Q-10 is answered)', () => {
    expect(
      defaultAmount({
        plan: { weeklyPrice: 8050 },
        term: 'monthly',
        breakfastAddon: false,
        breakfastPerDay: 350,
        startDate: '2026-11-09',
        endDate: '2026-12-06',
      }),
    ).toBeNull();
  });
  it('computes the A-04 monthly price check as 4 x weekly less the saving, whole rupees', () => {
    expect(monthlyPriceCheck(4200, 5)).toBe(15960);
    expect(monthlyPriceCheck(8050, 5)).toBe(30590);
    expect(monthlyPriceCheck(3300, 5)).toBe(12540);
    expect(monthlyPriceCheck(10500, 5)).toBe(39900);
    expect(Number.isInteger(monthlyPriceCheck(3333, 2))).toBe(true);
  });
});
