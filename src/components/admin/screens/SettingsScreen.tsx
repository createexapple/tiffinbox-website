'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { MEAL_LABEL } from '@/admin/format';
import type { MealKey, OpsSettings, SiteSettingsDraft } from '@/admin/types';
import {
  MEALS,
  MIN_PASSWORD_LENGTH,
  validatePasswordChange,
  validateSettings,
  type PasswordField,
  type SettingsField,
  type SettingsInput,
} from '@/admin/validation/content';
import { useAdmin, useQuery } from '../AdminProvider';
import { ErrorSummary, TextAreaField, TextField } from '../fields';
import { useToast } from '../Toast';
import { PageHead, QueryBoundary } from '../ui';

/** A-08 (FR-13 password, FR-20, FR-27 renewal window). */
export function SettingsScreen() {
  const { state, reload } = useQuery(async (repo) => ({
    ...(await repo.getSettings()),
    session: await repo.getSession(),
  }));
  return (
    <>
      <PageHead
        title="Site settings"
        sub="Contact details, times and rules used across the website. Saved as draft until you publish."
      />
      <QueryBoundary query={state} reload={reload}>
        {(data) => (
          <>
            <SettingsForm site={data.site} ops={data.ops} />
            <PasswordPanel email={data.session.email} />
          </>
        )}
      </QueryBoundary>
    </>
  );
}

function toInput(site: SiteSettingsDraft, ops: OpsSettings): SettingsInput {
  return {
    whatsappNumber: site.whatsappNumber,
    instagramHandle: site.instagramHandle,
    orderHours: site.orderHours,
    lastOrderTime: site.lastOrderTime,
    deliveryAreaText: site.deliveryAreaText,
    deliveryTimes: { ...site.deliveryTimes },
    skipCutoffs: { ...site.skipCutoffs },
    skipsPerWeek: String(site.skipsPerWeek),
    renewalWindowDays: String(ops.renewalWindowDays),
    overdueGraceDays: String(ops.overdueGraceDays),
  };
}

const SKIP_LABEL: Record<MealKey, string> = {
  breakfast: 'Breakfast skip cut-off (the night before)',
  lunch: 'Lunch skip cut-off (same day)',
  dinner: 'Dinner skip cut-off (same day)',
};

