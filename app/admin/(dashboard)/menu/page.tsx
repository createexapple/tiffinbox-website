import type { Metadata } from 'next';
import { MenuScreen } from '@/components/admin/screens/MenuScreen';

export const metadata: Metadata = { title: 'Menu' };

export default function Page() {
  return <MenuScreen />;
}
