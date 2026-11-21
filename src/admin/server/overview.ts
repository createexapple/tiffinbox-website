'use server';

/**
 * Dashboard overview (A-02; FR-30). Every figure is read from the database view `dashboard_overview`, which is
 * built from the same functions as the customer and payment lists, so card counts always equal the lists. The
 * only thing assembled here is the "unpublished changes" summary (see ./pending-loader).
 */
import { createSessionClient } from '@/lib/supabase/server';
import { karachiDateKey } from '@/lib/format';
import type { Overview } from '../types';
import { loadPendingState } from './pending-loader';
import type { ActionResult } from './result';
import { READ, runAction, unwrap } from './run';

interface OverviewDb {
  today: string;
  active_subscribers: number;
  office_members: number;
  unpaid_count: number;
  unpaid_total: number;
  overdue_count: number;
  overdue_total: number;
  renewal_due_count: number;
  renewal_window_days: number;
  total_customers: number;
  live_release_version: number | null;
  live_release_published_at: string | null;
  live_menu_week_start: string | null;
  scheduled_menu_week_start: string | null;
  scheduled_menu_go_live_at: string | null;
}

export async function getOverviewAction(): Promise<ActionResult<Overview>> {
  return runAction('getOverview', 'load_failed', async () => {
    const db = await createSessionClient();
    const [view, state] = await Promise.all([
      db.from('dashboard_overview').select('*').single(),
      loadPendingState(db),
    ]);
    const row = unwrap<OverviewDb>(view, READ);
    const areas = new Map<string, number>();
    for (const change of state.pending) areas.set(change.area, (areas.get(change.area) ?? 0) + 1);
    return {
      today: row.today,
      activeSubscribers: row.active_subscribers,
      officeMembers: row.office_members,
      unpaid: { count: row.unpaid_count, total: row.unpaid_total },
      overdue: { count: row.overdue_count, total: row.overdue_total },
      renewalDue: row.renewal_due_count,
      renewalWindowDays: row.renewal_window_days,
      totalCustomers: row.total_customers,
      pendingChanges: state.pending.length,
      scheduledMenu:
        row.scheduled_menu_week_start && row.scheduled_menu_go_live_at
          ? { weekStart: row.scheduled_menu_week_start, goLiveAt: row.scheduled_menu_go_live_at }
          : null,
      liveMenuWeekStart: row.live_menu_week_start,
      liveVersion: row.live_release_version ?? 0,
      liveVersionPublishedAt: row.live_release_published_at ?? '',
      pendingAreas: [...areas].map(([area, n]) => `${area} (${n})`),
    };
  });
}

/** Today's date and the current instant in Asia/Karachi terms (the app server's clock; the database uses its own). */
export async function getClockAction(): Promise<ActionResult<{ today: string; now: string }>> {
  return runAction('getClock', 'load_failed', async () => ({
    today: karachiDateKey(),
    now: new Date().toISOString(),
  }));
}