function SettingsForm({ site, ops }: { site: SiteSettingsDraft; ops: OpsSettings }) {
  const { repo } = useAdmin();
  const toast = useToast();
  const [v, setV] = useState<SettingsInput>(() => toInput(site, ops));
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) =>
    setV((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const result = validateSettings(v);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    try {
      await repo.saveSettings(result.value.site, {
        renewalWindowDays: result.value.renewalWindowDays,
        overdueGraceDays: result.value.overdueGraceDays,
      });
      toast({
        text: 'Settings saved as draft. Not live yet. Subscription rules apply immediately.',
        link: { href: '/admin/publish', label: 'Preview & publish' },
      });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  const labels: Record<string, { id: string; label: string }> = {
    whatsappNumber: { id: 's-wa', label: 'WhatsApp number' },
    instagramHandle: { id: 's-ig', label: 'Instagram handle' },
    orderHours: { id: 's-hours', label: 'Order hours' },
    lastOrderTime: { id: 's-last', label: 'Last time to order' },
    deliveryAreaText: { id: 's-area', label: 'Delivery area text' },
    skipsPerWeek: { id: 's-skips', label: 'Skips allowed per week' },
    renewalWindowDays: { id: 's-ren', label: 'Renewal window' },
    overdueGraceDays: { id: 's-grace', label: 'Grace days' },
  };
  for (const meal of MEALS) {
    labels[`deliveryTimes.${meal}`] = {
      id: `t-${meal}`,
      label: `${MEAL_LABEL[meal]} delivered by`,
    };
    labels[`skipCutoffs.${meal}`] = { id: `k-${meal}`, label: `${MEAL_LABEL[meal]} skip cut-off` };
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <ErrorSummary errors={errors} labels={labels} serverError={serverError} />

      <section className="panel" aria-labelledby="set-contact">
        <h2 id="set-contact">Contact</h2>
        <div className="form-grid c2">
          <TextField
            id="s-wa"
            label="WhatsApp number (orders)"
            inputMode="numeric"
            placeholder="e.g. 92XXXXXXXXXX"
            value={v.whatsappNumber}
            onChange={(x) => set('whatsappNumber', x)}
            hint="Digits only, with country code, no + or spaces. Not received yet: placeholder (Q-04). Publishing is blocked while empty."
            error={errors.whatsappNumber}
          />
          <TextField
            id="s-ig"
            label="Instagram handle"
            value={v.instagramHandle}
            onChange={(x) => set('instagramHandle', x)}
            hint="Without the @. Confirm with client (Q-04)."
            error={errors.instagramHandle}
          />
          <TextField
            id="s-hours"
            label="Order hours"
            placeholder="[order hours]"
            value={v.orderHours}
            onChange={(x) => set('orderHours', x)}
            hint="The brief’s example hours are not confirmed (Q-06). Publishing is blocked while empty."
            error={errors.orderHours}
          />
          <TextField
            id="s-last"
            label="Last time to order for next-day delivery"
            type="time"
            value={v.lastOrderTime}
            onChange={(x) => set('lastOrderTime', x)}
            hint="Q-06 / Q-20 unanswered."
            error={errors.lastOrderTime}
          />
          <TextAreaField
            id="s-area"
            label="Delivery area text"
            rows={3}
            value={v.deliveryAreaText}
            onChange={(x) => set('deliveryAreaText', x)}
            hint="Exact boundary pending (Q-11)."
            error={errors.deliveryAreaText}
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="set-times">
        <h2 id="set-times">Delivery times and skip cut-offs</h2>
        <table className="rt admin-table">
          <thead>
            <tr>
              <th scope="col">Meal</th>
              <th scope="col">Delivered by</th>
              <th scope="col">Skip before</th>
            </tr>
          </thead>
          <tbody>
            {MEALS.map((meal) => (
              <tr key={meal}>
                <th scope="row">{MEAL_LABEL[meal]}</th>
                <td data-label="Delivered by">
                  <TextField
                    id={`t-${meal}`}
                    label={`${MEAL_LABEL[meal]} delivered by`}
                    type="time"
                    value={v.deliveryTimes[meal]}
                    onChange={(x) => set('deliveryTimes', { ...v.deliveryTimes, [meal]: x })}
                    error={errors[`deliveryTimes.${meal}`]}
                  />
                </td>
                <td data-label="Skip before">
                  <TextField
                    id={`k-${meal}`}
                    label={SKIP_LABEL[meal]}
                    type="time"
                    value={v.skipCutoffs[meal]}
                    onChange={(x) => set('skipCutoffs', { ...v.skipCutoffs, [meal]: x })}
                    error={errors[`skipCutoffs.${meal}`]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <TextField
          id="s-skips"
          label="Skips allowed per week (shown as text only)"
          inputMode="numeric"
          maxWidth="8rem"
          value={v.skipsPerWeek}
          onChange={(x) => set('skipsPerWeek', x)}
          hint="The system does not count skips (Q-28 not in v1)."
          error={errors.skipsPerWeek}
        />
      </section>

      <section className="panel" aria-labelledby="set-subs">
        <h2 id="set-subs">Subscriptions and payments</h2>
        <p className="small muted">
          These apply immediately. They are not part of the published website.
        </p>
        <div className="form-grid c2">
          <TextField
            id="s-ren"
            label="Flag “renewal due” this many days before the end date"
            inputMode="numeric"
            value={v.renewalWindowDays}
            onChange={(x) => set('renewalWindowDays', x)}
            hint="With 7, every weekly plan is flagged for the whole week; consider 2 (Q-33)."
            error={errors.renewalWindowDays}
          />
          <TextField
            id="s-grace"
            label="Payment grace days before “overdue”"
            inputMode="numeric"
            value={v.overdueGraceDays}
            onChange={(x) => set('overdueGraceDays', x)}
            hint="Q-32."
            error={errors.overdueGraceDays}
          />
        </div>
      </section>

      <div className="actionbar">
        <button type="submit" className="btn btn-primary">
          Save draft
        </button>
        <Link className="btn btn-secondary" href="/admin/publish">
          Preview &amp; publish
        </Link>
      </div>
    </form>
  );
}

/**
 * Password change (FR-13). MOCK: the fields are validated and cleared; nothing is stored, compared with a
 * secret or logged. Stage 3 sends them to Supabase Auth over the server action.
 */
function PasswordPanel({ email }: { email: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validatePasswordChange({ current, next, repeat });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setCurrent('');
    setNext('');
    setRepeat('');
    toast({ text: 'Password change checked. Mock: nothing was changed or stored.' });
  }

  return (
    <section className="panel" id="password" aria-labelledby="set-account">
      <h2 id="set-account">Your account</h2>
      <p className="small muted">Signed in as {email}</p>
      <form noValidate onSubmit={onSubmit}>
        <ErrorSummary
          errors={errors}
          labels={{
            current: { id: 'pw-cur', label: 'Current password' },
            next: { id: 'pw-new', label: 'New password' },
            repeat: { id: 'pw-new2', label: 'Repeat new password' },
          }}
        />
        <div className="form-grid c2">
          <TextField
            id="pw-cur"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            error={errors.current}
          />
          <div />
          <TextField
            id="pw-new"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={setNext}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters (rule set in Auth settings).`}
            error={errors.next}
          />
          <TextField
            id="pw-new2"
            label="Repeat new password"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={setRepeat}
            error={errors.repeat}
          />
        </div>
        <button type="submit" className="btn btn-secondary">
          Change password
        </button>
      </form>
    </section>
  );
}
