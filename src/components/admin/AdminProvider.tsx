'use client';

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AdminRepository } from '@/admin/repository';
import { MockAdminStore, type MockControls } from '@/admin/mock/store';
import { ToastProvider } from './Toast';

/**
 * Wires the screens to a repository. STAGE 2: the in-memory mock (nothing is saved, state lives while the
 * admin tab stays open). STAGE 3: construct the Supabase-backed repository here instead; no screen changes.
 */
interface AdminContextValue {
  repo: AdminRepository;
  /** Mock-only controls; null once a real repository is wired in. */
  controls: MockControls | null;
  /** Increments after every write, so views re-read. */
  version: number;
  /** Increments when the mock data set is replaced, so forms drop their local state. */
  epoch: number;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new MockAdminStore());
  const version = useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
  const epoch = useSyncExternalStore(store.subscribe, store.getEpoch, () => 0);
  return (
    <AdminContext.Provider value={{ repo: store, controls: store, version, epoch }}>
      <ToastProvider>{children}</ToastProvider>
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}

/** Remounts the page when the mock data set is replaced (local form state would be stale otherwise). */
export function ResetBoundary({ children }: { children: ReactNode }) {
  const { epoch } = useAdmin();
  return <Fragment key={epoch}>{children}</Fragment>;
}

export type QueryState<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/**
 * Loads data through the repository. Re-reads after every write and when `deps` change; keeps the old data
 * on screen during a re-read (no flicker). The first load shows the loading state; a failure shows the
 * error state with a retry.
 */
export function useQuery<T>(
  load: (repo: AdminRepository) => Promise<T>,
  deps: readonly unknown[] = [],
): { state: QueryState<T>; reload: () => void } {
  const { repo, version } = useAdmin();
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load(repo).then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'The data could not be loaded.',
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; the explicit deps decide when to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version, attempt, ...deps]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
