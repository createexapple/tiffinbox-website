import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminPage } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Layouts are not re-run on client navigation, so every page and every server action also checks the session.
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
