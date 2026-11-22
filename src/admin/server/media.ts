'use server';

/**
 * Image library actions (A-09, FR-21). Upload: the browser sends the file to this action; the server checks type,
 * size and content, strips metadata, stores a sanitised master in the public `media` bucket under a content-hash
 * name, and records the `media` row with required alt text. Delete: refuses images that are part of the live
 * site or a menu, warns (in the UI) about draft uses, detaches them, then removes the row and the file.
 */
import { createSessionClient } from '@/lib/supabase/server';
import { validateAltText, validateMediaFile } from '../validation/content';
import { weekLabel } from '../format';
import type { MediaRow } from '../repository';
import type { PageImageSlot } from '../types';
import { mapMedia, type MediaDb } from './mappers';
import { MediaRejected, processUpload } from './media-processing';
import type { ActionResult } from './result';
import { READ, WRITE, assertUuid, check, runAction, stop, unwrap } from './run';

const BUCKET = 'media';
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Usage {
  dishes: { id: string; name: string; media_id: string }[];
  pages: { slot_key: string; media_id: string }[];
  slots: {
    media_id: string;
    day_of_week: number;
    meal: string;
    menu_weeks: { week_start: string } | null;
  }[];
}

async function loadUsage(db: Awaited<ReturnType<typeof createSessionClient>>): Promise<Usage> {
  const [dishes, pages, slots] = await Promise.all([
    db.from('dishes').select('id, name, media_id').not('media_id', 'is', null),
    db.from('page_images').select('slot_key, media_id'),
    db
      .from('menu_slots')
      .select('media_id, day_of_week, meal, menu_weeks(week_start)')
      .not('media_id', 'is', null),
  ]);
  return {
    dishes: unwrap<Usage['dishes'] | null>(dishes, READ) ?? [],
    pages: unwrap<Usage['pages'] | null>(pages, READ) ?? [],
    slots: unwrap<Usage['slots'] | null>(slots, READ) ?? [],
  };
}

function usedOn(usage: Usage, mediaId: string): string[] {
  const out: string[] = [];
  for (const p of usage.pages) {
    if (p.media_id !== mediaId) continue;
    out.push(p.slot_key === 'og_share' ? 'Share preview image' : 'Home page (main photo)');
  }
  for (const d of usage.dishes) if (d.media_id === mediaId) out.push(`Customize page (${d.name})`);
  for (const s of usage.slots) {
    if (s.media_id !== mediaId) continue;
    const week = s.menu_weeks?.week_start ? weekLabel(s.menu_weeks.week_start) : 'a week';
    out.push(`Menu ${week} (${DAY[s.day_of_week - 1] ?? 'day'} ${s.meal})`);
  }
  return out;
}

export async function listMediaAction(): Promise<ActionResult<MediaRow[]>> {
  return runAction('listMedia', 'load_failed', async () => {
    const db = await createSessionClient();
    const [media, usage] = await Promise.all([
      db.from('media').select('*').order('created_at', { ascending: false }),
      loadUsage(db),
    ]);
    return (unwrap<MediaDb[] | null>(media, READ) ?? []).map((row) => ({
      ...mapMedia(row),
      usedOn: usedOn(usage, row.id),
      url: db.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    }));
  });
}

export async function uploadMediaAction(form: FormData): Promise<ActionResult<MediaRow>> {
  return runAction('uploadMedia', 'save_failed', async (admin) => {
    const file = form.get('file');
    const alt = String(form.get('alt') ?? '');
    if (!(file instanceof File)) stop('invalid', 'Choose a photo to upload.');

    const fileProblems = validateMediaFile({ name: file.name, type: file.type, size: file.size });
    if (fileProblems.length > 0)
      stop('invalid', fileProblems.join(' '), { file: fileProblems.join(' ') });
    const altProblem = validateAltText(alt);
    if (altProblem) stop('invalid', altProblem, { alt: altProblem });

    let image;
    try {
      image = await processUpload(Buffer.from(await file.arrayBuffer()), {
        name: file.name,
        type: file.type,
        size: file.size,
      });
    } catch (error) {
      if (error instanceof MediaRejected) stop('invalid', error.message, { file: error.message });
      throw error;
    }

    const db = await createSessionClient();
    const path = `${image.checksum}.${image.extension}`;
    const existing = unwrap<{ id: string }[] | null>(
      await db.from('media').select('id').eq('storage_path', path),
      READ,
    );
    if (existing && existing.length > 0) stop('invalid', 'This photo is already in your library.');

    // An object with the same content hash may be left over from an earlier failed attempt; reuse it.
    const upload = await db.storage.from(BUCKET).upload(path, image.buffer, {
      contentType: image.contentType,
      upsert: false,
    });
    const alreadyThere = upload.error && /already exists|duplicate/i.test(upload.error.message);
    if (upload.error && !alreadyThere)
      stop('save_failed', 'The photo could not be stored. Nothing was saved. Please try again.');

    const inserted = await db
      .from('media')
      .insert({
        storage_path: path,
        file_name: file.name.replace(/[\\/<>]/g, '').slice(0, 200),
        alt_text: alt.trim(),
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        checksum: image.checksum,
        uploaded_by: admin.userId,
      })
      .select('*')
      .single();
    if (inserted.error) {
      if (!alreadyThere)
        await db.storage
          .from(BUCKET)
          .remove([path])
          .catch(() => undefined);
      check(inserted.error, WRITE);
    }
    const created = inserted.data as MediaDb;
    return {
      ...mapMedia(created),
      usedOn: [],
      url: db.storage.from(BUCKET).getPublicUrl(created.storage_path).data.publicUrl,
    };
  });
}

