import type { Metadata } from 'next';
import { DashboardScreen } from '@/components/admin/screens/DashboardScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <DashboardScreen />;
}
