import type { Metadata } from 'next';
import { PaymentFormScreen } from '@/components/admin/screens/PaymentFormScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Record payment' };

/** `?customer=` and `?subscription=` are random ids (never names or phone numbers, NFR-12). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; subscription?: string }>;
}) {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  const { customer, subscription } = await searchParams;
  return (
    <PaymentFormScreen
      key={`${customer ?? ''}-${subscription ?? ''}`}
      {...(customer ? { customerId: customer } : {})}
      {...(subscription ? { subscriptionId: subscription } : {})}
    />
  );
}
