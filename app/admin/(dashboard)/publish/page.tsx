import type { Metadata } from 'next';
import { PublishScreen } from '@/components/admin/screens/PublishScreen';

export const metadata: Metadata = { title: 'Preview & publish' };

export default function Page() {
  return <PublishScreen />;
}
