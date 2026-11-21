import type { Metadata } from 'next';
import { PaymentFormScreen } from '@/components/admin/screens/PaymentFormScreen';

export const metadata: Metadata = { title: 'Edit payment' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentFormScreen paymentId={id} />;
}
