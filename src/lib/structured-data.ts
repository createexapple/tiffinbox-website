import type { SiteSettings } from '@/content';
import { instagramUrl, normaliseWhatsAppNumber } from './whatsapp';

/**
 * schema.org FoodEstablishment for Home (NFR-04). Only confirmed facts go in:
 * name, Lahore / Pakistan, the area served and the Instagram profile come from the brief.
 * Telephone is added only once a real WhatsApp number is in settings; `url` only once SITE_URL is set.
 * Opening hours are never included (order hours are unconfirmed, Q-06).
 */
export function buildFoodEstablishmentJsonLd(
  settings: SiteSettings,
  siteUrl: string | null,
): Record<string, unknown> {
  const phone = normaliseWhatsAppNumber(settings.whatsappNumber);
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: settings.businessName,
    description: settings.tagline,
    areaServed: settings.areaServed,
    address: { '@type': 'PostalAddress', addressLocality: 'Lahore', addressCountry: 'PK' },
    sameAs: [instagramUrl(settings.instagramHandle)],
    ...(phone ? { telephone: `+${phone}` } : {}),
    ...(siteUrl ? { url: siteUrl } : {}),
  };
}
