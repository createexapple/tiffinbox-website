'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CUSTOMER_TYPE_LABEL, PAYMENT_METHOD_LABEL, rangeLabel } from '@/admin/format';
import type { CustomerDetail } from '@/admin/types';
import { formatPhone } from '@/admin/validation/operations';
import { formatRs, formatShortDate } from '@/lib/format';
import { useAdmin, useQuery } from '../AdminProvider';
import { useToast } from '../Toast';
import { Alert, Dialog, PageHead, QueryBoundary, StatusBadge } from '../ui';

/** A-13 (FR-25..29): profile, subscriptions with status, dues by period, payments recorded. */
export function CustomerDetailScreen({ id }: { id: string }) {
  const { state, reload } = useQuery((repo) => repo.getCustomerDetail(id), [id]);
  return (
    <>
      <p className="crumbs">
        <Link href="/admin/customers">← Customers</Link>
      </p>
      <QueryBoundary query={state} reload={reload}>
        {(detail) => <Detail detail={detail} />}
      </QueryBoundary>
    </>
  );
}

function Detail({ detail }: { detail: CustomerDetail }) {
  const { repo } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState<'subs' | 'pays'>('subs');
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = detail.customer;
  const archived = c.archivedAt !== null;
  const activeSub = detail.subscriptions.find((s) => s.status === 'active');
  const renewal = detail.subscriptions.find((s) => s.renewalDue);
  const overdue = detail.periods.filter((p) => p.status === 'overdue');
  const overdueTotal = overdue.reduce((sum, p) => sum + p.balance, 0);

  async function archive() {
    setArchiving(false);
    try {
      await repo.archiveCustomer(c.id);
      toast({ text: 'Customer archived. Their records are kept.' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <>
      <PageHead
        title={c.name}
        sub={
          <>
            {CUSTOMER_TYPE_LABEL[c.type]} · {formatPhone(c.phone)}{' '}
            {archived ? <StatusBadge kind="archived" /> : null}
          </>
        }
        actions={
          archived ? undefined : (
            <>
              <Link className="btn btn-secondary" href={`/admin/customers/${c.id}/edit`}>
                Edit
              </Link>
              <Link
                className="btn btn-secondary"
                href={`/admin/customers/${c.id}/subscriptions/new`}
              >
                Add subscription
              </Link>
              <Link className="btn btn-primary" href={`/admin/payments/new?customer=${c.id}`}>
                Record payment
              </Link>
            </>
          )
        }
      />

      {error ? (
        <Alert tone="err" title="That did not work.">
          {error}
        </Alert>
      ) : null}
      {archived ? (
        <Alert
          tone="info"
          title="This customer is archived."
          actions={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                repo.restoreCustomer(c.id).then(
                  () => toast({ text: 'Customer restored.' }),
                  (e: unknown) => setError(e instanceof Error ? e.message : 'Please try again.'),
                )
              }
            >
              Restore customer
            </button>
          }
        >
          Hidden from the customer list. Their subscriptions and payments are kept. Editing and new
          payments are disabled until restored.
        </Alert>
      ) : null}
      {!archived && overdue.length > 0 ? (
        <Alert
          tone="err"
          title={`Payment overdue: ${formatRs(overdueTotal)}.`}
          actions={<Link href={`/admin/payments/new?customer=${c.id}`}>Record payment</Link>}
        >
          {overdue
            .map(
              (p) =>
                `${rangeLabel(p.periodStart, p.periodEnd)} was due ${formatShortDate(p.dueDate)}`,
            )
            .join('; ')}{' '}
          and is not fully paid. Remind the customer on WhatsApp, then record the payment when it
          arrives.
        </Alert>
      ) : null}
      {!archived && renewal ? (
        <Alert
          tone="warn"
          title={`Plan ends ${renewal.daysToEnd === 0 ? 'today' : `in ${renewal.daysToEnd} ${renewal.daysToEnd === 1 ? 'day' : 'days'}`} (${formatShortDate(renewal.endDate)}).`}
          actions={
            <Link href={`/admin/subscriptions/${renewal.id}/renew`}>Renew subscription</Link>
          }
        >
          Renew now so there is no gap.
        </Alert>
      ) : null}

      <section className="panel" aria-labelledby="profile-h" style={{ marginTop: 'var(--sp-4)' }}>
        <h2 id="profile-h">{c.type === 'office' ? 'Office' : 'Profile'}</h2>
        <dl className="kv">
          <dt>Type</dt>
          <dd>{CUSTOMER_TYPE_LABEL[c.type]}</dd>
          {c.type === 'office' ? (
            <>
              <dt>Organisation</dt>
              <dd>{c.orgName}</dd>
              <dt>Contact person</dt>
              <dd>{c.contactPerson}</dd>
              <dt>Team members</dt>
              <dd>
                <b>{c.memberCount}</b> people
              </dd>
            </>
          ) : null}
          <dt>Phone / WhatsApp</dt>
          <dd>{formatPhone(c.phone)}</dd>
          <dt>Address</dt>
          <dd>{c.address || '–'}</dd>
          {activeSub ? (
            <>
              <dt>Balance</dt>
              <dd>{formatRs(detail.balance)} unpaid</dd>
            </>
          ) : null}
        </dl>
        {c.type === 'office' ? (
          <p className="small muted" style={{ marginTop: 'var(--sp-3)', marginBottom: 0 }}>
            One record for the whole office: payments and dues are tracked here, not per team member
            (A-19). Members are not listed.
          </p>
        ) : null}
      </section>

      <div role="tablist" className="tabs" aria-label="Customer records">
        <button
          role="tab"
          type="button"
          id="tab-subs"
          aria-selected={tab === 'subs'}
          aria-controls="panel-subs"
          tabIndex={tab === 'subs' ? 0 : -1}
          onClick={() => setTab('subs')}
        >
          Subscriptions
        </button>
        <button
          role="tab"
          type="button"
          id="tab-pays"
          aria-selected={tab === 'pays'}
          aria-controls="panel-pays"
          tabIndex={tab === 'pays' ? 0 : -1}
          onClick={() => setTab('pays')}
        >
          Payments
        </button>
      </div>

      {tab === 'subs' ? (
        <div role="tabpanel" id="panel-subs" aria-labelledby="tab-subs">
          {detail.subscriptions.length === 0 ? (
            <p className="muted">
              No subscriptions yet.{' '}
              {archived ? null : (
                <Link href={`/admin/customers/${c.id}/subscriptions/new`}>Add a subscription</Link>
              )}
            </p>
          ) : (
            <div className="tbl-wrap">
              <table className="rt admin-table">
                <caption className="sr-only">Subscriptions</caption>
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">Term</th>
                    <th scope="col">Dates</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{s.planName}</th>
                      <td data-label="Term">{s.term === 'weekly' ? 'Weekly' : 'Monthly'}</td>
                      <td data-label="Dates">{rangeLabel(s.startDate, s.endDate)}</td>
                      <td data-label="Amount" className="num">
                        {formatRs(s.amountPerPeriod)}
                      </td>
                      <td data-label="Status">
                        <span className="badges">
                          <StatusBadge kind={s.status} />
                          {s.renewalDue ? (
                            <>
                              {' '}
                              <StatusBadge kind="renewal_due" />
                            </>
                          ) : null}
                        </span>
                      </td>
                      <td data-label="Actions" className="actions">
                        {archived ? (
                          '–'
                        ) : (
                          <>
                            <Link
                              className="btn btn-secondary btn-sm"
                              href={`/admin/subscriptions/${s.id}/edit`}
                            >
                              Edit<span className="sr-only"> {s.planName} subscription</span>
                            </Link>{' '}
                            <Link
                              className="btn btn-secondary btn-sm"
                              href={`/admin/subscriptions/${s.id}/renew`}
                            >
                              Renew<span className="sr-only"> {s.planName} subscription</span>
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" id="panel-pays" aria-labelledby="tab-pays">
          <h2 style={{ fontSize: 'var(--fs-lg)' }}>Dues by period</h2>
          {detail.periods.length === 0 ? (
            <p className="muted">No dues yet. Dues appear when a subscription is added.</p>
          ) : (
            <table className="rt admin-table">
              <caption className="sr-only">Dues by period</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Due date</th>
                  <th scope="col" className="num">
                    Amount due
                  </th>
                  <th scope="col" className="num">
                    Paid
                  </th>
                  <th scope="col" className="num">
                    Balance
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.periods.map((p) => (
                  <tr key={p.id} className={p.status === 'overdue' ? 'hl-overdue' : undefined}>
                    <th scope="row">{rangeLabel(p.periodStart, p.periodEnd)}</th>
                    <td data-label="Due date">{formatShortDate(p.dueDate)}</td>
                    <td data-label="Amount due" className="num">
                      {formatRs(p.amountDue)}
                    </td>
                    <td data-label="Paid" className="num">
                      {formatRs(p.paid)}
                    </td>
                    <td data-label="Balance" className="num">
                      {formatRs(p.balance)}
                    </td>
                    <td data-label="Status">
                      <StatusBadge kind={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h2 style={{ fontSize: 'var(--fs-lg)', marginTop: 'var(--sp-5)' }}>Payments recorded</h2>
          {detail.payments.length === 0 ? (
            <p className="muted">No payments recorded yet.</p>
          ) : (
            <table className="rt admin-table">
              <caption className="sr-only">Payments recorded</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Method</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col">Covers</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      {formatShortDate(p.paidOn)} {p.voidedAt ? <StatusBadge kind="void" /> : null}
                    </th>
                    <td data-label="Method">{PAYMENT_METHOD_LABEL[p.method]}</td>
                    <td data-label="Amount" className="num">
                      {p.voidedAt ? <del>{formatRs(p.amount)}</del> : formatRs(p.amount)}
                    </td>
                    <td data-label="Covers">{rangeLabel(p.coversFrom, p.coversTo)}</td>
                    <td data-label="Reference">{p.reference || '–'}</td>
                    <td data-label="Actions" className="actions">
                      <Link className="btn btn-secondary btn-sm" href={`/admin/payments/${p.id}`}>
                        {p.voidedAt ? 'View' : 'Edit / void'}
                        <span className="sr-only">
                          {' '}
                          payment {p.reference || formatShortDate(p.paidOn)}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small muted">Receipts are sent manually on WhatsApp.</p>
        </div>
      )}

      {archived ? null : (
        <p style={{ marginTop: 'var(--sp-6)' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setArchiving(true)}>
            Archive this customer
          </button>
        </p>
      )}

      <Dialog
        open={archiving}
        destructive
        onClose={() => setArchiving(false)}
        title={`Archive ${c.name}?`}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setArchiving(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={archive}>
              {activeSub ? 'Archive anyway' : 'Archive'}
            </button>
          </>
        }
      >
        <p>
          {activeSub ? (
            <>
              This customer has an <b>active subscription</b> (ends{' '}
              {formatShortDate(activeSub.endDate)}). End or pause it first, or archive anyway.{' '}
            </>
          ) : null}
          Archived customers are hidden from lists; their records are kept.
        </p>
      </Dialog>
    </>
  );
}
