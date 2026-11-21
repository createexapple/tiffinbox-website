'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CUSTOMER_TYPE_LABEL } from '@/admin/format';
import type {
  CustomerFilter,
  CustomerType,
  PaymentStatus,
  SubscriptionStatus,
} from '@/admin/types';
import { formatShortDate } from '@/lib/format';
import { formatPhone } from '@/admin/validation/operations';
import { useQuery } from '../AdminProvider';
import { CheckField, SelectField } from '../fields';
import { EmptyState, PageHead, QueryBoundary, StatusBadge } from '../ui';

export type CustomersPreset = 'active' | 'renewal' | undefined;

const SUBSCRIPTION_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'expired', label: 'Expired' },
  { value: 'renewal_due', label: 'Renewal due' },
];

/**
 * A-12 (FR-24, FR-25, FR-27, FR-29). The search text lives only in component state and is never put in the
 * URL, page title, storage or console (NFR-12). `preset` comes from dashboard cards (`?show=active|renewal`):
 * a status filter, not customer data.
 */
export function CustomersScreen({ preset }: { preset?: CustomersPreset }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [sub, setSub] = useState(
    preset === 'active' ? 'active' : preset === 'renewal' ? 'renewal_due' : '',
  );
  const [pay, setPay] = useState('');
  const [archived, setArchived] = useState(false);

  const filter: CustomerFilter = {
    ...(search.trim() ? { search } : {}),
    ...(type ? { type: type as CustomerType } : {}),
    ...(sub ? { subscription: sub as SubscriptionStatus | 'renewal_due' } : {}),
    ...(pay ? { payment: pay as PaymentStatus } : {}),
    includeArchived: archived,
  };
  const filtered = search.trim() !== '' || type !== '' || sub !== '' || pay !== '';
  const { state, reload } = useQuery(
    (repo) => repo.listCustomers(filter),
    [search, type, sub, pay, archived],
  );

  function clear() {
    setSearch('');
    setType('');
    setSub('');
    setPay('');
  }

  return (
    <>
      <PageHead
        title="Customers"
        sub="Staff-entered records. Customers never log in."
        actions={
          <Link className="btn btn-primary" href="/admin/customers/new">
            Add customer
          </Link>
        }
      />
      {/* method="post" and preventDefault: Enter never puts the search text in the address bar. */}
      <form className="toolbar" method="post" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field grow">
          <label htmlFor="q">Search name, phone or organisation</label>
          <input
            id="q"
            name="q"
            type="search"
            value={search}
            autoComplete="off"
            aria-describedby="q-h"
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="hint" id="q-h">
            Sent privately, never put in the page address.
          </span>
        </div>
        <SelectField
          id="ft"
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: '', label: 'All types' },
            ...(['student', 'office', 'home'] as const).map((t) => ({
              value: t,
              label: CUSTOMER_TYPE_LABEL[t],
            })),
          ]}
        />
        <SelectField
          id="fs"
          label="Subscription"
          value={sub}
          onChange={setSub}
          options={SUBSCRIPTION_OPTIONS}
        />
        <SelectField
          id="fp"
          label="Payment"
          value={pay}
          onChange={setPay}
          options={[
            { value: '', label: 'Any status' },
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'overdue', label: 'Overdue' },
          ]}
        />
        <div style={{ flex: '0 0 auto' }}>
          <CheckField id="arch" label="Show archived" checked={archived} onChange={setArchived} />
        </div>
      </form>

      <QueryBoundary query={state} reload={reload}>
        {(rows) => (
          <>
            <p role="status" className="small" style={{ margin: '0 0 var(--sp-3)' }}>
              <b>
                {rows.length} {rows.length === 1 ? 'customer' : 'customers'}
              </b>
              {filtered ? (
                <>
                  {' '}
                  matching your filters ·{' '}
                  <button
                    type="button"
                    className="btn-link-reset"
                    style={{ textDecoration: 'underline' }}
                    onClick={clear}
                  >
                    Clear filters
                  </button>
                </>
              ) : null}
            </p>
            {rows.length === 0 ? (
              <EmptyState
                title={filtered ? 'No customers match these filters' : 'No customers yet'}
                actions={
                  <>
                    {filtered ? (
                      <button type="button" className="btn btn-secondary" onClick={clear}>
                        Clear filters
                      </button>
                    ) : null}
                    <Link className="btn btn-primary" href="/admin/customers/new">
                      Add customer
                    </Link>
                  </>
                }
              >
                {filtered
                  ? 'Check the spelling or number, or clear the filters.'
                  : 'Add your first customer to start tracking subscriptions and payments.'}
              </EmptyState>
            ) : (
              <table className="rt admin-table">
                <caption className="sr-only">Customers</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Subscription</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Plan ends</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const c = row.customer;
                    return (
                      <tr
                        key={c.id}
                        className={row.paymentStatus === 'overdue' ? 'hl-overdue' : undefined}
                      >
                        <th scope="row">
                          <Link className="rowlink" href={`/admin/customers/${c.id}`}>
                            {c.name}
                          </Link>
                          {c.type === 'office' && c.memberCount ? (
                            <>
                              <br />
                              <span className="small muted">{c.memberCount} members</span>
                            </>
                          ) : null}
                          {c.archivedAt ? (
                            <>
                              {' '}
                              <StatusBadge kind="archived" />
                            </>
                          ) : null}
                        </th>
                        <td data-label="Type">{CUSTOMER_TYPE_LABEL[c.type]}</td>
                        <td data-label="Phone">{formatPhone(c.phone)}</td>
                        <td data-label="Plan">
                          {row.current ? `${row.current.planName} (${row.current.term})` : '–'}
                        </td>
                        <td data-label="Subscription">
                          {row.current ? (
                            <span className="badges">
                              <StatusBadge kind={row.current.status} />
                              {row.renewalDue ? <StatusBadge kind="renewal_due" /> : null}
                            </span>
                          ) : (
                            <span className="muted">No subscription</span>
                          )}
                        </td>
                        <td data-label="Payment">
                          {row.paymentStatus ? <StatusBadge kind={row.paymentStatus} /> : '–'}
                        </td>
                        <td data-label="Plan ends">
                          {row.current ? formatShortDate(row.current.endDate) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </QueryBoundary>
    </>
  );
}
