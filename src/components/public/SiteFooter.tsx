import Link from 'next/link';
import { instagramUrl, isPlaceholder } from '@/lib/whatsapp';
import { stripQuestionCodes } from '@/lib/format';
import { PUBLIC_PAGES } from '@/lib/seo';
import { BRAND_NAME_URDU } from '@/content/brand';
import type { SiteSettings } from '@/content';
import { InstagramQr } from './InstagramQr';
import { InstagramIcon } from './icons';

/**
 * Footer: logo (when one is assigned), name in English and Urdu, tagline, area, WhatsApp, order hours, the Instagram
 * link and its QR code. The Urdu name uses the Noto Nastaliq Urdu font (self-hosted by next/font, see app/layout.tsx).
 */
export function SiteFooter({
  settings,
  logoUrl = null,
}: {
  settings: SiteSettings;
  logoUrl?: string | null;
}) {
  const profile = instagramUrl(settings.instagramHandle);
  return (
    <footer className="site-footer">
      <div className="wrap cols">
        <div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="footer-logo"
              src={logoUrl}
              alt=""
              height={64}
              decoding="async"
              loading="lazy"
            />
          ) : null}
          <h2 className="footer-name">
            {settings.businessName}
            <span className="urdu-name" lang="ur" dir="rtl">
              {BRAND_NAME_URDU}
            </span>
          </h2>
          <p>
            {settings.tagline}.
            <br />
            {settings.areaServed} (around UMT).
          </p>
          <p>{stripQuestionCodes(settings.legalNameAndAddress)}</p>
        </div>
        <div>
          <h2>Contact</h2>
          <ul>
            <li>WhatsApp: {stripQuestionCodes(settings.whatsappNumber)}</li>
            <li>Hours: {stripQuestionCodes(settings.orderHours)}</li>
            <li>
              <a href={profile} target="_blank" rel="noopener noreferrer">
                <InstagramIcon />
                &nbsp;@{settings.instagramHandle}
                <span className="sr-only"> on Instagram (opens in a new tab)</span>
              </a>
            </li>
          </ul>
          {isPlaceholder(settings.instagramHandle) ? null : (
            <div className="qr-box">
              <InstagramQr
                url={profile}
                label={`QR code for Instagram @${settings.instagramHandle}`}
              />
              <p className="small">Scan to follow us on Instagram.</p>
            </div>
          )}
        </div>
        <div>
          <h2>Pages</h2>
          <ul>
            {PUBLIC_PAGES.map((page) => (
              <li key={page.href}>
                <Link href={page.href}>{page.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
