import type { Metadata } from 'next';
import { FaqScreen } from '@/components/admin/screens/FaqScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'FAQ' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <FaqScreen />;
}
