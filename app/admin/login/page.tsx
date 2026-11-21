import type { Metadata } from 'next';
import { LoginScreen } from '@/components/admin/screens/LoginScreen';

export const metadata: Metadata = { title: 'Log in' };

/** A-01. `?reason=expired` is where Stage 3's idle-timeout redirect will land (a reason code only, no personal data). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return <LoginScreen expired={reason === 'expired'} />;
}
