/**
 * WhatsApp click-to-chat link (FR-02, FR-03). Built only from the number in site settings.
 * While the number is a placeholder (Q-04) no `wa.me` link is produced: buttons point at an
 * on-page note instead of a broken link.
 */

export const WHATSAPP_NOTE_ID = 'wa-note';
/** Prefilled text of the generic WhatsApp buttons (the design's wording). */
export const DEFAULT_MESSAGE = 'HI Tiffin Box, I want to order.';

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

/** Longest prefilled message we build (characters, after cleaning). Longer text is cut. */
export const MAX_MESSAGE_LENGTH = 500;

/** Plain text only: control characters and line breaks become spaces, runs of spaces collapse, length is capped. */
export function cleanMessage(message: string): string {
  const plain = message
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return plain.length > MAX_MESSAGE_LENGTH
    ? `${plain.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`
    : plain;
}

export function buildWhatsAppLink(number: string, message: string = DEFAULT_MESSAGE): WhatsAppLink {
  const digits = normaliseWhatsAppNumber(number);
  if (!digits) return { ready: false, href: `#${WHATSAPP_NOTE_ID}` };
  return {
    ready: true,
    href: `https://wa.me/${digits}?text=${encodeURIComponent(cleanMessage(message))}`,
  };
}

/**
 * The same chat with a different prefilled message (order calculators). Used on the client, where only the ready
 * link is known: the number is taken from its href. A link that is not ready (placeholder number) is returned
 * unchanged, so the button keeps opening the "number not set" note.
 */
export function withWhatsAppMessage(link: WhatsAppLink, message: string): WhatsAppLink {
  if (!link.ready) return link;
  const match = /^https:\/\/wa\.me\/(\d{8,15})\?/.exec(link.href);
  if (!match) return link;
  return buildWhatsAppLink(match[1]!, message);
}

export function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
}
