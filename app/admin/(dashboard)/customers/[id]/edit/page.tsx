import type { Metadata } from 'next';
import { CustomerFormScreen } from '@/components/admin/screens/CustomerFormScreen';

export const metadata: Metadata = { title: 'Edit customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerFormScreen customerId={id} />;
}
