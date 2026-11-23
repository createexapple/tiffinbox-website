'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { PUBLIC_PAGES } from '@/lib/seo';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
const currentHash = () => window.location.hash;
const serverHash = () => '';

/**
 * Main navigation (FR-01): six anchor links to the sections of the single page (design). The active section is marked
 * with aria-current (home when there is no hash or an unknown one). A horizontally scrollable row that drops under the
 * logo on small screens (no menu button). Which section is SHOWN is decided by CSS (:target), not by this component.
 */
export function MainNav() {
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribe, currentHash, serverHash);
  const known = PUBLIC_PAGES.some((page) => `#${page.id}` === hash);
  const active = pathname !== '/' ? null : known ? hash.slice(1) : 'home';
  return (
    <nav className="t-nav" aria-label="Main">
      {PUBLIC_PAGES.map((page) => (
        <a key={page.id} href={page.href} aria-current={active === page.id ? 'page' : undefined}>
          {page.label}
        </a>
      ))}
    </nav>
  );
}
