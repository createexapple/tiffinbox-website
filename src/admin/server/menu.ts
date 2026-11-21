'use server';

/**
 * Menu week actions (A-03; FR-14, FR-15, FR-06). All writes go through the database functions `save_menu_week`,
 * `copy_menu_week` and `release_menu_week` (menu tables have no direct write grants; docs/database.md sec. 4).
 * Statuses (draft / scheduled / published / past) come from the `menu_week_status` view, never from here.
 * Contract translations (day 0..6 <-> 1..7, `published` -> `live`) are in ./mappers.
 */
import { updateTag } from 'next/cache';
import { PUBLIC_CONTENT_TAG } from '@/content/reader';
import { createSessionClient } from '@/lib/supabase/server';
import { validateMenuSlots } from '../validation/content';
import type { MenuSlot, MenuWeekView } from '../types';
import {
  mapMenuWeek,
  slotsToDb,
  type MenuSlotDb,
  type MenuWeekDb,
  type MenuWeekStatusDb,
} from './mappers';
import type { ActionResult } from './result';
import { READ, WRITE, check, fetchAll, runAction, stop, unwrap } from './run';

type Db = Awaited<ReturnType<typeof createSessionClient>>;

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/;

async function weekIdFor(db: Db, weekStart: string): Promise<string> {
  if (!WEEK_START.test(weekStart)) stop('not_found', 'This menu week was not found.');
  const rows = unwrap<{ id: string }[] | null>(
    await db.from('menu_weeks').select('id').eq('week_start', weekStart),
    READ,
  );
  const id = rows?.[0]?.id;
  if (!id) stop('not_found', 'This menu week was not found.');
  return id;
}

async function loadViews(db: Db, weekStart?: string): Promise<MenuWeekView[]> {
  // Paged reads: PostgREST returns at most 1000 rows per request and 21 slots per week add up over a year.
  const [weekRows, slotRows, statuses] = await Promise.all([
    fetchAll<MenuWeekDb>((from, to) => {
      const query = db
        .from('menu_weeks')
        .select('id, week_start, go_live_at, live_payload')
        .order('week_start')
        .range(from, to);
      return weekStart ? query.eq('week_start', weekStart) : query;
    }),
    fetchAll<MenuSlotDb>((from, to) =>
      db
        .from('menu_slots')
        .select('menu_week_id, day_of_week, meal, dish_text, not_served, media_id')
        .order('id')
        .range(from, to),
    ),
    db.from('menu_week_status').select('id, status, differs_from_released'),
  ]);
  const statusRows = new Map(
    (unwrap<MenuWeekStatusDb[] | null>(statuses, READ) ?? []).map((s) => [s.id, s]),
  );
  return weekRows.map((w) =>
    mapMenuWeek(
      w,
      slotRows.filter((s) => s.menu_week_id === w.id),
      statusRows.get(w.id),
    ),
  );
}

async function viewOf(db: Db, weekStart: string): Promise<MenuWeekView> {
  const view = (await loadViews(db, weekStart))[0];
  if (!view) stop('not_found', 'This menu week was not found.');
  return view;
}

export async function listMenuWeeksAction(): Promise<ActionResult<MenuWeekView[]>> {
  return runAction('listMenuWeeks', 'load_failed', async () =>
    loadViews(await createSessionClient()),
  );
}

export async function saveMenuWeekAction(
  weekStart: string,
  slots: MenuSlot[],
): Promise<ActionResult<MenuWeekView>> {
  return runAction('saveMenuWeek', 'save_failed', async () => {
    if (!Array.isArray(slots) || slots.length !== 21)
      stop('invalid', 'A week needs exactly 21 slots.');
    const problems = validateMenuSlots(slots);
    if (Object.keys(problems).length > 0) stop('invalid', 'Some menu slots need fixing.', problems);
    const db = await createSessionClient();

    // Keep a slot's photo if it already has one (the editor has no photo field).
    const rows = unwrap<(MenuSlotDb & { menu_weeks: { week_start: string } | null })[] | null>(
      await db
        .from('menu_slots')
        .select('day_of_week, meal, media_id, dish_text, not_served, menu_weeks!inner(week_start)')
        .eq('menu_weeks.week_start', weekStart),
      READ,
    );
    const media = new Map(
      (rows ?? []).map((r) => [`${r.day_of_week}/${r.meal}`, r.media_id ?? null]),
    );

    check(
      (await db.rpc('save_menu_week', { week_start: weekStart, slots: slotsToDb(slots, media) }))
        .error,
      WRITE,
    );
    return viewOf(db, weekStart);
  });
}

export async function copyMenuWeekAction(
  fromWeekStart: string,
  toWeekStart: string,
): Promise<ActionResult<MenuWeekView>> {
  return runAction('copyMenuWeek', 'save_failed', async () => {
    const db = await createSessionClient();
    const sourceId = await weekIdFor(db, fromWeekStart);
    check(
      (await db.rpc('copy_menu_week', { source_week_id: sourceId, week_start: toWeekStart })).error,
      WRITE,
    );
    return viewOf(db, toWeekStart);
  });
}

export async function scheduleMenuWeekAction(
  weekStart: string,
  goLiveAt: string,
): Promise<ActionResult<MenuWeekView>> {
  return runAction('scheduleMenuWeek', 'save_failed', async () => {
    const at = Date.parse(goLiveAt);
    if (Number.isNaN(at))
      stop('invalid', 'Choose the go-live date and time.', {
        go_live_at: 'Choose the go-live date and time.',
      });
    if (at <= Date.now()) {
      const message = 'Choose a time in the future, or use Publish now.';
      stop('invalid', message, { go_live_at: message });
    }
    const db = await createSessionClient();
    const id = await weekIdFor(db, weekStart);
    check(
      (
        await db.rpc('release_menu_week', {
          menu_week_id: id,
          mode: 'schedule',
          go_live_at: new Date(at).toISOString(),
        })
      ).error,
      WRITE,
    );
    return viewOf(db, weekStart);
  });
}

export async function cancelMenuScheduleAction(
  weekStart: string,
): Promise<ActionResult<MenuWeekView>> {
  return runAction('cancelMenuSchedule', 'save_failed', async () => {
    const db = await createSessionClient();
    const id = await weekIdFor(db, weekStart);
    check(
      (await db.rpc('release_menu_week', { menu_week_id: id, mode: 'cancel_schedule' })).error,
      WRITE,
    );
    return viewOf(db, weekStart);
  });
}

export async function publishMenuNowAction(weekStart: string): Promise<ActionResult<MenuWeekView>> {
  return runAction('publishMenuNow', 'save_failed', async () => {
    const db = await createSessionClient();
    const id = await weekIdFor(db, weekStart);
    check(
      (await db.rpc('release_menu_week', { menu_week_id: id, mode: 'publish_now' })).error,
      WRITE,
    );
    // The live menu changed: expire the cached public content so visitors see it at once (NFR-06).
    updateTag(PUBLIC_CONTENT_TAG);
    return viewOf(db, weekStart);
  });
}
