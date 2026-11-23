'use server';

/**
 * Customer actions (A-12..A-14; FR-24, FR-25). Statuses and filters come from the `customer_summary` and
 * `subscription_status` views. Search runs here on the server over rows read page by page (customer text is never
 * put in a URL or query string, NFR-12). Customers are archived, never deleted (A-26).
 */
import { createSessionClient } from '@/lib/supabase/server';
import { normalisePhone, validateCustomer } from '../validation/operations';
import type { CustomerValues } from '../repository';
import type { Customer, CustomerDetail, CustomerFilter, CustomerRow } from '../types';
import {
  mapCustomer,
  mapCustomerRow,
  mapPaymentRow,
  mapPeriodRow,
  mapSubscriptionRow,
  matchesCustomerSearch,
  PAYMENT_SELECT,
  phoneToDb,
  type CustomerDb,
  type CustomerSummaryDb,
  type PaymentDb,
  type PeriodStatusDb,
  type SubscriptionStatusDb,
} from './mappers';
import type { ActionResult } from './result';
import { READ, WRITE, assertUuid, fetchAll, runAction, stop, unwrap } from './run';

function toColumns(values: CustomerValues): Record<string, unknown> {
  const result = validateCustomer({
    type: values.type,
    name: values.name,
    phone: values.phone,
    address: values.address,
    orgName: values.orgName,
    contactPerson: values.contactPerson,
    memberCount: values.memberCount === null ? '' : String(values.memberCount),
    notes: values.notes,
  });
  if (!result.ok) {
    const fields = Object.fromEntries(
      Object.entries(result.errors).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    stop('invalid', Object.values(fields).join(' '), fields);
  }
  const v = result.value;
  return {
    type: v.type,
    name: v.name,
    phone_e164: phoneToDb(v.phone),
    address_text: v.address,
    org_name: v.orgName,
    contact_person: v.contactPerson,
    member_count: v.memberCount,
    notes: v.notes,
  };
}

export async function listCustomersAction(
  filter: CustomerFilter,
): Promise<ActionResult<CustomerRow[]>> {
  return runAction('listCustomers', 'load_failed', async () => {
    const db = await createSessionClient();
    const includeArchived = filter.includeArchived === true;
    const [customers, summaries, subscriptions] = await Promise.all([
      fetchAll<CustomerDb>((from, to) => {
        const query = db.from('customers').select('*').order('name').order('id').range(from, to);
        return includeArchived ? query : query.is('archived_at', null);
      }),
      fetchAll<CustomerSummaryDb>((from, to) =>
        db.from('customer_summary').select('*').order('customer_id').range(from, to),
      ),
      fetchAll<SubscriptionStatusDb>((from, to) =>
        db.from('subscription_status').select('*').order('id').range(from, to),
      ),
    ]);
    const summaryBy = new Map(summaries.map((s) => [s.customer_id, s]));
    const subsBy = new Map<string, ReturnType<typeof mapSubscriptionRow>[]>();
    for (const row of subscriptions) {
      const list = subsBy.get(row.customer_id) ?? [];
      list.push(mapSubscriptionRow(row));
      subsBy.set(row.customer_id, list);
    }
    const search = String(filter.search ?? '');
    return customers
      .map((c) => mapCustomer(c))
      .filter(
        (c) => (filter.type ? c.type === filter.type : true) && matchesCustomerSearch(c, search),
      )
      .map((c) => mapCustomerRow(c, summaryBy.get(c.id), subsBy.get(c.id) ?? []))
      .filter((row) => {
        if (filter.subscription === 'renewal_due' && !row.renewalDue) return false;
        if (
          filter.subscription &&
          filter.subscription !== 'renewal_due' &&
          !row.subscriptionStatuses.includes(filter.subscription)
        ) {
          return false;
        }
        return !filter.payment || row.paymentStatus === filter.payment;
      })
      .sort(
        (a, b) => Number(a.customer.archivedAt !== null) - Number(b.customer.archivedAt !== null),
      );
  });
}

export async function getCustomerDetailAction(id: string): Promise<ActionResult<CustomerDetail>> {
  return runAction('getCustomerDetail', 'load_failed', async () => {
    assertUuid(id, 'customer');
    const db = await createSessionClient();
    const [customer, subs, periods, payments, summary] = await Promise.all([
      db.from('customers').select('*').eq('id', id),
      db.from('subscription_status').select('*').eq('customer_id', id),
      db.from('period_payment_status').select('*').eq('customer_id', id),
      db
        .from('payments')
        .select(PAYMENT_SELECT)
        .eq('customer_id', id)
        .order('paid_on', { ascending: false }),
      db.from('customer_summary').select('*').eq('customer_id', id),
    ]);
    const row = unwrap<CustomerDb[] | null>(customer, READ)?.[0];
    if (!row) stop('not_found', 'This customer was not found.');
    const sum = unwrap<CustomerSummaryDb[] | null>(summary, READ)?.[0];
    return {
      customer: mapCustomer(row),
      subscriptions: (unwrap<SubscriptionStatusDb[] | null>(subs, READ) ?? [])
        .map(mapSubscriptionRow)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
      periods: (unwrap<PeriodStatusDb[] | null>(periods, READ) ?? [])
        .map(mapPeriodRow)
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
      payments: (unwrap<PaymentDb[] | null>(payments, READ) ?? []).map(mapPaymentRow),
      paymentStatus: sum?.payment_status ?? null,
      balance: Number(sum?.balance ?? 0),
    };
  });
}

export async function createCustomerAction(
  values: CustomerValues,
): Promise<ActionResult<Customer>> {
  return runAction('createCustomer', 'save_failed', async () => {
    const columns = toColumns(values);
    const db = await createSessionClient();
    return mapCustomer(
      unwrap<CustomerDb>(await db.from('customers').insert(columns).select('*').single(), WRITE),
    );
  });
}

export async function updateCustomerAction(
  id: string,
  values: CustomerValues,
): Promise<ActionResult<Customer>> {
  return runAction('updateCustomer', 'save_failed', async () => {
    assertUuid(id, 'customer');
    const columns = toColumns(values);
    const db = await createSessionClient();
    const rows = unwrap<CustomerDb[] | null>(
      await db.from('customers').update(columns).eq('id', id).select('*'),
      WRITE,
    );
    const row = rows?.[0];
    if (!row) stop('not_found', 'This customer was not found.');
    return mapCustomer(row);
  });
}

async function setArchived(id: string, archived: boolean): Promise<null> {
  assertUuid(id, 'customer');
  const db = await createSessionClient();
  const rows = unwrap<{ id: string }[] | null>(
    await db
      .from('customers')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
      .select('id'),
    WRITE,
  );
  if (!rows || rows.length === 0) stop('not_found', 'This customer was not found.');
  return null;
}

export async function archiveCustomerAction(id: string): Promise<ActionResult<null>> {
  return runAction('archiveCustomer', 'save_failed', () => setArchived(id, true));
}
export async function restoreCustomerAction(id: string): Promise<ActionResult<null>> {
  return runAction('restoreCustomer', 'save_failed', () => setArchived(id, false));
}

/** Another customer with the same phone (a warning, not an error: FR-24). Compared here, not in a URL. */
export async function findDuplicatePhoneAction(
  phone: string,
  excludeCustomerId?: string,
): Promise<ActionResult<Customer | null>> {
  return runAction('findDuplicatePhone', 'load_failed', async () => {
    const normalised = normalisePhone(String(phone ?? ''));
    if (normalised === null) return null;
    const wanted = phoneToDb(normalised);
    const db = await createSessionClient();
    const customers = await fetchAll<CustomerDb>((from, to) =>
      db.from('customers').select('*').order('id').range(from, to),
    );
    const hit = customers.find((c) => c.phone_e164 === wanted && c.id !== excludeCustomerId);
    return hit ? mapCustomer(hit) : null;
  });
}
