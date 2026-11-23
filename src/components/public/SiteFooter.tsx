import { DEFAULT_LOGO_URL } from '@/lib/brand';
import { stripQuestionCodes } from '@/lib/format';
import { instagramUrl, isPlaceholder } from '@/lib/whatsapp';
import type { SiteSettings } from '@/content';
import { InstagramQr } from './InstagramQr';

/**
 * Footer: logo, name, tagline, area, WhatsApp and order hours from settings, the Instagram link and its QR code
 * (server-rendered inline SVG, no external request).
 */
export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const profile = instagramUrl(settings.instagramHandle);
  return (
    <footer className="t-footer">
      <div className="t-wrap">
        <div className="t-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DEFAULT_LOGO_URL}
            alt=""
            width={84}
            height={84}
            loading="lazy"
            decoding="async"
          />
          <div>
            <b>{settings.businessName}</b>
            <br />
            {settings.tagline}.
            <br />
            <small>{settings.areaServed} (around UMT)</small>
            {isPlaceholder(settings.legalNameAndAddress) ? null : (
              <>
                <br />
                <small>{settings.legalNameAndAddress}</small>
              </>
            )}
          </div>
        </div>
        <div>
          <b>Contact</b>
          <br />
          WhatsApp: {stripQuestionCodes(settings.whatsappNumber)}
          <br />
          Hours: {stripQuestionCodes(settings.orderHours)}
        </div>
        <div className="t-qr-wrap">
          {isPlaceholder(settings.instagramHandle) ? null : (
            <div className="t-qr">
              <InstagramQr
                url={profile}
                label={`QR code to Instagram @${settings.instagramHandle}`}
              />
            </div>
          )}
          <div>
            <a href={profile} target="_blank" rel="noopener noreferrer">
              @{settings.instagramHandle}
              <span className="sr-only"> on Instagram (opens in a new tab)</span>
            </a>
            <br />
            <small>Scan to follow</small>
          </div>
        </div>
      </div>
    </footer>
  );
}
