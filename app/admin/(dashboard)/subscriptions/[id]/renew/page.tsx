import type { Metadata } from 'next';
import { SubscriptionFormScreen } from '@/components/admin/screens/SubscriptionFormScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Renew subscription' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  const { id } = await params;
  return <SubscriptionFormScreen mode="renew" subscriptionId={id} />;
}
