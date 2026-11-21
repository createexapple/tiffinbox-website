import type { Metadata } from 'next';
import { DishesScreen } from '@/components/admin/screens/DishesScreen';

export const metadata: Metadata = { title: 'Custom dishes' };

export default function Page() {
  return <DishesScreen />;
}
