import type { Metadata } from 'next';
import { CustomersScreen, type CustomersPreset } from '@/components/admin/screens/CustomersScreen';

export const metadata: Metadata = { title: 'Customers' };

/** `?show=active|renewal` comes from the dashboard cards: a status filter only, never customer data (NFR-12). */
export default async function Page({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const preset: CustomersPreset = show === 'active' || show === 'renewal' ? show : undefined;
  return <CustomersScreen key={preset ?? 'all'} preset={preset} />;
}
