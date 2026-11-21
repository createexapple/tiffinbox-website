import type { Metadata } from 'next';
import { CustomerFormScreen } from '@/components/admin/screens/CustomerFormScreen';

export const metadata: Metadata = { title: 'Add customer' };

export default function Page() {
  return <CustomerFormScreen />;
}
