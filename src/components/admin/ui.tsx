'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { badgeFor, type BadgeKey } from '@/admin/status';
import type { QueryState } from './AdminProvider';
import { StatusIcon } from './icons';

/** Status badge: wording comes from the one status module (src/admin/status.ts). */
export function StatusBadge({ kind }: { kind: BadgeKey }) {
  const { label, className } = badgeFor(kind);
  return <span className={`badge ${className}`}>{label}</span>;
}

type Tone = 'ok' | 'warn' | 'err' | 'info';

export function Alert({
  tone,
  title,
  children,
  actions,
  alert = false,
  id,
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** role="alert" interrupts; use for errors the user must notice. Default is a polite status. */
  alert?: boolean;
  id?: string;
}) {
  const icon = tone === 'ok' ? 'check' : tone === 'err' ? 'x' : tone === 'warn' ? 'warn' : 'info';
  return (
    <div id={id} className={`alert ${tone}`} role={alert || tone === 'err' ? 'alert' : 'status'}>
      <StatusIcon name={icon} />
      <div>
        <b>{title}</b>
        {children}
        {actions ? <div className="alert-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="cta-row">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children ? <p className="muted">{children}</p> : null}
      {actions ? <div className="cta-row center">{actions}</div> : null}
    </div>
  );
}

/** Loading, error (with retry) and ready states for every data view. */
export function QueryBoundary<T>({
  query,
  reload,
  children,
}: {
  query: QueryState<T>;
  reload: () => void;
  children: (data: T) => ReactNode;
}) {
  if (query.status === 'loading') {
    return (
      <div role="status" aria-busy="true" data-testid="loading">
        <span className="sr-only">Loading…</span>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }
  if (query.status === 'error') {
    return (
      <Alert
        tone="err"
        title="This could not be loaded."
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
            Try again
          </button>
        }
      >
        {query.message}
      </Alert>
    );
  }
  return <>{children(query.data)}</>;
}

/** Native modal dialog: the browser traps focus and Escape closes it. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  destructive?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      role={destructive ? 'alertdialog' : 'dialog'}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      {open ? (
        <>
          <h2 id={titleId}>{title}</h2>
          {children}
          <div className="actions">{actions}</div>
        </>
      ) : null}
    </dialog>
  );
}