const PAGE_SLOTS: readonly string[] = ['home_hero', 'og_share'];

/**
 * Assigns an image to a fixed place on the site (or clears the place with `mediaId` null). This changes the
 * draft only: visitors see it after the next Publish.
 */
export async function setPageImageAction(
  slot: PageImageSlot,
  mediaId: string | null,
): Promise<ActionResult<null>> {
  return runAction('setPageImage', 'save_failed', async () => {
    if (!PAGE_SLOTS.includes(slot)) stop('invalid', 'Unknown place for an image.');
    const db = await createSessionClient();
    if (mediaId === null) {
      check((await db.from('page_images').delete().eq('slot_key', slot)).error, WRITE);
      return null;
    }
    assertUuid(mediaId, 'image');
    const found = unwrap<{ id: string }[] | null>(
      await db.from('media').select('id').eq('id', mediaId),
      READ,
    );
    if (!found || found.length === 0) stop('not_found', 'This image was not found.');
    check(
      (
        await db
          .from('page_images')
          .upsert(
            { slot_key: slot, media_id: mediaId, updated_at: new Date().toISOString() },
            { onConflict: 'slot_key' },
          )
      ).error,
      WRITE,
    );
    return null;
  });
}

export async function deleteMediaAction(id: string): Promise<ActionResult<null>> {
  return runAction('deleteMedia', 'save_failed', async () => {
    assertUuid(id, 'image');
    const db = await createSessionClient();
    const row = (unwrap<MediaDb[] | null>(await db.from('media').select('*').eq('id', id), READ) ??
      [])[0];
    if (!row) stop('not_found', 'This image was not found.');

    // 1. Live or scheduled use blocks deletion (the database enforces the same rule as a last guard).
    const [published, weeks] = await Promise.all([
      db.rpc('get_public_content'),
      db.from('menu_weeks').select('go_live_at, live_payload').not('go_live_at', 'is', null),
    ]);
    const scheduled = (
      unwrap<{ go_live_at: string; live_payload: unknown }[] | null>(weeks, READ) ?? []
    ).filter((w) => Date.parse(w.go_live_at) > Date.now());
    const liveText = JSON.stringify([
      published.data ?? null,
      ...scheduled.map((w) => w.live_payload),
    ]);
    if (liveText.includes(row.storage_path)) {
      stop(
        'blocked',
        'This image is on the live website or in a scheduled menu. Remove it from the draft, publish, then delete it.',
      );
    }

    // 2. A menu week's slot photo cannot be detached from here (menu weeks are written by functions only).
    const usage = await loadUsage(db);
    if (usage.slots.some((s) => s.media_id === id)) {
      stop('blocked', 'This image is used in a menu week. Remove it there first.');
    }

    // 3. Draft uses are detached (the admin was warned in the dialog), then the row and the file go.
    check((await db.from('dishes').update({ media_id: null }).eq('media_id', id)).error, WRITE);
    check((await db.from('page_images').delete().eq('media_id', id)).error, WRITE);
    check((await db.from('media').delete().eq('id', id)).error, WRITE);
    const removed = await db.storage.from(BUCKET).remove([row.storage_path]);
    if (removed.error) console.warn(JSON.stringify({ event: 'media_file_remove_failed' }));
    return null;
  });
}
