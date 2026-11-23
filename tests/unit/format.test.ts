import { describe, expect, it } from 'vitest';
import {
  formatMenuHeadingDates,
  formatMenuWeekLabel,
  formatRs,
  formatRsRange,
  formatShortDate,
  formatTime12h,
  formatWeekdayDate,
  karachiDateKey,
  toDate,
} from '@/lib/format';

describe('formatRs', () => {
  it('formats whole rupees with thousands separators', () => {
    expect(formatRs(4200)).toBe('Rs 4,200');
    expect(formatRs(300)).toBe('Rs 300');
    expect(formatRs(10500)).toBe('Rs 10,500');
    expect(formatRs(0)).toBe('Rs 0');
  });
  it('rejects fractional amounts (money is whole PKR)', () => {
    expect(() => formatRs(4200.5)).toThrow(RangeError);
    expect(() => formatRs(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatRsRange', () => {
  it('prints a range with an en dash and Rs once', () => {
    expect(formatRsRange(550, 600)).toBe('Rs 550–600');
  });
  it('prints a single price when there is no distinct upper bound', () => {
    expect(formatRsRange(550)).toBe('Rs 550');
    expect(formatRsRange(550, 550)).toBe('Rs 550');
  });
  it('rejects an upper bound below the lower bound', () => {
    expect(() => formatRsRange(600, 550)).toThrow(RangeError);
  });
});

describe('Asia/Karachi dates', () => {
  it('treats a date-only string as that calendar day in Karachi', () => {
    expect(formatShortDate('2026-11-23')).toBe('23 Nov');
    expect(formatWeekdayDate('2026-11-22')).toBe('Sunday 22 Nov');
  });
  it('converts an instant to the Karachi calendar day (UTC+5)', () => {
    // 19:30 UTC on 21 Nov is 00:30 on 22 Nov in Karachi.
    expect(formatWeekdayDate('2026-11-21T19:30:00Z')).toBe('Sunday 22 Nov');
    // 18:59 UTC is still 23:59 on 21 Nov in Karachi.
    expect(formatWeekdayDate('2026-11-21T18:59:00Z')).toBe('Saturday 21 Nov');
  });
  it('accepts an ISO timestamp with an explicit offset', () => {
    expect(formatWeekdayDate('2026-11-22T18:00:00+05:00')).toBe('Sunday 22 Nov');
  });
  it('builds a week label within a month and across months', () => {
    expect(formatMenuWeekLabel('2026-11-23', '2026-11-29')).toBe('23–29 Nov');
    expect(formatMenuWeekLabel('2026-11-30', '2026-12-06')).toBe('30 Nov–6 Dec');
  });
  it('gives the Karachi calendar date key for an instant', () => {
    expect(karachiDateKey(new Date('2026-11-21T19:30:00Z'))).toBe('2026-11-22');
    expect(karachiDateKey(new Date('2026-11-21T18:59:00Z'))).toBe('2026-11-21');
  });
  it('rejects invalid dates', () => {
    expect(() => toDate('not a date')).toThrow(RangeError);
  });
});

describe('formatTime12h', () => {
  it('converts 24-hour times to 12-hour text', () => {
    expect(formatTime12h('08:00')).toBe('8 AM');
    expect(formatTime12h('13:00')).toBe('1 PM');
    expect(formatTime12h('20:30')).toBe('8:30 PM');
    expect(formatTime12h('00:00')).toBe('12 AM');
    expect(formatTime12h('12:00')).toBe('12 PM');
  });
  it('rejects malformed times', () => {
    expect(() => formatTime12h('25:00')).toThrow(RangeError);
    expect(() => formatTime12h('8am')).toThrow(RangeError);
  });
});

describe('formatMenuHeadingDates (Menu page heading)', () => {
  it('same month: "23 to 29 November"', () => {
    expect(formatMenuHeadingDates('2026-11-23', '2026-11-29')).toBe('23 to 29 November');
  });
  it('across months: "30 November to 6 December"', () => {
    expect(formatMenuHeadingDates('2026-11-30', '2026-12-06')).toBe('30 November to 6 December');
  });
  it('across years keeps both month names', () => {
    expect(formatMenuHeadingDates('2026-12-28', '2027-01-03')).toBe('28 December to 3 January');
  });
});
