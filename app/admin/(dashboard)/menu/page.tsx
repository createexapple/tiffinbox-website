import type { Metadata } from 'next';
import { MenuScreen } from '@/components/admin/screens/MenuScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Menu' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <MenuScreen />;
}
