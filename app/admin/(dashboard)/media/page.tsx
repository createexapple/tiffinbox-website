import type { Metadata } from 'next';
import { MediaScreen } from '@/components/admin/screens/MediaScreen';

export const metadata: Metadata = { title: 'Images' };

export default function Page() {
  return <MediaScreen />;
}
