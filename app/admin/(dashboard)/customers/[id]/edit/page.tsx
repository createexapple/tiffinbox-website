import type { Metadata } from 'next';
import { CustomerFormScreen } from '@/components/admin/screens/CustomerFormScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Edit customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  const { id } = await params;
  return <CustomerFormScreen customerId={id} />;
}
