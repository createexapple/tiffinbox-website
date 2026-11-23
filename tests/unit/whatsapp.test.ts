import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppLink,
  cleanMessage,
  DEFAULT_MESSAGE,
  instagramUrl,
  isPlaceholder,
  MAX_MESSAGE_LENGTH,
  normaliseWhatsAppNumber,
  withWhatsAppMessage,
} from '@/lib/whatsapp';

describe('isPlaceholder', () => {
  it('detects bracketed placeholders and empty values', () => {
    expect(isPlaceholder('[WhatsApp number]')).toBe(true);
    expect(isPlaceholder('  [order hours] ')).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('+92 300 1234567')).toBe(false);
  });
});

describe('normaliseWhatsAppNumber', () => {
  it('strips formatting and the leading plus', () => {
    expect(normaliseWhatsAppNumber('+92 300 1234567')).toBe('923001234567');
    expect(normaliseWhatsAppNumber('+92-300-1234567')).toBe('923001234567');
  });
  it('converts 00 prefix and Pakistani local format', () => {
    expect(normaliseWhatsAppNumber('0092 300 1234567')).toBe('923001234567');
    expect(normaliseWhatsAppNumber('0300 1234567')).toBe('923001234567');
  });
  it('returns null for placeholders and implausible values', () => {
    expect(normaliseWhatsAppNumber('[WhatsApp number]')).toBeNull();
    expect(normaliseWhatsAppNumber('')).toBeNull();
    expect(normaliseWhatsAppNumber('12345')).toBeNull();
    expect(normaliseWhatsAppNumber('call me')).toBeNull();
    expect(normaliseWhatsAppNumber('1234567890123456')).toBeNull();
  });
});

describe('buildWhatsAppLink', () => {
  it('builds a wa.me click-to-chat link with the design message prefilled', () => {
    expect(DEFAULT_MESSAGE).toBe('HI Tiffin Box, I want to order.');
    expect(buildWhatsAppLink('+92 300 1234567')).toEqual({
      ready: true,
      href: 'https://wa.me/923001234567?text=HI%20Tiffin%20Box%2C%20I%20want%20to%20order.',
    });
  });
  it('never produces a wa.me link while the number is a placeholder', () => {
    const link = buildWhatsAppLink('[WhatsApp number]');
    expect(link).toEqual({ ready: false, href: '#wa-note' });
  });
  it('encodes a custom message', () => {
    const link = buildWhatsAppLink('923001234567', 'Hi there');
    expect(link.href).toBe('https://wa.me/923001234567?text=Hi%20there');
  });
});

describe('custom messages', () => {
  it('cleans to plain text: control characters and line breaks become spaces, length is capped', () => {
    expect(cleanMessage('a\nb\t c\u0000d')).toBe('a b c d');
    const long = cleanMessage('x'.repeat(2000));
    expect(long.length).toBe(MAX_MESSAGE_LENGTH);
    expect(long.endsWith('…')).toBe(true);
  });
  it('URL-encodes everything that could break the link (no free text can add parameters)', () => {
    const link = buildWhatsAppLink('923001234567', 'HI & text=evil #x?y');
    expect(link.href).toBe('https://wa.me/923001234567?text=HI%20%26%20text%3Devil%20%23x%3Fy');
  });
  it('swaps the message on a ready link and leaves a placeholder link alone', () => {
    const ready = buildWhatsAppLink('923001234567');
    expect(withWhatsAppMessage(ready, 'HI Tiffin Box, I want the Starter plan.').href).toBe(
      'https://wa.me/923001234567?text=HI%20Tiffin%20Box%2C%20I%20want%20the%20Starter%20plan.',
    );
    const note = buildWhatsAppLink('[WhatsApp number]');
    expect(withWhatsAppMessage(note, 'anything')).toEqual({ ready: false, href: '#wa-note' });
  });
  it('ignores a ready link that is not a wa.me link', () => {
    const odd = { ready: true as const, href: 'https://example.com/?text=x' };
    expect(withWhatsAppMessage(odd, 'hi')).toBe(odd);
  });
});

describe('instagramUrl', () => {
  it('builds the profile URL with or without a leading @', () => {
    expect(instagramUrl('tiffinbox.lhr')).toBe('https://www.instagram.com/tiffinbox.lhr/');
    expect(instagramUrl('@tiffinbox.lhr')).toBe('https://www.instagram.com/tiffinbox.lhr/');
  });
});
