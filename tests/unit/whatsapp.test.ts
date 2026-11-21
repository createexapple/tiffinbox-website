import { describe, expect, it } from 'vitest';
import {
  buildWhatsAppLink,
  instagramUrl,
  isPlaceholder,
  normaliseWhatsAppNumber,
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
  it('builds a wa.me click-to-chat link with "HI" prefilled', () => {
    expect(buildWhatsAppLink('+92 300 1234567')).toEqual({
      ready: true,
      href: 'https://wa.me/923001234567?text=HI',
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

describe('instagramUrl', () => {
  it('builds the profile URL with or without a leading @', () => {
    expect(instagramUrl('tiffinbox.lhr')).toBe('https://www.instagram.com/tiffinbox.lhr/');
    expect(instagramUrl('@tiffinbox.lhr')).toBe('https://www.instagram.com/tiffinbox.lhr/');
  });
});
