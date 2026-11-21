'use server';

/**
 * Payment and dues actions (A-16, A-17; FR-28, FR-29). Dues, paid amounts, balances and paid / unpaid / overdue
 * come from the `period_payment_status` view (payments applied to periods oldest first, architecture sec. 9.2);
 * nothing is recalculated here. Payments are never deleted: `void_payment` keeps the row and the original values.
 */
import { createSessionClient } from '@/lib/supabase/server';
import { isIsoDate } from '../dates';
import { validatePayment, validateVoidReason } from '../validation/operations';
import type { PaymentValue } from '../validation/operations';
import type { PaymentFilter, PaymentMethod, PaymentRow, PeriodRow } from '../types';
import {
  PAYMENT_SELECT,
  mapPaymentRow,
  mapPeriodRow,
  type PaymentDb,
  type PeriodStatusDb,
} from './mappers';
import type { ActionResult } from './result';
import { READ, WRITE, assertUuid, check, fetchAll, runAction, stop, unwrap } from './run';

type Db = Awaited<ReturnType<typeof createSessionClient>>;

function validated(value: PaymentValue): PaymentValue {
  const result = validatePayment({
    subscriptionId: value.subscriptionId,
    coversFrom: value.coversFrom,
    coversTo: value.coversTo,
    amount: String(value.amount),
    paidOn: value.paidOn,
    method: value.method,
    reference: value.reference,
    note: value.note,
  });
  if (!result.ok) {
    const fields = Object.fromEntries(
      Object.entries(result.errors).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    stop('invalid', Object.values(fields).join(' '), fields);
  }
  assertUuid(result.value.subscriptionId, 'subscription');
  return result.value;
}

async function paymentById(db: Db, id: string): Promise<PaymentRow> {
  const rows = unwrap<PaymentDb[] | null>(
    await db.from('payments').select(PAYMENT_SELECT).eq('id', id),
    READ,
  );
  const row = rows?.[0];
  if (!row) stop('not_found', 'This payment was not found.');
  return mapPaymentRow(row);
}

export async function listDuesAction(
  filter: Pick<PaymentFilter, 'status' | 'from' | 'to'>,
): Promise<ActionResult<PeriodRow[]>> {
  return runAction('listDues', 'load_failed', async () => {
    const db = await createSessionClient();
    const rows = await fetchAll<PeriodStatusDb>((from, to) => {
      let query = db
        .from('period_payment_status')
        .select('*')
        .order('due_date')
        .order('period_id')
        .range(from, to);
      if (filter.status === undefined) query = query.in('status', ['unpaid', 'overdue']);
      else if (filter.status !== 'all') query = query.eq('status', filter.status);
      if (filter.from && isIsoDate(filter.from)) query = query.gte('due_date', filter.from);
      if (filter.to && isIsoDate(filter.to)) query = query.lte('due_date', filter.to);
      return query;
    });
    return rows
      .map(mapPeriodRow)
      .sort(
        (a, b) =>
          Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
          a.dueDate.localeCompare(b.dueDate),
      );
  });
}

export async function listPaymentsAction(
  filter: Pick<PaymentFilter, 'method' | 'from' | 'to'>,
): Promise<ActionResult<PaymentRow[]>> {
  return runAction('listPayments', 'load_failed', async () => {
    const db = await createSessionClient();
    const rows = await fetchAll<PaymentDb>((from, to) => {
      let query = db
        .from('payments')
        .select(PAYMENT_SELECT)
        .order('paid_on', { ascending: false })
        .order('id')
        .range(from, to);
      if (filter.method) query = query.eq('method', filter.method);
      if (filter.from && isIsoDate(filter.from)) query = query.gte('paid_on', filter.from);
      if (filter.to && isIsoDate(filter.to)) query = query.lte('paid_on', filter.to);
      return query;
    });
    return rows.map(mapPaymentRow);
  });
}

export async function getPaymentAction(id: string): Promise<ActionResult<PaymentRow>> {
  return runAction('getPayment', 'load_failed', async () => {
    assertUuid(id, 'payment');
    return paymentById(await createSessionClient(), id);
  });
}

export async function createPaymentAction(
  customerId: string,
  value: PaymentValue,
): Promise<ActionResult<PaymentRow>> {
  return runAction('createPayment', 'save_failed', async () => {
    assertUuid(customerId, 'customer');
    const v = validated(value);
    const db = await createSessionClient();
    const row = unwrap<PaymentDb>(
      await db
        .from('payments')
        .insert({
          customer_id: customerId,
          subscription_id: v.subscriptionId,
          amount: v.amount,
          method: v.method,
          paid_on: v.paidOn,
          covers_from: v.coversFrom,
          covers_to: v.coversTo,
          reference: v.reference,
          note: v.note,
        })
        .select(PAYMENT_SELECT)
        .single(),
      WRITE,
    );
    return mapPaymentRow(row);
  });
}

export async function updatePaymentAction(
  id: string,
  value: PaymentValue,
): Promise<ActionResult<PaymentRow>> {
  return runAction('updatePayment', 'save_failed', async () => {
    assertUuid(id, 'payment');
    const v = validated(value);
    const db = await createSessionClient();
    const rows = unwrap<PaymentDb[] | null>(
      await db
        .from('payments')
        .update({
          subscription_id: v.subscriptionId,
          amount: v.amount,
          method: v.method,
          paid_on: v.paidOn,
          covers_from: v.coversFrom,
          covers_to: v.coversTo,
          reference: v.reference,
          note: v.note,
        })
        .eq('id', id)
        .select(PAYMENT_SELECT),
      WRITE,
    );
    if (rows && rows[0]) return mapPaymentRow(rows[0]);
    // No row changed: either it does not exist, or it is voided (the update policy excludes voided rows).
    const existing = await paymentById(db, id);
    if (existing.voidedAt) stop('invalid', 'A voided payment cannot be edited.');
    stop('save_failed', 'That could not be saved. Nothing was changed. Please try again.');
  });
}

export async function voidPaymentAction(
  id: string,
  reason: string,
): Promise<ActionResult<PaymentRow>> {
  return runAction('voidPayment', 'save_failed', async () => {
    assertUuid(id, 'payment');
    const problem = validateVoidReason(String(reason ?? ''));
    if (problem) stop('invalid', problem, { reason: problem });
    const db = await createSessionClient();
    check(
      (await db.rpc('void_payment', { payment_id: id, reason: String(reason).trim() })).error,
      WRITE,
    );
    return paymentById(db, id);
  });
}

/** Another non-voided payment with the same method and reference (a warning: FR-28). */
export async function findDuplicateReferenceAction(
  method: PaymentMethod,
  reference: string,
  excludePaymentId?: string,
): Promise<ActionResult<PaymentRow | null>> {
  return runAction('findDuplicateReference', 'load_failed', async () => {
    const ref = String(reference ?? '').trim();
    if (ref === '' || !['jazzcash', 'easypaisa', 'bank_transfer'].includes(method)) return null;
    const db = await createSessionClient();
    // Case-insensitive exact match: escape LIKE wildcards in the value.
    const pattern = ref.replace(/[\\%_]/g, (c) => `\\${c}`);
    let query = db
      .from('payments')
      .select(PAYMENT_SELECT)
      .eq('method', method)
      .is('voided_at', null)
      .ilike('reference', pattern)
      .limit(2);
    if (excludePaymentId) {
      assertUuid(excludePaymentId, 'payment');
      query = query.neq('id', excludePaymentId);
    }
    const rows = unwrap<PaymentDb[] | null>(await query, READ);
    return rows?.[0] ? mapPaymentRow(rows[0]) : null;
  });
}
