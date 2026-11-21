import type { ReactNode } from 'react';
import { WarnIcon } from './icons';

/** Warning alert (role=status) with icon and bold title, as in the design system. */
export function WarningAlert({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="alert warn" role="status">
      <WarnIcon />
      <div>
        <b>{title}</b>
        {children}
      </div>
    </div>
  );
}
