'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ToastMessage {
  id: number;
  text: string;
  link?: { href: string; label: string };
  tone?: 'ok' | 'plain';
}

type Show = (toast: Omit<ToastMessage, 'id'>) => void;

const ToastContext = createContext<Show | null>(null);

/** Polite live region for "saved" feedback. Always mounted so screen readers announce changes. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const show = useCallback<Show>((toast) => {
    const id = nextId.current++;
    setToasts([{ id, tone: 'ok', ...toast }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts([]), 10_000);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'ok' ? 'ok' : ''}`}>
            <span>
              {t.text}
              {t.link ? (
                <>
                  {' '}
                  <Link href={t.link.href}>{t.link.label}</Link>
                </>
              ) : null}
            </span>
            <button type="button" onClick={() => setToasts([])} aria-label="Dismiss message">
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Show {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
