/** Shared validation helpers. No dependencies; every validator returns field-level messages (no throwing). */

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type Validation<T, K extends string> =
  { ok: true; value: T } | { ok: false; errors: FieldErrors<K> };

export function fail<K extends string>(
  errors: FieldErrors<K>,
): { ok: false; errors: FieldErrors<K> } {
  return { ok: false, errors };
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Whole PKR from what the admin typed: digits only, thousands commas and spaces allowed.
 * Rejects empty text, decimals, negatives, ranges such as "550-600", and letters. Returns null when invalid.
 */
export function parseWholeNumber(text: string): number | null {
  const cleaned = text.trim().replace(/[,\s]/g, '');
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Whole rupees greater than zero (payments, prices). */
export function parsePositiveRupees(text: string): number | null {
  const n = parseWholeNumber(text);
  return n !== null && n > 0 ? n : null;
}

/** Characters that could be markup. Admin text is plain text only (FR-14 AC 3, NFR-07 XSS). */
export function hasMarkup(text: string): boolean {
  return /[<>]/.test(text);
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isTime(text: string): boolean {
  return HHMM.test(text);
}

/** Required plain-text field with a length limit. Returns an error message or null. */
export function checkText(
  value: string,
  label: string,
  opts: { required?: boolean; max: number },
): string | null {
  const text = value.trim();
  if (text === '') return opts.required ? `Enter ${label}.` : null;
  if (hasMarkup(text)) return `${capitalise(label)} cannot contain < or >. Plain text only.`;
  if (text.length > opts.max)
    return `${capitalise(label)} is too long (max ${opts.max} characters).`;
  return null;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const PRICE_ERROR =
  'Enter whole rupees greater than 0, for example 575. A range or decimals are not allowed.';
