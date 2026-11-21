import Link from 'next/link';
import { MainNav } from './MainNav';

/** Logo top-left linking Home, plus the six-page navigation (FR-01). The logo is a labelled placeholder (Q-12). */
export function SiteHeader({ businessName }: { businessName: string }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" href="/" aria-label={`${businessName}, home`}>
          <span
            className="logo-ph"
            role="img"
            aria-label="Logo placeholder: round green badge with gold ring"
          >
            {businessName}
          </span>
          <span className="ph-note">
            logo
            <br />
            placeholder
          </span>
        </Link>
        <MainNav />
      </div>
    </header>
  );
}
