import type { Metadata } from 'next';
import { AddonsScreen } from '@/components/admin/screens/AddonsScreen';

export const metadata: Metadata = { title: 'Add-ons' };

export default function Page() {
  return <AddonsScreen />;
}
