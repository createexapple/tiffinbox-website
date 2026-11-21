/**
 * Calendar-date helpers for admin business rules. Dates are "YYYY-MM-DD" strings (Asia/Karachi calendar
 * days, NFR-09). All arithmetic is done in UTC on the date alone, so it is independent of the server time zone.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtc(date: string): number {
  const match = DATE_ONLY.exec(date);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** True for a real calendar date such as "2026-11-22" ("2026-02-30" is false). */
export function isIsoDate(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const t = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(t).toISOString().slice(0, 10) === value;
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Inclusive number of days in a range: 23 Nov to 29 Nov is 7. */
export function inclusiveDays(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

/** 0 = Sunday .. 6 = Saturday. */
export function weekdayIndex(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** Two inclusive date ranges share at least one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
