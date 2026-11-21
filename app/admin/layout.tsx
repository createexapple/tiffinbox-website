import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminMockBanner } from '@/components/admin/MockBanner';
import { AdminProvider, MockOnly, ResetBoundary } from '@/components/admin/AdminProvider';
import { isMockBackend } from '@/lib/env';
import '@/styles/admin.css';

// Admin pages are never indexed (NFR-07). next.config.ts also sends X-Robots-Tag, and robots.txt disallows /admin.
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Tiffin Box admin' },
  robots: { index: false, follow: false, nocache: true },
};

// Always rendered per request: the mode (real or test mock) is read from the environment at run time.
export const dynamic = 'force-dynamic';

/**
 * Everything under /admin. Nothing in app/(public) imports from here, so the public site carries no admin
 * code or CSS (architecture sec. 4 rule). The real data source is the Supabase-backed repository; the in-memory
 * mock (and its banner) exists only under the explicit test flag.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const mode = isMockBackend() ? 'mock' : 'live';
  return (
    <div className="adm-app">
      <AdminProvider mode={mode}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <MockOnly>
          <AdminMockBanner />
        </MockOnly>
        <ResetBoundary>{children}</ResetBoundary>
      </AdminProvider>
    </div>
  );
}
