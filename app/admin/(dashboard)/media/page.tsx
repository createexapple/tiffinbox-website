import type { Metadata } from 'next';
import { MediaScreen } from '@/components/admin/screens/MediaScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Images' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <MediaScreen />;
}
