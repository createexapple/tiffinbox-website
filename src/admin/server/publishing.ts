'use server';

/**
 * Preview, publish, roll back, and change history (A-10, A-11; FR-22, FR-23, NFR-06, NFR-08).
 *   publish:  `publish_content()` validates the drafts and, in one transaction, writes an immutable release and
 *             repoints the live site; a failure changes nothing (FR-22). Then the cached public content is
 *             expired at once and read back to confirm the new version is served (architecture sec. 8.1 step 4).
 *   rollback: `rollback_release(version)` repoints to an earlier release; drafts are untouched.
 * The live menu week is released separately by the database (menu weeks carry their own releases), so a content
 * publish also releases pending edits to the live week, which is what the Publish screen has always promised.
 */
import { updateTag } from 'next/cache';
import { PUBLIC_CONTENT_TAG, readPublishedContent } from '@/content/reader';
import { createSessionClient } from '@/lib/supabase/server';
import { isIsoDate } from '../dates';
import type { AuditEntry, AuditFilter, PublishOverview, PublishResult, Release } from '../types';
import { mapAuditEntry, type AuditDb, type AuditNames } from './audit';
import { loadPendingState } from './pending-loader';
import { buildPublishChecks } from './pending';
import type { ActionResult } from './result';
import { PUBLISH, READ, check, fetchAll, runAction, stop, unwrap } from './run';

interface ReleaseDb {
  version: number;
  published_at: string;
  note: string;
}

export async function getPublishOverviewAction(): Promise<ActionResult<PublishOverview>> {
  return runAction('getPublishOverview', 'load_failed', async () => {
    const db = await createSessionClient();
    const [state, releases, publishers] = await Promise.all([
      loadPendingState(db),
      db
        .from('content_releases')
        .select('version, published_at, note')
        .order('version', { ascending: false })
        .limit(50),
      db
        .from('change_history')
        .select('record_id, actor_label')
        .eq('table_name', 'content_releases')
        .eq('action', 'publish'),
    ]);
    const by = new Map(
      (unwrap<{ record_id: string; actor_label: string }[] | null>(publishers, READ) ?? []).map(
        (p) => [p.record_id, p.actor_label],
      ),
    );
    const liveVersion = state.status.current_release_version ?? 0;
    const checks = buildPublishChecks(state.status.publish_errors ?? []);
    const list: Release[] = (unwrap<ReleaseDb[] | null>(releases, READ) ?? []).map((r) => ({
      version: r.version,
      publishedAt: r.published_at,
      publishedBy: by.get(String(r.version)) ?? 'System',
      note: r.note,
      isLive: r.version === liveVersion,
    }));
    return {
      pending: state.pending,
      checks,
      canPublish: state.pending.length > 0 && checks.every((c) => c.ok),
      releases: list,
      liveVersion,
      unscheduledDraftWeeks: state.weeks
        .filter((w) => w.status === 'draft')
        .map((w) => w.week_start),
      scheduledWeeks: state.weeks
        .filter((w) => w.status === 'scheduled' && w.go_live_at)
        .map((w) => ({ weekStart: w.week_start, goLiveAt: w.go_live_at as string })),
    };
  });
}

export async function publishAction(): Promise<ActionResult<PublishResult>> {
  return runAction('publish', 'publish_failed', async () => {
    const db = await createSessionClient();
    const state = await loadPendingState(db);
    let version = state.status.current_release_version ?? 0;
    let publishedAt = new Date().toISOString();

    // 1. Content release first: it validates everything and changes nothing on failure.
    if (state.status.has_unpublished_changes) {
      const release = unwrap<{ version: number; published_at: string }>(
        await db.rpc('publish_content', { note: null }),
        PUBLISH,
      );
      version = release.version;
      publishedAt = release.published_at;
    }

    // 2. Pending edits to the live menu week are released with it.
    const weeks = state.weeks.filter((w) => w.status === 'published' && w.differs_from_released);
    for (const week of weeks) {
      const { error } = await db.rpc('release_menu_week', {
        menu_week_id: week.id,
        mode: 'publish_now',
      });
      if (error) {
        updateTag(PUBLIC_CONTENT_TAG);
        stop(
          'publish_failed',
          `Version v${version} is live, but this week's menu could not be released. Release it again from Menu.`,
        );
      }
    }
    if (!state.status.has_unpublished_changes && weeks.length === 0) {
      stop('invalid', 'There are no changes to publish.');
    }

    // 3. Expire the cached pages and confirm the site now serves this version.
    updateTag(PUBLIC_CONTENT_TAG);
    const served = await readPublishedContent().then(
      (read) => (read.document as { release?: { version?: number } }).release?.version,
      () => undefined,
    );
    return { version, publishedAt, visibleOnSite: served === version };
  });
}

export async function rollbackAction(version: number): Promise<ActionResult<null>> {
  return runAction('rollback', 'publish_failed', async () => {
    if (!Number.isInteger(version) || version < 1) stop('not_found', 'This version was not found.');
    const db = await createSessionClient();
    check((await db.rpc('rollback_release', { version })).error, PUBLISH);
    updateTag(PUBLIC_CONTENT_TAG);
    return null;
  });
}

// ---------- Change history ----------

const HISTORY_LIMIT = 500;
const NAMED_TABLES = ['plans', 'dishes', 'addons', 'faq_entries', 'customers'] as const;

export async function listAuditAction(filter: AuditFilter): Promise<ActionResult<AuditEntry[]>> {
  return runAction('listAudit', 'load_failed', async () => {
    const db = await createSessionClient();
    let query = db
      .from('change_history')
      .select(
        'id, at, actor_label, action, table_name, record_id, subject_customer_id, old_values, new_values, record_type',
      )
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (filter.recordType) query = query.eq('record_type', filter.recordType);
    if (filter.from && isIsoDate(filter.from))
      query = query.gte('at', `${filter.from}T00:00:00+05:00`);
    if (filter.to && isIsoDate(filter.to))
      query = query.lte('at', `${filter.to}T23:59:59.999+05:00`);
    const rows = unwrap<AuditDb[] | null>(await query, READ) ?? [];

    // Diff rows carry only the changed columns, so names come from the current tables.
    const needed = new Set(rows.map((r) => r.table_name));
    const names: { [K in keyof AuditNames]: Map<string, string> } = {
      plans: new Map(),
      dishes: new Map(),
      addons: new Map(),
      faq: new Map(),
      customers: new Map(),
    };
    await Promise.all(
      NAMED_TABLES.filter(
        (t) =>
          needed.has(t) ||
          (t === 'customers' && (needed.has('subscriptions') || needed.has('payments'))),
      ).map(async (table) => {
        const key = table === 'faq_entries' ? 'question' : 'name';
        const target = table === 'faq_entries' ? names.faq : names[table];
        const found = await fetchAll<{ id: string; name?: string; question?: string }>((from, to) =>
          db.from(table).select(`id, ${key}`).order('id').range(from, to),
        );
        for (const row of found) target.set(row.id, String(row[key as 'name' | 'question'] ?? ''));
      }),
    );
    return rows.map((row) => mapAuditEntry(row, names)).filter((e): e is AuditEntry => e !== null);
  });
}
