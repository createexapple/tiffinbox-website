import type { Metadata } from 'next';
import { CustomerFormScreen } from '@/components/admin/screens/CustomerFormScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Add customer' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <CustomerFormScreen />;
}
