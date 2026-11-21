import type { Metadata } from 'next';
import { PlansScreen } from '@/components/admin/screens/PlansScreen';

export const metadata: Metadata = { title: 'Plans & prices' };

export default function Page() {
  return <PlansScreen />;
}
