import { DEFAULT_LOGO_URL } from '@/lib/brand';
import { MainNav } from './MainNav';

/**
 * Logo (image only) top-left linking Home, plus the six-section navigation (FR-01). Always the bundled logo (the
 * design's): a logo assigned in the admin no longer changes the public site.
 */
export function SiteHeader({ businessName }: { businessName: string }) {
  return (
    <header className="t-header">
      <div className="t-wrap">
        {/* Plain anchor on purpose: the sections are shown by :target, which only a real fragment navigation updates. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="t-logo" href="/#home" aria-label={`${businessName}, home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={DEFAULT_LOGO_URL} alt="" width={58} height={58} decoding="async" />
        </a>
        <MainNav />
      </div>
    </header>
  );
}
