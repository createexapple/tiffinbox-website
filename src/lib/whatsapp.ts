/**
 * WhatsApp click-to-chat link (FR-02, FR-03). Built only from the number in site settings.
 * While the number is a placeholder (Q-04) no `wa.me` link is produced: buttons point at an
 * on-page note instead of a broken link.
 */

export const WHATSAPP_NOTE_ID = 'wa-note';
export const DEFAULT_MESSAGE = 'HI';

export type WhatsAppLink =
  { ready: true; href: string } | { ready: false; href: `#${typeof WHATSAPP_NOTE_ID}` };

/** True for empty values and for bracketed placeholders such as "[WhatsApp number]". */
export function isPlaceholder(value: string): boolean {
  const v = value.trim();
  return v === '' || /^\[.*\]$/.test(v);
}

/**
 * Reduces a typed number to the digits wa.me wants (country code, no "+", spaces or dashes).
 * A Pakistani local number "03xx xxxxxxx" (11 digits) is converted to 92 3xx xxxxxxx.
 * Returns null when it is not a plausible number (8 to 15 digits, E.164 limit).
 */
export function normaliseWhatsAppNumber(raw: string): string | null {
  if (isPlaceholder(raw)) return null;
  let digits = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(digits)) return null;
  digits = digits.replace(/^\+/, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export function buildWhatsAppLink(number: string, message: string = DEFAULT_MESSAGE): WhatsAppLink {
  const digits = normaliseWhatsAppNumber(number);
  if (!digits) return { ready: false, href: `#${WHATSAPP_NOTE_ID}` };
  return { ready: true, href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}` };
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
}
