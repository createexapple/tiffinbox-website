import type { Metadata } from 'next';
import { PlansScreen } from '@/components/admin/screens/PlansScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Plans & prices' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <PlansScreen />;
}
