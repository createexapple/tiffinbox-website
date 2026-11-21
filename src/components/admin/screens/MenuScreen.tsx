'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { addDays } from '@/admin/dates';
import {
  MEAL_LABEL,
  dateKeyOf,
  formatDateTimeWithWeekday,
  timeKeyOf,
  toKarachiIso,
  weekLabel,
} from '@/admin/format';
import type { MealKey, MenuSlot, MenuWeekView } from '@/admin/types';
import {
  DAY_NAMES,
  MEALS,
  MENU_SLOT_MAX,
  slotKey,
  validateGoLive,
  validateMenuSlots,
} from '@/admin/validation/content';
import { formatTime12h } from '@/lib/format';
import { RepoError } from '@/admin/repository';
import { useAdmin, useQuery } from '../AdminProvider';
import { CheckField, ErrorSummary, TextField } from '../fields';
import { useToast } from '../Toast';
import { Alert, Dialog, EmptyState, PageHead, QueryBoundary, StatusBadge } from '../ui';

function blankSlots(): MenuSlot[] {
  return DAY_NAMES.flatMap((_, day) =>
    MEALS.map((meal) => ({ day, meal, dishText: '', notServed: false })),
  );
}

/** A-03 (FR-14, FR-15, FR-21): this week (live) and next week (draft, scheduled). */
export function MenuScreen() {
  const weeks = useQuery((repo) => repo.listMenuWeeks());
  const settings = useQuery((repo) => repo.getSettings());
  const [tab, setTab] = useState<'this' | 'next'>('next');
  const [blankStarted, setBlankStarted] = useState(false);

  return (
    <>
      <PageHead
        title="Menu"
        sub="Edit this week or prepare next week. 21 slots: 7 days × breakfast, lunch, dinner."
        actions={
          <Link className="btn btn-secondary" href="/admin/media">
            Images
          </Link>
        }
      />
      <QueryBoundary query={weeks.state} reload={weeks.reload}>
        {(list) => {
          const live = list.find((w) => w.status === 'live') ?? null;
          const thisStart = live?.weekStart ?? null;
          const nextStart = thisStart ? addDays(thisStart, 7) : null;
          const next = list.find((w) => w.weekStart === nextStart) ?? null;
          const times =
            settings.state.status === 'ready' ? settings.state.data.site.deliveryTimes : null;
          const active = tab === 'this' && live ? 'this' : 'next';
          return (
            <>
              <div role="tablist" className="tabs" aria-label="Menu week">
                {live && thisStart ? (
                  <button
                    role="tab"
                    id="tab-this"
                    type="button"
                    aria-selected={active === 'this'}
                    aria-controls="panel-this"
                    tabIndex={active === 'this' ? 0 : -1}
                    onClick={() => setTab('this')}
                  >
                    This week {weekLabel(thisStart)} <StatusBadge kind="live" />
                  </button>
                ) : null}
                {nextStart ? (
                  <button
                    role="tab"
                    id="tab-next"
                    type="button"
                    aria-selected={active === 'next'}
                    aria-controls="panel-next"
                    tabIndex={active === 'next' ? 0 : -1}
                    onClick={() => setTab('next')}
                  >
                    Next week {weekLabel(nextStart)}{' '}
                    <StatusBadge kind={next ? next.status : 'draft'} />
                  </button>
                ) : null}
              </div>
              {!live ? (
                <Alert tone="info" title="No menu is live yet.">
                  Prepare a menu and publish it to put it on the website.
                </Alert>
              ) : null}
              {active === 'this' && live ? (
                <div role="tabpanel" id="panel-this" aria-labelledby="tab-this">
                  <WeekEditor
                    key={`this-${live.id}`}
                    weekStart={live.weekStart}
                    week={live}
                    times={times}
                    isLive
                    onPublishedNow={() => setTab('this')}
                  />
                </div>
              ) : nextStart ? (
                <div role="tabpanel" id="panel-next" aria-labelledby="tab-next">
                  {next || blankStarted ? (
                    <WeekEditor
                      key={`next-${nextStart}-${next ? 'saved' : 'blank'}`}
                      weekStart={nextStart}
                      week={next}
                      times={times}
                      isLive={false}
                      onPublishedNow={() => {
                        setBlankStarted(false);
                        setTab('this');
                      }}
                    />
                  ) : (
                    <NoNextWeek
                      weekStart={nextStart}
                      fromWeekStart={thisStart as string}
                      onBlank={() => setBlankStarted(true)}
                    />
                  )}
                </div>
              ) : null}
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}

function NoNextWeek({
  weekStart,
  fromWeekStart,
  onBlank,
}: {
  weekStart: string;
  fromWeekStart: string;
  onBlank: () => void;
}) {
  const { repo } = useAdmin();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error ? (
        <Alert tone="err" title="Could not copy the menu.">
          {error}
        </Alert>
      ) : null}
      <EmptyState
        title={`No menu for ${weekLabel(weekStart)} yet`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                repo.copyMenuWeek(fromWeekStart, weekStart).then(
                  () =>
                    toast({ text: 'Copied last week. All 21 slots are filled in and editable.' }),
                  (e: unknown) => setError(e instanceof Error ? e.message : 'Please try again.'),
                )
              }
            >
              Copy last week (21 slots)
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBlank}>
              Start blank
            </button>
          </>
        }
      >
        Start from last week’s menu and change what is different, or start blank.
      </EmptyState>
    </>
  );
}

