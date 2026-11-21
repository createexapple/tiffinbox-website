import Link from 'next/link';
import { instagramUrl, isPlaceholder } from '@/lib/whatsapp';
import { PUBLIC_PAGES } from '@/lib/seo';
import type { SiteSettings } from '@/content';
import { InstagramIcon } from './icons';

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="site-footer">
      <div className="wrap cols">
        <div>
          <h2>{settings.businessName}</h2>
          <p>
            {settings.tagline}.
            <br />
            {settings.areaServed} (around UMT).
          </p>
          <p>
            {settings.legalNameAndAddress}
            {isPlaceholder(settings.legalNameAndAddress) ? (
              <>
                {' '}
                <span className="tag">Q-27</span>
              </>
            ) : null}
          </p>
        </div>
        <div>
          <h2>Contact</h2>
          <ul>
            <li>WhatsApp: {settings.whatsappNumber}</li>
            <li>Hours: {settings.orderHours}</li>
            <li>
              <a
                href={instagramUrl(settings.instagramHandle)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon />
                &nbsp;@{settings.instagramHandle}
                <span className="sr-only"> on Instagram (opens in a new tab)</span>
              </a>
            </li>
          </ul>
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
