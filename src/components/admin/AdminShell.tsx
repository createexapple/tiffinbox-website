'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAdmin, useQuery } from './AdminProvider';

const NAV: { heading: string; items: { href: string; label: string }[] }[] = [
  { heading: 'Overview', items: [{ href: '/admin', label: 'Dashboard' }] },
  {
    heading: 'Website content',
    items: [
      { href: '/admin/menu', label: 'Menu' },
      { href: '/admin/plans', label: 'Plans & prices' },
      { href: '/admin/dishes', label: 'Custom dishes' },
      { href: '/admin/addons', label: 'Add-ons' },
      { href: '/admin/faq', label: 'FAQ' },
      { href: '/admin/media', label: 'Images' },
      { href: '/admin/settings', label: 'Settings' },
      { href: '/admin/publish', label: 'Preview & publish' },
    ],
  },
  {
    heading: 'Customers & payments',
    items: [
      { href: '/admin/customers', label: 'Customers' },
      { href: '/admin/payments', label: 'Payments & dues' },
    ],
  },
  { heading: 'Records', items: [{ href: '/admin/history', label: 'Change history' }] },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shared admin shell for A-02..A-17: top bar with unpublished-changes pill, sidebar (drawer on phones). */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { repo } = useAdmin();
  const [open, setOpen] = useState(false);
  const { state } = useQuery((r) => r.getOverview());
  const pending = state.status === 'ready' ? state.data.pendingChanges : null;

  return (
    <>
      <header className="adm-top">
        <button
          className="adm-nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="adm-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <Link className="brand" href="/admin" aria-label="Tiffin Box admin, dashboard">
          <span
            className="logo-ph"
            role="img"
            aria-label="Logo placeholder"
            style={{ width: '2.5rem', height: '2.5rem', fontSize: '.5rem' }}
          >
            Tiffin Box
          </span>
          <span className="ph-note">Admin</span>
        </Link>
        <span className="spacer" />
        {pending === null ? null : pending > 0 ? (
          <Link className="pill" href="/admin/publish" data-testid="pending-pill">
            {pending} unpublished {pending === 1 ? 'change' : 'changes'}
          </Link>
        ) : (
          <Link className="pill calm" href="/admin/publish" data-testid="pending-pill">
            Live site up to date
          </Link>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            // Revokes the session on the server (FR-13), then leaves the dashboard.
            await repo.signOut().catch(() => undefined);
            router.push('/admin/login');
            router.refresh();
          }}
        >
          Log out
        </button>
      </header>
      <div className="adm-layout">
        <nav id="adm-nav" className={`adm-nav${open ? ' open' : ''}`} aria-label="Admin">
          {NAV.map((group) => (
            <div key={group.heading}>
              <h2>{group.heading}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main id="main" className="adm-main">
          {children}
        </main>
      </div>
    </>
  );
}
