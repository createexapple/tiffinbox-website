import type { Metadata } from 'next';
import { FaqScreen } from '@/components/admin/screens/FaqScreen';

export const metadata: Metadata = { title: 'FAQ' };

export default function Page() {
  return <FaqScreen />;
}
