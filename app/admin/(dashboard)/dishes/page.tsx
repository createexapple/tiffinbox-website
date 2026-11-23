import type { Metadata } from 'next';
import { DishesScreen } from '@/components/admin/screens/DishesScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Custom dishes' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <DishesScreen />;
}
