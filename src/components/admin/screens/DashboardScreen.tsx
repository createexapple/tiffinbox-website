'use client';

import Link from 'next/link';
import { formatRs, formatWeekdayDate } from '@/lib/format';
import { formatDateTimeWithWeekday, weekLabel } from '@/admin/format';
import { useQuery } from '../AdminProvider';
import { Alert, EmptyState, PageHead, QueryBoundary, StatusBadge } from '../ui';

/** A-02 (FR-13, FR-22, FR-30). Counts come from the repository, which uses the same definitions as the lists. */
export function DashboardScreen() {
  const { state, reload } = useQuery((repo) => repo.getOverview());

  return (
    <>
      <PageHead
        title="Dashboard"
        sub={
          state.status === 'ready'
            ? `${formatWeekdayDate(state.data.today)} (sample date)`
            : undefined
        }
        actions={
          <>
            <Link className="btn btn-primary" href="/admin/customers/new">
              Add customer
            </Link>
            <Link className="btn btn-secondary" href="/admin/payments/new">
              Record payment
            </Link>
          </>
        }
      />
      <QueryBoundary query={state} reload={reload}>
        {(o) => (
          <>
            {o.pendingChanges > 0 ? (
              <Alert
                tone="warn"
                title={`${o.pendingChanges} unpublished ${o.pendingChanges === 1 ? 'change' : 'changes'}`}
                actions={<Link href="/admin/publish">Preview &amp; publish</Link>}
              >
                {o.pendingAreas.join(', ')}. Your edits are saved as drafts. Visitors still see the
                live site.
              </Alert>
            ) : null}

            <h2 style={{ fontSize: 'var(--fs-lg)', margin: 'var(--sp-6) 0 var(--sp-3)' }}>
              Customers and money
            </h2>
            <div className="grid c4">
              <Link className="stat" href="/admin/customers?show=active">
                <span className="n">{o.activeSubscribers}</span>
                <span className="l">Active subscribers</span>
                <span className="s">
                  {o.activeSubscribers === 0
                    ? 'none yet'
                    : o.officeMembers > 0
                      ? `+ ${o.officeMembers} office members`
                      : 'customers with an active plan'}
                </span>
              </Link>
              <Link className="stat" href="/admin/payments?show=unpaid">
                <span className="n">{o.unpaid.count}</span>
                <span className="l">Unpaid</span>
                <span className="s">{formatRs(o.unpaid.total)} due</span>
              </Link>
              <Link
                className={`stat${o.overdue.count > 0 ? ' danger' : ''}`}
                href="/admin/payments?show=overdue"
              >
                <span className="n">{o.overdue.count}</span>
                <span className="l">Overdue</span>
                <span className="s">{formatRs(o.overdue.total)} balance</span>
              </Link>
              <Link className="stat" href="/admin/customers?show=renewal">
                <span className="n">{o.renewalDue}</span>
                <span className="l">Plans ending within {o.renewalWindowDays} days</span>
                <span className="s">{o.renewalDue === 0 ? 'none yet' : 'renewal due'}</span>
              </Link>
            </div>

            {o.totalCustomers === 0 ? (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <EmptyState
                  title="Add your first customer"
                  actions={
                    <Link className="btn btn-primary" href="/admin/customers/new">
                      Add customer
                    </Link>
                  }
                >
                  Counts will appear here once you add customers, subscriptions and payments.
                </EmptyState>
              </div>
            ) : null}

            <div className="grid c2" style={{ marginTop: 'var(--sp-6)' }}>
              <section className="panel" aria-labelledby="dash-menu">
                <h2 id="dash-menu">Menu</h2>
                <dl className="kv">
                  <dt>Live now</dt>
                  <dd>
                    {o.liveMenuWeekStart ? (
                      <>
                        {weekLabel(o.liveMenuWeekStart)} <StatusBadge kind="live" />
                      </>
                    ) : (
                      'No menu is live yet'
                    )}
                  </dd>
                  <dt>Next</dt>
                  <dd>
                    {o.scheduledMenu ? (
                      <>
                        {weekLabel(o.scheduledMenu.weekStart)} <StatusBadge kind="scheduled" />
                        <br />
                        <span className="small muted">
                          Goes live {formatDateTimeWithWeekday(o.scheduledMenu.goLiveAt)}
                        </span>
                      </>
                    ) : (
                      <span className="muted">No menu scheduled yet</span>
                    )}
                  </dd>
                </dl>
                <p>
                  <Link className="btn btn-secondary btn-sm" href="/admin/menu">
                    Edit menu
                  </Link>
                </p>
              </section>
              <section className="panel" aria-labelledby="dash-site">
                <h2 id="dash-site">Website</h2>
                <dl className="kv">
                  <dt>Live version</dt>
                  <dd>
                    v{o.liveVersion}, published{' '}
                    {formatDateTimeWithWeekday(o.liveVersionPublishedAt)}
                  </dd>
                  <dt>Drafts</dt>
                  <dd>
                    {o.pendingChanges === 0
                      ? 'Nothing waiting. The live site is up to date.'
                      : `${o.pendingChanges} unpublished (${o.pendingAreas.join(', ')})`}
                  </dd>
                </dl>
                <p>
                  <Link className="btn btn-secondary btn-sm" href="/admin/publish">
                    Preview &amp; publish
                  </Link>
                </p>
              </section>
            </div>
          </>
        )}
      </QueryBoundary>
    </>
  );
}
