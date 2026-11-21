import type { Metadata } from 'next';
import { CustomerDetailScreen } from '@/components/admin/screens/CustomerDetailScreen';
import { requireAdminPage } from '@/lib/auth/session';

// The title never contains the customer's name (NFR-12). Records are addressed by random id, not by name or phone.
export const metadata: Metadata = { title: 'Customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  const { id } = await params;
  return <CustomerDetailScreen id={id} />;
}
