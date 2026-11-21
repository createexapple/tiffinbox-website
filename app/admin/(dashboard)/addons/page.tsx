import type { Metadata } from 'next';
import { AddonsScreen } from '@/components/admin/screens/AddonsScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Add-ons' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <AddonsScreen />;
}
