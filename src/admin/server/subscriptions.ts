'use server';

/**
 * Subscription actions (A-15; FR-26). A subscription and its first billing period are created together by the
 * database function `create_subscription` (also used by Renew). Statuses and "renewal due" come from the
 * `subscription_status` view. Edits use the column-level grants of the `subscriptions` table.
 */
import { createSessionClient } from '@/lib/supabase/server';
import { karachiDateKey } from '@/lib/format';
import { rangesOverlap, isIsoDate } from '../dates';
import { validateSubscription } from '../validation/operations';
import type { SubscriptionValue } from '../validation/operations';
import type { SubscriptionRow } from '../types';
import { mapSubscriptionRow, type SubscriptionStatusDb } from './mappers';
import type { ActionResult } from './result';
import { READ, WRITE, assertUuid, check, runAction, stop, unwrap } from './run';

type Db = Awaited<ReturnType<typeof createSessionClient>>;

async function validated(db: Db, value: SubscriptionValue): Promise<SubscriptionValue> {
  const plans = unwrap<{ id: string }[] | null>(await db.from('plans').select('id'), READ) ?? [];
  const result = validateSubscription(
    {
      planId: value.planId,
      term: value.term,
      startDate: value.startDate,
      endDate: value.endDate,
      breakfastAddon: value.breakfastAddon,
      amount: String(value.amountPerPeriod),
      amountNote: value.amountNote,
      manualState: value.manualState,
      notes: value.notes,
    },
    // The "give a reason when the amount differs from the plan price" rule is form guidance in the browser; the
    // server enforces the hard rules (plan exists, dates, whole rupees, plain text).
    { planIds: plans.map((p) => p.id), suggestedAmount: null },
  );
  if (!result.ok) {
    const fields = Object.fromEntries(
      Object.entries(result.errors).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    stop('invalid', Object.values(fields).join(' '), fields);
  }
  return result.value;
}

async function rowById(db: Db, id: string): Promise<SubscriptionRow> {
  const rows = unwrap<SubscriptionStatusDb[] | null>(
    await db.from('subscription_status').select('*').eq('id', id),
    READ,
  );
  const row = rows?.[0];
  if (!row) stop('not_found', 'This subscription was not found.');
  return mapSubscriptionRow(row);
}

export async function getSubscriptionAction(id: string): Promise<ActionResult<SubscriptionRow>> {
  return runAction('getSubscription', 'load_failed', async () => {
    assertUuid(id, 'subscription');
    return rowById(await createSessionClient(), id);
  });
}

export async function createSubscriptionAction(
  customerId: string,
  value: SubscriptionValue,
  renewedFromId?: string,
): Promise<ActionResult<SubscriptionRow>> {
  return runAction('createSubscription', 'save_failed', async () => {
    assertUuid(customerId, 'customer');
    if (renewedFromId !== undefined) assertUuid(renewedFromId, 'subscription');
    const db = await createSessionClient();
    const v = await validated(db, value);
    const created = unwrap<{ id: string }>(
      await db.rpc('create_subscription', {
        customer_id: customerId,
        plan_id: v.planId,
        term: v.term,
        start_date: v.startDate,
        end_date: v.endDate,
        amount_per_period: v.amountPerPeriod,
        breakfast_addon: v.breakfastAddon,
        amount_note: v.amountNote,
        due_date: null,
        renewed_from_id: renewedFromId ?? null,
        notes: v.notes,
      }),
      WRITE,
    );
    if (v.manualState === 'paused') {
      check(
        (
          await db
            .from('subscriptions')
            .update({ manual_state: 'paused', manual_state_on: karachiDateKey() })
            .eq('id', created.id)
        ).error,
        WRITE,
      );
    }
    return rowById(db, created.id);
  });
}

export async function updateSubscriptionAction(
  id: string,
  value: SubscriptionValue,
): Promise<ActionResult<SubscriptionRow>> {
  return runAction('updateSubscription', 'save_failed', async () => {
    assertUuid(id, 'subscription');
    const db = await createSessionClient();
    const v = await validated(db, value);
    const existing = unwrap<{ manual_state: string; manual_state_on: string | null }[] | null>(
      await db.from('subscriptions').select('manual_state, manual_state_on').eq('id', id),
      READ,
    )?.[0];
    if (!existing) stop('not_found', 'This subscription was not found.');
    const rows = unwrap<{ id: string }[] | null>(
      await db
        .from('subscriptions')
        .update({
          plan_id: v.planId,
          term: v.term,
          start_date: v.startDate,
          end_date: v.endDate,
          breakfast_addon: v.breakfastAddon,
          amount_per_period: v.amountPerPeriod,
          amount_note: v.amountNote,
          manual_state: v.manualState,
          manual_state_on:
            v.manualState === existing.manual_state ? existing.manual_state_on : karachiDateKey(),
          notes: v.notes,
        })
        .eq('id', id)
        .select('id'),
      WRITE,
    );
    if (!rows || rows.length === 0) stop('not_found', 'This subscription was not found.');
    return rowById(db, id);
  });
}

/** An existing active (not paused) subscription of the same customer whose dates overlap (a warning: FR-26). */
export async function findOverlapAction(
  customerId: string,
  startDate: string,
  endDate: string,
  excludeSubscriptionId?: string,
): Promise<ActionResult<SubscriptionRow | null>> {
  return runAction('findOverlap', 'load_failed', async () => {
    assertUuid(customerId, 'customer');
    if (!isIsoDate(startDate) || !isIsoDate(endDate)) return null;
    const db = await createSessionClient();
    const rows =
      unwrap<SubscriptionStatusDb[] | null>(
        await db.from('subscription_status').select('*').eq('customer_id', customerId),
        READ,
      ) ?? [];
    const hit = rows.find(
      (s) =>
        s.id !== excludeSubscriptionId &&
        s.manual_state === 'active' &&
        rangesOverlap(s.start_date, s.end_date, startDate, endDate),
    );
    return hit ? mapSubscriptionRow(hit) : null;
  });
}
