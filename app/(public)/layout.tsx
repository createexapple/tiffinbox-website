import type { ReactNode } from 'react';
import { PublicShell } from '@/components/public/PublicShell';

// Public pages render at request time, never at build: the build artifact carries no content and no
// environment values (ADR-0003 point 8), so the artifact tested on staging is the one that ships. The content
// itself is cached by the reader (tag + 60 s), so this costs one cache lookup per request, not a database call.
export const dynamic = 'force-dynamic';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
