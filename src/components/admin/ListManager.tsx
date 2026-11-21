'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AdminRepository, OrderedCollection } from '@/admin/repository';
import { useAdmin, useQuery } from './AdminProvider';
import { useToast } from './Toast';
import { Alert, Dialog, EmptyState, PageHead, QueryBoundary, StatusBadge } from './ui';

export interface Column<Row> {
  header: string;
  /** First column is the row header cell. */
  cell: (row: Row) => ReactNode;
  className?: string;
}

export interface RowFormProps<Row, Values> {
  row: Row | null;
  /** Throws a server error message (shown by the form) or resolves when saved. */
  onSave: (values: Values) => Promise<void>;
  onCancel: () => void;
}

/**
 * Shared list manager for custom dishes, add-ons and FAQ (A-05, A-06, A-07; FR-17, FR-18, FR-19):
 * list, add/edit form, delete confirm, keyboard- and phone-friendly reorder with a polite announcement.
 * All changes are drafts; the toast links to Preview & publish.
 */
export function ListManager<Row extends { id: string; isHidden: boolean }, Values>({
  title,
  sub,
  noun,
  addLabel,
  emptyTitle,
  emptyText,
  collection,
  columns,
  rowName,
  Form,
  deleteTitle,
  deleteBody,
}: {
  title: string;
  sub: string;
  noun: string;
  addLabel: string;
  emptyTitle: string;
  emptyText: string;
  collection: (repo: AdminRepository) => OrderedCollection<Row & { sortOrder: number }, Values>;
  columns: Column<Row>[];
  rowName: (row: Row) => string;
  Form: (props: RowFormProps<Row, Values>) => ReactNode;
  deleteTitle: string;
  deleteBody: (row: Row) => ReactNode;
}) {
  const { repo } = useAdmin();
  const toast = useToast();
  const list = useQuery((r) => collection(r).list());
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editing !== null) formRef.current?.focus();
  }, [editing]);

  const col = collection(repo);

  async function save(values: Values) {
    const id = editing && editing !== 'new' ? editing.id : null;
    await col.save(id, values);
    setEditing(null);
    toast({
      text: `${noun[0]?.toUpperCase() ?? ''}${noun.slice(1)} saved as draft.`,
      link: { href: '/admin/publish', label: 'Preview & publish' },
    });
  }

  async function remove(row: Row) {
    setDeleting(null);
    try {
      await col.remove(row.id);
      toast({
        text: `${noun[0]?.toUpperCase() ?? ''}${noun.slice(1)} deleted (draft).`,
        link: { href: '/admin/publish', label: 'Preview & publish' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function move(row: Row, direction: 'up' | 'down') {
    try {
      const { position, total } = await col.move(row.id, direction);
      setAnnounce(`Moved ${direction}. New position: ${position} of ${total}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <>
      <PageHead
        title={title}
        sub={sub}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            {addLabel}
          </button>
        }
      />
      {error ? (
        <Alert tone="err" title="That did not work.">
          {error}
        </Alert>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {announce ? <p className="small muted">{announce}</p> : null}

      {editing !== null ? (
        <section
          className="panel"
          aria-labelledby="row-form-h"
          tabIndex={-1}
          ref={formRef}
          data-testid="row-form"
        >
          <h2 id="row-form-h">{editing === 'new' ? addLabel : `Edit ${noun}`}</h2>
          <Form
            row={editing === 'new' ? null : editing}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : null}

      <QueryBoundary query={list.state} reload={list.reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              title={emptyTitle}
              actions={
                <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
                  {addLabel}
                </button>
              }
            >
              {emptyText}
            </EmptyState>
          ) : (
            <table className="rt admin-table">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th scope="col" key={c.header} className={c.className}>
                      {c.header}
                    </th>
                  ))}
                  <th scope="col">Visible</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const name = rowName(row);
                  return (
                    <tr key={row.id}>
                      {columns.map((c, i) =>
                        i === 0 ? (
                          <th scope="row" key={c.header}>
                            {c.cell(row)}
                          </th>
                        ) : (
                          <td data-label={c.header} key={c.header} className={c.className}>
                            {c.cell(row)}
                          </td>
                        ),
                      )}
                      <td data-label="Visible">
                        <StatusBadge kind={row.isHidden ? 'hidden' : 'shown'} />
                      </td>
                      <td data-label="Actions" className="actions">
                        <span className="reorder">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Move ${name} up`}
                            disabled={index === 0}
                            onClick={() => move(row, 'up')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Move ${name} down`}
                            disabled={index === rows.length - 1}
                            onClick={() => move(row, 'down')}
                          >
                            ↓
                          </button>
                        </span>{' '}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditing(row)}
                        >
                          Edit<span className="sr-only"> {name}</span>
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setDeleting(row)}
                        >
                          Delete<span className="sr-only"> {name}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </QueryBoundary>

      <Dialog
        open={deleting !== null}
        destructive
        onClose={() => setDeleting(null)}
        title={deleteTitle}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleting(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => deleting && remove(deleting)}
            >
              Delete
            </button>
          </>
        }
      >
        {deleting ? deleteBody(deleting) : null}
      </Dialog>
    </>
  );
}
