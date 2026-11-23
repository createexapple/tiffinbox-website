import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/admin/screens/SettingsScreen';
import { requireAdminPage } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page() {
  await requireAdminPage(); // layer 2: every admin route re-checks the session (architecture sec. 7)
  return <SettingsScreen />;
}
