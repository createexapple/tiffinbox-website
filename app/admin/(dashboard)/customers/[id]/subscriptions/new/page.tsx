import type { Metadata } from 'next';
import { SubscriptionFormScreen } from '@/components/admin/screens/SubscriptionFormScreen';

export const metadata: Metadata = { title: 'Add subscription' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubscriptionFormScreen mode="new" customerId={id} />;
}