function WeekEditor({
  weekStart,
  week,
  times,
  isLive,
  onPublishedNow,
}: {
  weekStart: string;
  week: MenuWeekView | null;
  times: Record<MealKey, string> | null;
  isLive: boolean;
  onPublishedNow: () => void;
}) {
  const { repo } = useAdmin();
  const toast = useToast();
  const [slots, setSlots] = useState<MenuSlot[]>(() =>
    week ? week.slots.map((s) => ({ ...s })) : blankSlots(),
  );
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmNow, setConfirmNow] = useState(false);

  const scheduled = week?.status === 'scheduled';
  const defaultDate = addDays(weekStart, -1);
  const [goDate, setGoDate] = useState(week?.goLiveAt ? dateKeyOf(week.goLiveAt) : defaultDate);
  const [goTime, setGoTime] = useState(week?.goLiveAt ? timeKeyOf(week.goLiveAt) : '18:00');
  const [goError, setGoError] = useState<string | null>(null);

  const errors = useMemo(() => (submitted ? validateMenuSlots(slots) : {}), [slots, submitted]);

  function update(day: number, meal: MealKey, patch: Partial<MenuSlot>) {
    setSlots((current) =>
      current.map((s) => (s.day === day && s.meal === meal ? { ...s, ...patch } : s)),
    );
  }

  async function save() {
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(validateMenuSlots(slots)).length > 0) return;
    try {
      await repo.saveMenuWeek(weekStart, slots);
      toast(
        isLive || !scheduled
          ? {
              text: 'Draft saved. Live site unchanged.',
              link: { href: '/admin/publish', label: 'Preview & publish' },
            }
          : { text: 'Saved. The scheduled copy is updated. The live menu is untouched.' },
      );
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function schedule() {
    setGoError(null);
    const message = validateGoLive(goDate, goTime, await repo.getNow());
    if (message) {
      setGoError(message);
      return;
    }
    if (Object.keys(validateMenuSlots(slots)).length > 0) {
      setSubmitted(true);
      setGoError('Fix the highlighted menu slots first.');
      return;
    }
    try {
      await repo.saveMenuWeek(weekStart, slots);
      await repo.scheduleMenuWeek(weekStart, toKarachiIso(goDate, goTime));
      toast({
        text: `Scheduled. ${weekLabel(weekStart)} goes live ${formatDateTimeWithWeekday(toKarachiIso(goDate, goTime))}.`,
      });
    } catch (e) {
      setGoError(e instanceof RepoError ? e.message : 'Please try again.');
    }
  }

  async function publishNow() {
    setConfirmNow(false);
    try {
      await repo.saveMenuWeek(weekStart, slots);
      await repo.publishMenuNow(weekStart);
      toast({ text: `Published. ${weekLabel(weekStart)} is now the live menu.` });
      onPublishedNow();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  async function cancelSchedule() {
    try {
      await repo.cancelMenuSchedule(weekStart);
      toast({ text: 'Schedule cancelled. The menu is a draft again. The live menu is untouched.' });
    } catch (e) {
      setGoError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  const labels: Record<string, { id: string; label: string }> = {};
  for (const s of slots) {
    labels[slotKey(s)] = {
      id: `slot-${s.day}-${s.meal}`,
      label: `${DAY_NAMES[s.day] ?? ''} ${s.meal}`,
    };
  }

  return (
    <>
      {isLive ? (
        <Alert tone="info" title="You are editing the live week.">
          Changes are saved as a draft. Visitors see them only after you publish.
          {week?.hasUnpublishedEdits ? (
            <>
              {' '}
              <Link href="/admin/publish">This week has unpublished edits.</Link>
            </>
          ) : null}
        </Alert>
      ) : (
        <section className="panel" aria-labelledby="golive-h">
          <h2 id="golive-h">Go live</h2>
          {scheduled && week?.goLiveAt ? (
            <Alert tone="info" title={`Scheduled for ${formatDateTimeWithWeekday(week.goLiveAt)}.`}>
              The live menu is untouched until then. You can still edit this week below; edits
              update the scheduled copy.
            </Alert>
          ) : (
            <p className="small muted">
              No go-live time set: this is a draft. The live site is unaffected (FR-15).
            </p>
          )}
          <div className="form-grid c2" style={{ marginTop: 'var(--sp-3)' }}>
            <TextField
              id="golive-date"
              label="Date"
              type="date"
              value={goDate}
              onChange={setGoDate}
            />
            <TextField
              id="golive-time"
              label="Time"
              type="time"
              value={goTime}
              onChange={setGoTime}
              hint="Default is Sunday 6:00 PM. Confirm the time with the client (Q-24)."
            />
          </div>
          {goError ? (
            <Alert tone="err" title="Check the go-live time.">
              {goError}
            </Alert>
          ) : null}
          <div className="cta-row" style={{ marginTop: 'var(--sp-3)' }}>
            <button type="button" className="btn btn-primary" onClick={schedule}>
              {scheduled ? 'Update schedule' : 'Schedule go-live'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmNow(true)}>
              Publish now
            </button>
            {scheduled ? (
              <button type="button" className="btn btn-ghost" onClick={cancelSchedule}>
                Cancel schedule
              </button>
            ) : null}
          </div>
        </section>
      )}

      <ErrorSummary errors={errors} labels={labels} serverError={serverError} />

      <div className="slot-grid" style={{ marginTop: 'var(--sp-4)' }}>
        {DAY_NAMES.map((dayName, day) => (
          <fieldset className="day" key={dayName}>
            <legend className="sr-only">{dayName}</legend>
            <h3>{dayName}</h3>
            <div className="meals">
              {MEALS.map((meal) => {
                const slot = slots.find((s) => s.day === day && s.meal === meal);
                if (!slot) return null;
                const id = `slot-${day}-${meal}`;
                const time = times ? ` (${formatTime12h(times[meal])})` : '';
                const error = errors[slotKey(slot)];
                return (
                  <div key={meal}>
                    <div className="field">
                      <label htmlFor={id}>
                        {MEAL_LABEL[meal]}
                        {time}
                      </label>
                      <textarea
                        id={id}
                        name={id}
                        rows={2}
                        value={slot.notServed ? '' : slot.dishText}
                        disabled={slot.notServed}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-e` : undefined}
                        onChange={(e) => update(day, meal, { dishText: e.target.value })}
                      />
                      {slot.dishText.length > MENU_SLOT_MAX * 0.9 && !slot.notServed ? (
                        <span className="hint">
                          {slot.dishText.length} / {MENU_SLOT_MAX}
                        </span>
                      ) : null}
                      {error ? (
                        <span className="err" id={`${id}-e`}>
                          <span>{error}</span>
                        </span>
                      ) : null}
                    </div>
                    <CheckField
                      id={`${id}-ns`}
                      label={`Not served`}
                      checked={slot.notServed}
                      onChange={(checked) => update(day, meal, { notServed: checked })}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="actionbar">
        <button type="button" className="btn btn-primary" onClick={save}>
          {scheduled ? 'Save changes' : 'Save draft'}
        </button>
        <Link className="btn btn-secondary" href="/admin/publish">
          Preview &amp; publish
        </Link>
        {week ? (
          // Plain link, not next/link: it turns draft mode on, so it must never be prefetched.
          <a
            className="btn btn-secondary"
            href={`/admin/preview?to=${encodeURIComponent('/menu')}&week=${encodeURIComponent(week.id)}`}
            target="_blank"
            rel="noopener"
          >
            Preview this week<span className="sr-only"> on the website (new tab)</span>
          </a>
        ) : null}
      </div>

      <Dialog
        open={confirmNow}
        onClose={() => setConfirmNow(false)}
        title="Publish this menu now?"
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmNow(false)}
            >
              Not yet
            </button>
            <button type="button" className="btn btn-primary" onClick={publishNow}>
              Publish now
            </button>
          </>
        }
      >
        <p>
          {weekLabel(weekStart)} replaces the live menu on the website straight away. Other draft
          changes are not published.
        </p>
      </Dialog>
    </>
  );
}
