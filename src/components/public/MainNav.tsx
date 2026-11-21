'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PUBLIC_PAGES } from '@/lib/seo';

/**
 * Main navigation (FR-01): six links, current page marked with aria-current.
 * Under 960px it collapses behind a "Menu" button (aria-expanded); Escape closes it and returns focus.
 */
export function MainNav() {
  const pathname = usePathname();
  // The menu is "open" only for the page it was opened on, so navigating closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenAt(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        className="nav-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpenAt(open ? null : pathname)}
      >
        Menu
      </button>
      <nav id="site-nav" className={open ? 'site-nav open' : 'site-nav'} aria-label="Main">
        <ul>
          {PUBLIC_PAGES.map((page) => (
            <li key={page.href}>
              <Link href={page.href} aria-current={pathname === page.href ? 'page' : undefined}>
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
