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
import { ActionsAdminRepository } from '@/admin/actions-repository';
import type { AdminRepository } from '@/admin/repository';
import { MockAdminStore, type MockControls } from '@/admin/mock/store';
import { ToastProvider } from './Toast';

/**
 * Wires the screens to a repository. Normally the Supabase-backed one (server actions). `mode="mock"` is chosen on
 * the server only under the explicit test flag (src/lib/env.ts `isMockBackend`) and gives the in-memory mock for
 * network-free unit and e2e tests. Screens never know which one they have.
 */
export type AdminMode = 'live' | 'mock';

interface AdminContextValue {
  repo: AdminRepository;
  /** Mock-only controls; null with the real repository. */
  controls: MockControls | null;
  /** Increments after every write, so views re-read. */
  version: number;
  /** Increments when the mock data set is replaced (always 0 for the real repository), so forms drop local state. */
  epoch: number;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ mode, children }: { mode: AdminMode; children: ReactNode }) {
  return mode === 'mock' ? (
    <MockProvider>{children}</MockProvider>
  ) : (
    <LiveProvider>{children}</LiveProvider>
  );
}

function LiveProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(() => new ActionsAdminRepository());
  const version = useSyncExternalStore(repo.subscribe, repo.getVersion, () => 0);
  return (
    <AdminContext.Provider value={{ repo, controls: null, version, epoch: 0 }}>
      <ToastProvider>{children}</ToastProvider>
    </AdminContext.Provider>
  );
}

function MockProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new MockAdminStore());
  const version = useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
  const epoch = useSyncExternalStore(store.subscribe, store.getEpoch, () => 0);
  return (
    <AdminContext.Provider value={{ repo: store, controls: store, version, epoch }}>
      <ToastProvider>{children}</ToastProvider>
    </AdminContext.Provider>
  );
}

/** Admin shell chrome that only exists in test mode (the banner and its controls). */
export function MockOnly({ children }: { children: ReactNode }) {
  const { controls } = useAdmin();
  return controls ? <>{children}</> : null;
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
