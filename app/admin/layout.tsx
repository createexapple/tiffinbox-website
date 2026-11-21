import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminMockBanner } from '@/components/admin/MockBanner';
import { AdminProvider, ResetBoundary } from '@/components/admin/AdminProvider';
import '@/styles/admin.css';

// Admin pages are never indexed (NFR-07). next.config.ts also sends X-Robots-Tag, and robots.txt disallows /admin.
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Tiffin Box admin' },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Everything under /admin. Nothing in app/(public) imports from here, so the public site carries no admin
 * code or CSS (architecture sec. 4 rule).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="adm-app">
      <AdminProvider>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <AdminMockBanner />
        <ResetBoundary>{children}</ResetBoundary>
      </AdminProvider>
    </div>
  );
}
