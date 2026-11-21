/**
 * Formatting helpers (NFR-09): whole-PKR prices as "Rs 4,200", 12-hour times, dates in Asia/Karachi.
 * One module so every page formats the same way. Pure functions, unit-tested in tests/unit/format.test.ts.
 */

export const TIME_ZONE = 'Asia/Karachi';
/** Pakistan has no daylight saving time; Asia/Karachi is a fixed UTC+05:00. */
const KARACHI_OFFSET = '+05:00';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "Rs 4,200". Money is stored as whole PKR, so non-integers are a bug and are rejected. */
export function formatRs(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`formatRs expects a whole number of rupees, got ${amount}`);
  }
  const grouped = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-Rs ${grouped}` : `Rs ${grouped}`;
}

/** "Rs 550–600" (en dash), or a single price when `to` is missing or equal to `from`. */
export function formatRsRange(from: number, to?: number): string {
  if (to === undefined || to === from) return formatRs(from);
  if (to < from) throw new RangeError(`formatRsRange: ${to} is below ${from}`);
  return `${formatRs(from)}–${Math.abs(to).toLocaleString('en-US')}`;
}

/**
 * Turns a calendar date ("2026-11-23") or an instant (Date or ISO timestamp) into a Date.
 * A date-only string means that day in Karachi, so it is pinned to noon there to stay on the same
 * calendar day whichever time zone the server runs in.
 */
export function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const date = DATE_ONLY.test(input)
    ? new Date(`${input}T12:00:00${KARACHI_OFFSET}`)
    : new Date(input);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid date: ${input}`);
  return date;
}

function karachiParts(input: Date | string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'long',
  }).formatToParts(toDate(input));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day'), weekday: get('weekday') };
}

/** "23 Nov" */
export function formatShortDate(input: Date | string): string {
  const { day, month } = karachiParts(input);
  return `${day} ${month}`;
}

/** "Sunday 22 Nov" */
export function formatWeekdayDate(input: Date | string): string {
  const { weekday, day, month } = karachiParts(input);
  return `${weekday} ${day} ${month}`;
}

/** "23–29 Nov", or "30 Nov–6 Dec" when the week crosses a month. */
export function formatMenuWeekLabel(start: Date | string, end: Date | string): string {
  const s = karachiParts(start);
  const e = karachiParts(end);
  if (s.month === e.month && s.year === e.year) return `${s.day}–${e.day} ${e.month}`;
  return `${s.day} ${s.month}–${e.day} ${e.month}`;
}

/** Today's calendar date in Karachi as "YYYY-MM-DD" (sortable, comparable with stored dates). */
export function karachiDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 24-hour "HH:mm" to 12-hour text: "08:00" -> "8 AM", "13:00" -> "1 PM", "20:30" -> "8:30 PM". */
export function formatTime12h(hhmm: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new RangeError(`Expected 24-hour HH:mm, got ${hhmm}`);
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === '00' ? `${hour12} ${suffix}` : `${hour12}:${minutes} ${suffix}`;
}
