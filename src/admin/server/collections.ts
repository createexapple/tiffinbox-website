/**
 * Ordered draft collections (dishes, add-ons, FAQ; FR-17..19) over one generic implementation. Each saves to its
 * draft table with the admin's own session (RLS), validates on the server with the shared validation modules, and
 * keeps `sort_order` as a clean 1..n sequence. Not a server action file: the thin `'use server'` wrappers in
 * ./content.ts call these inside `runAction`.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateAddon, validateDish, validateFaq } from '../validation/content';
import type { AddonDraft, DishDraft, FaqDraft } from '../types';
import type { AddonValues, DishValues, FaqValues } from '../repository';
import { mapAddon, mapDish, mapFaq, type AddonDb, type DishDb, type FaqDb } from './mappers';
import { READ, WRITE, assertUuid, check, stop, unwrap } from './run';

interface Spec<Db extends { id: string; sort_order: number }, Row, Values> {
  table: 'dishes' | 'addons' | 'faq_entries';
  noun: string;
  map: (row: Db) => Row;
  /** Validates and converts the incoming values to database columns, or stops with a field-level failure. */
  toDb: (values: Values) => Record<string, unknown>;
}

function failFields(errors: Record<string, string | undefined>): never {
  const fields = Object.fromEntries(
    Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
  stop('invalid', Object.values(fields).join(' '), fields);
}

function spec<Db extends { id: string; sort_order: number }, Row, Values>(
  s: Spec<Db, Row, Values>,
) {
  return {
    async list(db: SupabaseClient): Promise<Row[]> {
      const rows = unwrap<Db[] | null>(
        await db.from(s.table).select('*').order('sort_order').order('id'),
        READ,
      );
      return (rows ?? []).map(s.map);
    },

    async save(db: SupabaseClient, id: string | null, values: Values): Promise<Row> {
      const columns = s.toDb(values);
      if (id === null) {
        const last = unwrap<{ sort_order: number }[] | null>(
          await db
            .from(s.table)
            .select('sort_order')
            .order('sort_order', { ascending: false })
            .limit(1),
          READ,
        );
        const next = (last?.[0]?.sort_order ?? 0) + 1;
        const row = unwrap<Db>(
          await db
            .from(s.table)
            .insert({ ...columns, sort_order: next })
            .select('*')
            .single(),
          WRITE,
        );
        return s.map(row);
      }
      assertUuid(id, s.noun);
      const rows = unwrap<Db[] | null>(
        await db.from(s.table).update(columns).eq('id', id).select('*'),
        WRITE,
      );
      const row = rows?.[0];
      if (!row) stop('not_found', `This ${s.noun} was not found.`);
      return s.map(row);
    },

    async remove(db: SupabaseClient, id: string): Promise<void> {
      assertUuid(id, s.noun);
      const rows = unwrap<{ id: string }[] | null>(
        await db.from(s.table).delete().eq('id', id).select('id'),
        WRITE,
      );
      if (!rows || rows.length === 0) stop('not_found', `This ${s.noun} was not found.`);
      await renumber(db, s.table);
    },

    async move(
      db: SupabaseClient,
      id: string,
      direction: 'up' | 'down',
    ): Promise<{ position: number; total: number }> {
      assertUuid(id, s.noun);
      const rows =
        unwrap<{ id: string; sort_order: number }[] | null>(
          await db.from(s.table).select('id, sort_order').order('sort_order').order('id'),
          READ,
        ) ?? [];
      const index = rows.findIndex((r) => r.id === id);
      if (index < 0) stop('not_found', `This ${s.noun} was not found.`);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target >= 0 && target < rows.length) {
        const order = rows.map((r) => r.id);
        const [moved] = order.splice(index, 1);
        if (moved !== undefined) order.splice(target, 0, moved);
        await writeOrder(db, s.table, order, rows);
      }
      return {
        position: Math.min(Math.max(target, 0), rows.length - 1) + 1,
        total: rows.length,
      };
    },
  };
}

/** Writes sort_order = position for every row whose position changed. */
async function writeOrder(
  db: SupabaseClient,
  table: Spec<{ id: string; sort_order: number }, unknown, unknown>['table'],
  order: readonly string[],
  current: readonly { id: string; sort_order: number }[],
): Promise<void> {
  const bySort = new Map(current.map((r) => [r.id, r.sort_order]));
  const updates = order
    .map((rowId, i) => ({ rowId, position: i + 1 }))
    .filter(({ rowId, position }) => bySort.get(rowId) !== position);
  const results = await Promise.all(
    updates.map(({ rowId, position }) =>
      db.from(table).update({ sort_order: position }).eq('id', rowId),
    ),
  );
  for (const result of results) check(result.error, WRITE);
}

async function renumber(
  db: SupabaseClient,
  table: Spec<{ id: string; sort_order: number }, unknown, unknown>['table'],
): Promise<void> {
  const rows =
    unwrap<{ id: string; sort_order: number }[] | null>(
      await db.from(table).select('id, sort_order').order('sort_order').order('id'),
      READ,
    ) ?? [];
  await writeOrder(
    db,
    table,
    rows.map((r) => r.id),
    rows,
  );
}

function dishColumns(values: DishValues): Record<string, unknown> {
  const result = validateDish({
    name: values.name,
    comesWith: values.comesWith,
    price: String(values.price),
    isHidden: values.isHidden,
  });
  if (!result.ok) failFields(result.errors);
  if (values.mediaId !== null) assertUuid(values.mediaId, 'image');
  return {
    name: result.value.name,
    comes_with: result.value.comesWith,
    price: result.value.price,
    is_hidden: result.value.isHidden,
    media_id: values.mediaId,
  };
}

function addonColumns(values: AddonValues): Record<string, unknown> {
  const result = validateAddon({
    name: values.name,
    price: String(values.price),
    isHidden: values.isHidden,
  });
  if (!result.ok) failFields(result.errors);
  return { name: result.value.name, price: result.value.price, is_hidden: result.value.isHidden };
}

function faqColumns(values: FaqValues): Record<string, unknown> {
  const result = validateFaq({
    question: values.question,
    answer: values.answer,
    isHidden: values.isHidden,
  });
  if (!result.ok) failFields(result.errors);
  return {
    question: result.value.question,
    answer: result.value.answer,
    is_hidden: result.value.isHidden,
  };
}

export const dishes = spec<DishDb, DishDraft, DishValues>({
  table: 'dishes',
  noun: 'dish',
  map: mapDish,
  toDb: dishColumns,
});
export const addons = spec<AddonDb, AddonDraft, AddonValues>({
  table: 'addons',
  noun: 'add-on',
  map: mapAddon,
  toDb: addonColumns,
});
export const faq = spec<FaqDb, FaqDraft, FaqValues>({
  table: 'faq_entries',
  noun: 'question',
  map: mapFaq,
  toDb: faqColumns,
});
