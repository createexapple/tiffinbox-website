import type { Metadata } from 'next';
import { CustomerDetailScreen } from '@/components/admin/screens/CustomerDetailScreen';

// The title never contains the customer's name (NFR-12). Records are addressed by random id, not by name or phone.
export const metadata: Metadata = { title: 'Customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetailScreen id={id} />;
}
