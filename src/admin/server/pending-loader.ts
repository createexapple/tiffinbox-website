/**
 * Loads what the dashboard pill and the Preview & publish screen need to say about unpublished changes: the
 * database's own verdict (`draft_status()`), the draft and live documents to word the differences, and the live
 * menu week's unreleased edits. Not a server action file; called inside `runAction` bodies.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingChange } from '../types';
import { describePending, type PublishErrorDb } from './pending';
import { READ, fetchAll, unwrap } from './run';
import type { MenuSlotDb } from './mappers';

export interface DraftStatusDb {
  has_unpublished_changes: boolean;
  current_release_version: number | null;
  changed_areas: string[];
  publish_errors: PublishErrorDb[];
  scheduled_menu: { id: string; week_start: string; go_live_at: string } | null;
}

export interface MenuWeekStatusRow {
  id: string;
  week_start: string;
  status: string;
  go_live_at: string | null;
  differs_from_released: boolean;
}

export interface PendingState {
  status: DraftStatusDb;
  pending: PendingChange[];
  weeks: MenuWeekStatusRow[];
}

const sig = (s: Pick<MenuSlotDb, 'dish_text' | 'not_served'>) =>
  s.not_served ? '\u0000' : s.dish_text.trim();

export async function loadPendingState(db: SupabaseClient): Promise<PendingState> {
  const [status, draft, released, weeks] = await Promise.all([
    db.rpc('draft_status'),
    db.rpc('get_draft_content', { menu_week_id: null }),
    db.rpc('get_public_content'),
    db.from('menu_week_status').select('id, week_start, status, go_live_at, differs_from_released'),
  ]);
  const draftStatus = unwrap<DraftStatusDb>(status, READ);
  const draftDoc = unwrap<Record<string, unknown>>(draft, READ);
  const releasedDoc = unwrap<Record<string, unknown> | null>(released, READ);
  const weekRows = unwrap<MenuWeekStatusRow[] | null>(weeks, READ) ?? [];

  // Edits to the LIVE week are drafts until released again (FR-14): count the slots that differ.
  let liveWeekEdits: { weekStart: string; editedSlots: number } | null = null;
  const live = weekRows.find((w) => w.status === 'published' && w.differs_from_released);
  if (live) {
    const [slotsRes, payloadRes] = await Promise.all([
      fetchAll<MenuSlotDb>((from, to) =>
        db
          .from('menu_slots')
          .select('day_of_week, meal, dish_text, not_served')
          .eq('menu_week_id', live.id)
          .order('id')
          .range(from, to),
      ),
      db.from('menu_weeks').select('live_payload').eq('id', live.id).single(),
    ]);
    const payload = unwrap<{ live_payload: { slots?: MenuSlotDb[] } | null }>(payloadRes, READ);
    const releasedSlots = new Map(
      (payload.live_payload?.slots ?? []).map((s) => [`${s.day_of_week}/${s.meal}`, sig(s)]),
    );
    const edited = slotsRes.filter(
      (s) => releasedSlots.get(`${s.day_of_week}/${s.meal}`) !== sig(s),
    ).length;
    liveWeekEdits = { weekStart: live.week_start, editedSlots: Math.max(1, edited) };
  }

  return {
    status: draftStatus,
    weeks: weekRows,
    pending: describePending({
      released: releasedDoc,
      draft: draftDoc,
      changedAreas: draftStatus.changed_areas ?? [],
      liveWeekEdits,
    }),
  };
}
