import Link from 'next/link';
import { MainNav } from './MainNav';

/**
 * Logo top-left linking Home, plus the six-page navigation (FR-01). Shows the published logo when one is
 * assigned in the admin (Images), otherwise a plain badge with the business name.
 */
export function SiteHeader({
  businessName,
  logoUrl = null,
}: {
  businessName: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href="/" aria-label={`${businessName}, home`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="logo-img" src={logoUrl} alt="" height={48} decoding="async" />
          ) : (
            <>
              <span className="logo-ph" role="img" aria-label={`${businessName} logo`}>
                {businessName}
              </span>
            </>
          )}
        </Link>
        <MainNav />
      </div>
    </header>
  );
}
