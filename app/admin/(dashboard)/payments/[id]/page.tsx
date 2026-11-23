import type { Metadata } from 'next';
import { PaymentFormScreen } from '@/components/admin/screens/PaymentFormScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Edit payment' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  const { id } = await params;
  return <PaymentFormScreen paymentId={id} />;
}
