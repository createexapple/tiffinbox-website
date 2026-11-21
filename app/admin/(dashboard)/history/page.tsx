import type { Metadata } from 'next';
import { HistoryScreen } from '@/components/admin/screens/HistoryScreen';

export const metadata: Metadata = { title: 'Change history' };

export default function Page() {
  return <HistoryScreen />;
}
