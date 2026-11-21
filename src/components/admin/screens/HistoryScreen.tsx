'use client';

import { useState } from 'react';
import { formatDateTime } from '@/admin/format';
import type { RecordType } from '@/admin/types';
import { useQuery } from '../AdminProvider';
import { SelectField, TextField } from '../fields';
import { EmptyState, PageHead, QueryBoundary } from '../ui';

const TYPES: RecordType[] = [
  'Content publish',
  'Menu',
  'Plans',
  'Pricing rules',
  'Dishes',
  'Add-ons',
  'FAQ',
  'Settings',
  'Images',
  'Customer',
  'Subscription',
  'Payment',
];

/** A-11 (FR-23): who changed what and when, newest first. */
export function HistoryScreen() {
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { state, reload } = useQuery(
    (repo) =>
      repo.listAudit({
        ...(type ? { recordType: type as RecordType } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    [type, from, to],
  );
  const filtered = type !== '' || from !== '' || to !== '';

  return (
    <>
      <PageHead
        title="Change history"
        sub="Who changed what and when, newest first. Customer and payment changes are included."
      />
      <form className="toolbar" onSubmit={(e) => e.preventDefault()}>
        <SelectField
          id="h-type"
          label="Record type"
          value={type}
          onChange={setType}
          options={[
            { value: '', label: 'All records' },
            ...TYPES.map((t) => ({ value: t, label: t })),
          ]}
        />
        <TextField id="h-from" label="From" type="date" value={from} onChange={setFrom} />
        <TextField id="h-to" label="To" type="date" value={to} onChange={setTo} />
      </form>
      <QueryBoundary query={state} reload={reload}>
        {(entries) =>
          entries.length === 0 ? (
            <EmptyState
              title={filtered ? 'No entries match these filters' : 'No changes recorded yet'}
            >
              {filtered
                ? 'Clear the filters to see everything.'
                : 'Every publish and every customer, subscription and payment change will appear here.'}
            </EmptyState>
          ) : (
            <>
              <p role="status" className="small">
                <b>
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                </b>
                {filtered ? ' matching the filters' : ''}
              </p>
              <table className="rt admin-table">
                <caption className="sr-only">Change history</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Who</th>
                    <th scope="col">Record</th>
                    <th scope="col">What changed</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <th scope="row">{formatDateTime(e.at)}</th>
                      <td data-label="Who">{e.actor}</td>
                      <td data-label="Record">{e.recordType}</td>
                      <td data-label="What changed">
                        {e.summary}
                        {e.diff ? (
                          <>
                            {' '}
                            <span className="diff">
                              <del>{e.diff.from}</del> <ins>{e.diff.to}</ins>
                            </span>
                          </>
                        ) : null}
                        {e.earlierValues ? (
                          <details>
                            <summary className="small">Earlier values</summary>
                            <p className="small muted" style={{ margin: 'var(--sp-1) 0 0' }}>
                              {e.earlierValues}
                            </p>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        }
      </QueryBoundary>
      <p className="dnote">
        <b>Privacy (NFR-12):</b> record links use random IDs, never names or phone numbers; this log
        is visible to signed-in admins only.
      </p>
    </>
  );
}
