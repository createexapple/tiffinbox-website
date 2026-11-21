/** Admin display helpers on top of src/lib/format.ts (Rs, dates and times in Asia/Karachi, NFR-09). */
import { TIME_ZONE, formatMenuWeekLabel } from '@/lib/format';
import { addDays } from './dates';
import type { CustomerType, MealKey, PaymentMethod } from './types';

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  student: 'Student',
  office: 'Office',
  home: 'Home',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  bank_transfer: 'Bank transfer',
};

export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/** "30 Nov – 6 Dec" for a Monday week start. */
export function weekLabel(weekStart: string): string {
  return formatMenuWeekLabel(weekStart, addDays(weekStart, 6)).replace('–', ' – ');
}

/** "22 Nov, 6:42 PM" (12-hour time in Karachi). */
export function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
}

/** "Sun 29 Nov, 6:00 PM" */
export function formatDateTimeWithWeekday(iso: string): string {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
  }).format(new Date(iso));
  return `${weekday} ${formatDateTime(iso)}`;
}

/** Karachi calendar date ("YYYY-MM-DD") of an instant, for history date filters. */
export function dateKeyOf(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "9 Nov – 6 Dec" for a period or subscription range. */
export function rangeLabel(start: string, end: string): string {
  return formatMenuWeekLabel(start, end).replace('–', ' – ');
}

/** "18:00" (24-hour, Karachi) of an instant, for time inputs. */
export function timeKeyOf(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}`;
}

/** A Karachi date and time typed in two inputs, as an ISO instant. */
export function toKarachiIso(date: string, time: string): string {
  return `${date}T${time}:00+05:00`;
}
