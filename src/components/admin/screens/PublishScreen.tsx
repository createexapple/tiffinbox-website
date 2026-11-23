'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDateTimeWithWeekday, weekLabel } from '@/admin/format';
import { RepoError } from '@/admin/repository';
import type { PublishResult } from '@/admin/types';
import { useAdmin, useQuery } from '../AdminProvider';
import { StatusIcon } from '../icons';
import { useToast } from '../Toast';
import { Alert, Dialog, PageHead, QueryBoundary, StatusBadge } from '../ui';

/** A plain link (not next/link): it turns draft mode on, so it must never be prefetched. */
function previewHref(path: string): string {
  return `/admin/preview?to=${encodeURIComponent(path)}`;
}

type Outcome =
  | { kind: 'none' }
  | { kind: 'success'; result: PublishResult }
  | { kind: 'failure'; liveVersion: number; reason: string };

/** A-10 (FR-22, NFR-08): preview, publish check, publish, and roll back. */
export function PublishScreen() {
  const { repo } = useAdmin();
  const toast = useToast();
  const { state, reload } = useQuery((r) => r.getPublishOverview());
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'none' });
  const [rollbackTo, setRollbackTo] = useState<number | null>(null);

  async function publish(liveVersion: number) {
    setConfirm(false);
    setPublishing(true);
    setOutcome({ kind: 'none' });
    try {
      const result = await repo.publish();
      setOutcome({ kind: 'success', result });
    } catch (e) {
      setOutcome({
        kind: 'failure',
        liveVersion,
        reason:
          e instanceof RepoError && e.code === 'blocked'
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Unknown problem.',
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <PageHead title="Preview & publish" sub="Check your changes, then make them live." />
      <QueryBoundary query={state} reload={reload}>
        {(o) => {
          const count = o.pending.length;
          return (
            <>
              {outcome.kind === 'success' ? (
                <Alert
                  tone="ok"
                  title="Published."
                  actions={
                    <>
                      <Link href="/plans" target="_blank" rel="noopener">
                        View public site
                      </Link>
                      <Link href="/admin/history">Change history</Link>
                    </>
                  }
                >
                  The live site now shows version v{outcome.result.version} (
                  {formatDateTimeWithWeekday(outcome.result.publishedAt)}). The publish time is
                  saved in Change history.
                  {outcome.result.visibleOnSite === false
                    ? ' The cached pages could not be confirmed yet; visitors will see it within a minute.'
                    : ''}
                </Alert>
              ) : null}
              {outcome.kind === 'failure' ? (
                <Alert
                  tone="err"
                  title="Publishing did not work."
                  actions={
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirm(true)}
                    >
                      Try again
                    </button>
                  }
                >
                  Your live site is unchanged and still shows version v{outcome.liveVersion}. Your
                  drafts are safe. Reason: {outcome.reason} Please try again; if it keeps failing,
                  tell the Createex team.
                </Alert>
              ) : null}
              {publishing ? (
                <section className="panel" aria-label="Publishing">
                  <p role="status" style={{ margin: 0 }}>
                    <b>Publishing…</b> This takes a few seconds. The live site stays as it is until
                    this finishes.
                  </p>
                  <div
                    className="progress"
                    style={{ margin: 'var(--sp-3) 0' }}
                    role="progressbar"
                    aria-label="Publishing"
                    aria-valuetext="In progress"
                  >
                    <span style={{ width: '55%' }} />
                  </div>
                </section>
              ) : null}

              <Alert tone="info" title="Preview shows your drafts on the real pages.">
                The preview links open the public pages with your unpublished drafts and a yellow
                “Preview” bar. Only you can see it, and nothing is live until you publish.
              </Alert>

              <section
                className="panel"
                style={{ marginTop: 'var(--sp-4)' }}
                aria-labelledby="pub-pending"
              >
                {count === 0 ? (
                  <>
                    <h2 id="pub-pending">No changes to publish</h2>
                    <p className="muted">
                      The live site matches your drafts (version v{o.liveVersion}). Make a change in
                      Menu, Plans, Dishes, Add-ons, FAQ or Settings and it will appear here.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 id="pub-pending">
                      {count} {count === 1 ? 'change' : 'changes'} waiting
                    </h2>
                    <table className="rt admin-table">
                      <caption className="sr-only">Changes waiting to be published</caption>
                      <thead>
                        <tr>
                          <th scope="col">Area</th>
                          <th scope="col">Change</th>
                          <th scope="col">Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.pending.map((c, i) => (
                          <tr key={`${c.area}-${i}`}>
                            <th scope="row">{c.area}</th>
                            <td data-label="Change">{c.summary}</td>
                            <td data-label="Preview">
                              <a href={previewHref(c.previewHref)} target="_blank" rel="noopener">
                                Open preview<span className="sr-only"> of {c.area} (new tab)</span>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {o.scheduledWeeks.map((w) => (
                  <p key={w.weekStart} className="small">
                    Menu {weekLabel(w.weekStart)} <StatusBadge kind="scheduled" /> goes live{' '}
                    {formatDateTimeWithWeekday(w.goLiveAt)}. It does not need publishing here.
                  </p>
                ))}
                {o.unscheduledDraftWeeks.map((w) => (
                  <p key={w} className="small">
                    Menu {weekLabel(w)} <StatusBadge kind="draft" /> is not scheduled yet and is not
                    affected by publishing. <Link href="/admin/menu">Schedule it in Menu</Link>.
                  </p>
                ))}

                <h3 style={{ fontSize: 'var(--fs-base)' }}>Publish check</h3>
                <ul className="check-list">
                  {o.checks.map((c) => (
                    <li key={c.label}>
                      <StatusIcon name={c.ok ? 'check' : 'x'} />
                      <div>
                        <b>{c.label}</b>
                        {c.fix ? (
                          <>
                            <br />
                            <span className="small muted">{c.fix}</span>{' '}
                            {c.fixHref ? (
                              <Link href={c.fixHref} className="small">
                                {c.fixLabel}
                              </Link>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="cta-row">
                  <a
                    className="btn btn-secondary"
                    href={previewHref('/')}
                    target="_blank"
                    rel="noopener"
                  >
                    Open preview of the whole site
                    <span className="sr-only"> (new tab)</span>
                  </a>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!o.canPublish || publishing}
                    aria-disabled={!o.canPublish || publishing}
                    onClick={() => setConfirm(true)}
                  >
                    {publishing ? 'Publishing…' : 'Publish changes'}
                  </button>
                </div>
              </section>

              <section className="panel" aria-labelledby="pub-versions">
                <h2 id="pub-versions" style={{ fontSize: 'var(--fs-base)' }}>
                  Earlier versions <span className="tag">added for NFR-08</span>
                </h2>
                <table className="rt admin-table">
                  <caption className="sr-only">Published versions</caption>
                  <thead>
                    <tr>
                      <th scope="col">Version</th>
                      <th scope="col">Published</th>
                      <th scope="col">By</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.releases.map((r) => (
                      <tr key={r.version}>
                        <th scope="row">
                          v{r.version} {r.isLive ? <StatusBadge kind="live" /> : null}
                        </th>
                        <td data-label="Published">{formatDateTimeWithWeekday(r.publishedAt)}</td>
                        <td data-label="By">{r.publishedBy}</td>
                        <td data-label="Action" className="actions">
                          {r.isLive ? (
                            '–'
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setRollbackTo(r.version)}
                            >
                              Roll back to v{r.version}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <Dialog
                open={confirm}
                onClose={() => setConfirm(false)}
                title={`Publish ${count} ${count === 1 ? 'change' : 'changes'}?`}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setConfirm(false)}
                    >
                      Not yet
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => publish(o.liveVersion)}
                    >
                      Publish
                    </button>
                  </>
                }
              >
                <p>
                  Visitors will see them within a minute.
                  {o.scheduledWeeks[0]
                    ? ` The next-week menu stays scheduled for ${formatDateTimeWithWeekday(o.scheduledWeeks[0].goLiveAt)}.`
                    : ''}
                </p>
              </Dialog>

              <Dialog
                open={rollbackTo !== null}
                destructive
                onClose={() => setRollbackTo(null)}
                title={`Roll back to v${rollbackTo ?? ''}?`}
                actions={
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setRollbackTo(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={async () => {
                        const version = rollbackTo;
                        setRollbackTo(null);
                        if (version === null) return;
                        try {
                          await repo.rollback(version);
                          setOutcome({ kind: 'none' });
                          toast({
                            text: `The live site is back on version v${version}. Your drafts are kept.`,
                          });
                        } catch (e) {
                          setOutcome({
                            kind: 'failure',
                            liveVersion: o.liveVersion,
                            reason: e instanceof Error ? e.message : 'Unknown problem.',
                          });
                        }
                      }}
                    >
                      Roll back
                    </button>
                  </>
                }
              >
                <p>
                  The live site goes back to that earlier version. Your current drafts are not lost.
                </p>
              </Dialog>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}
