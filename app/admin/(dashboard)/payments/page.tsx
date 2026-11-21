import type { Metadata } from 'next';
import { PaymentsScreen, type PaymentsPreset } from '@/components/admin/screens/PaymentsScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Payments & dues' };

/** `?show=unpaid|overdue` comes from the dashboard cards: a status filter only (NFR-12). */
export default async function Page({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  const { show } = await searchParams;
  const preset: PaymentsPreset = show === 'unpaid' || show === 'overdue' ? show : undefined;
  return <PaymentsScreen key={preset ?? 'open'} preset={preset} />;
}
