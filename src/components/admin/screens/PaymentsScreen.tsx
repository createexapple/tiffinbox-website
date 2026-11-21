'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PAYMENT_METHOD_LABEL, rangeLabel } from '@/admin/format';
import { activePayments, sumAmounts } from '@/admin/ledger';
import type { PaymentFilter, PaymentMethod } from '@/admin/types';
import { formatRs, formatShortDate } from '@/lib/format';
import { useQuery } from '../AdminProvider';
import { SelectField, TextField } from '../fields';
import { EmptyState, PageHead, QueryBoundary, StatusBadge } from '../ui';

export type PaymentsPreset = 'unpaid' | 'overdue' | undefined;

/**
 * A-16 (FR-28, FR-29): dues (unpaid and overdue periods, with balances) and the ledger of payments recorded.
 * `preset` comes from dashboard cards (`?show=unpaid|overdue`).
 */
export function PaymentsScreen({ preset }: { preset?: PaymentsPreset }) {
  const [tab, setTab] = useState<'dues' | 'ledger'>('dues');
  return (
    <>
      <PageHead
        title="Payments & dues"
        sub="Recorded by staff. Nothing is collected online."
        actions={
          <Link className="btn btn-primary" href="/admin/payments/new">
            Record payment
          </Link>
        }
      />
      <div role="tablist" className="tabs" aria-label="Payments">
        <button
          role="tab"
          type="button"
          id="tab-dues"
          aria-selected={tab === 'dues'}
          aria-controls="panel-dues"
          tabIndex={tab === 'dues' ? 0 : -1}
          onClick={() => setTab('dues')}
        >
          Dues
        </button>
        <button
          role="tab"
          type="button"
          id="tab-ledger"
          aria-selected={tab === 'ledger'}
          aria-controls="panel-ledger"
          tabIndex={tab === 'ledger' ? 0 : -1}
          onClick={() => setTab('ledger')}
        >
          Payments recorded
        </button>
      </div>
      {tab === 'dues' ? (
        <div role="tabpanel" id="panel-dues" aria-labelledby="tab-dues">
          <Dues preset={preset} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-ledger" aria-labelledby="tab-ledger">
          <Ledger />
        </div>
      )}
    </>
  );
}

function Dues({ preset }: { preset?: PaymentsPreset }) {
  const [status, setStatus] = useState<string>(preset ?? 'open');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filter: Pick<PaymentFilter, 'status' | 'from' | 'to'> = {
    ...(status === 'open' ? {} : { status: status as PaymentFilter['status'] }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const { state, reload } = useQuery((repo) => repo.listDues(filter), [status, from, to]);

  return (
    <>
      <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
        <SelectField
          id="due-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: 'Unpaid or overdue' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'paid', label: 'Paid' },
            { value: 'all', label: 'All periods' },
          ]}
        />
        <TextField id="due-from" label="Due from" type="date" value={from} onChange={setFrom} />
        <TextField id="due-to" label="Due to" type="date" value={to} onChange={setTo} />
      </form>
      <QueryBoundary query={state} reload={reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title="No payments due">
              {status === 'open' && !from && !to
                ? 'Nothing is unpaid or overdue. Dues appear when a subscription is added.'
                : 'Nothing matches these filters.'}
            </EmptyState>
          ) : (
            <>
              <p role="status" className="small">
                <b>
                  {rows.length} {rows.length === 1 ? 'period' : 'periods'}
                </b>
              </p>
              <div className="tbl-wrap">
                <table className="rt admin-table">
                  <caption className="sr-only">Payments due</caption>
                  <thead>
                    <tr>
                      <th scope="col">Customer</th>
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
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id} className={p.status === 'overdue' ? 'hl-overdue' : undefined}>
                        <th scope="row">
                          <Link className="rowlink" href={`/admin/customers/${p.customerId}`}>
                            {p.customerName}
                          </Link>
                        </th>
                        <td data-label="Period">{rangeLabel(p.periodStart, p.periodEnd)}</td>
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
                        <td data-label="Action" className="actions">
                          {p.balance > 0 ? (
                            <Link
                              className="btn btn-secondary btn-sm"
                              href={`/admin/payments/new?customer=${p.customerId}&subscription=${p.subscriptionId}`}
                            >
                              Record payment<span className="sr-only"> for {p.customerName}</span>
                            </Link>
                          ) : (
                            '–'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Total balance ({rows.length})</td>
                      <td className="num" data-label="Total balance">
                        {formatRs(rows.reduce((sum, p) => sum + p.balance, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )
        }
      </QueryBoundary>
    </>
  );
}

function Ledger() {
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filter: Pick<PaymentFilter, 'method' | 'from' | 'to'> = {
    ...(method ? { method: method as PaymentMethod } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const { state, reload } = useQuery((repo) => repo.listPayments(filter), [method, from, to]);
  const filtered = method !== '' || from !== '' || to !== '';

  return (
    <>
      <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
        <SelectField
          id="pay-method"
          label="Method"
          value={method}
          onChange={setMethod}
          options={[
            { value: '', label: 'Any method' },
            ...(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({
              value: m,
              label: PAYMENT_METHOD_LABEL[m],
            })),
          ]}
        />
        <TextField id="pay-from" label="Paid from" type="date" value={from} onChange={setFrom} />
        <TextField id="pay-to" label="Paid to" type="date" value={to} onChange={setTo} />
      </form>
      <QueryBoundary query={state} reload={reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              title={filtered ? 'No payments match these filters' : 'No payments recorded yet'}
              actions={
                <Link className="btn btn-primary" href="/admin/payments/new">
                  Record payment
                </Link>
              }
            >
              {filtered
                ? 'Clear the filters to see everything.'
                : 'Payments you record appear here.'}
            </EmptyState>
          ) : (
            <div className="tbl-wrap">
              <table className="rt admin-table">
                <caption className="sr-only">Payments recorded</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Method</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Covers</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <th scope="row">
                        {formatShortDate(p.paidOn)}{' '}
                        {p.voidedAt ? <StatusBadge kind="void" /> : null}
                      </th>
                      <td data-label="Customer">
                        <Link className="rowlink" href={`/admin/customers/${p.customerId}`}>
                          {p.customerName}
                        </Link>
                      </td>
                      <td data-label="Method">{PAYMENT_METHOD_LABEL[p.method]}</td>
                      <td data-label="Amount" className="num">
                        {p.voidedAt ? <del>{formatRs(p.amount)}</del> : formatRs(p.amount)}
                      </td>
                      <td data-label="Covers">{rangeLabel(p.coversFrom, p.coversTo)}</td>
                      <td data-label="Reference">{p.reference || '–'}</td>
                      <td data-label="Action" className="actions">
                        <Link className="btn btn-secondary btn-sm" href={`/admin/payments/${p.id}`}>
                          {p.voidedAt ? 'View' : 'Edit / void'}
                          <span className="sr-only">
                            {' '}
                            {p.reference || formatShortDate(p.paidOn)}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      Total ({activePayments(rows).length} payments, voided not counted)
                    </td>
                    <td className="num" data-label="Total">
                      {formatRs(sumAmounts(activePayments(rows)))}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        }
      </QueryBoundary>
    </>
  );
}
