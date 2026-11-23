import type { Metadata } from 'next';
import { HistoryScreen } from '@/components/admin/screens/HistoryScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Change history' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <HistoryScreen />;
}
