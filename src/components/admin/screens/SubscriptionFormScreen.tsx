'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { addDays } from '@/admin/dates';
import { rangeLabel } from '@/admin/format';
import { defaultAmount, proposeEndDate } from '@/admin/ledger';
import type {
  Customer,
  ManualState,
  PlanDraft,
  PlanTerm,
  PricingRules,
  SubscriptionRow,
} from '@/admin/types';
import { validateSubscription, type SubscriptionField } from '@/admin/validation/operations';
import { formatRs, formatShortDate } from '@/lib/format';
import { useAdmin, useQuery } from '../AdminProvider';
import {
  CheckField,
  ErrorSummary,
  RadioGroup,
  SelectField,
  TextAreaField,
  TextField,
} from '../fields';
import { useToast } from '../Toast';
import { Alert, PageHead, QueryBoundary } from '../ui';

type Mode = 'new' | 'edit' | 'renew';

interface Loaded {
  customer: Customer;
  plans: PlanDraft[];
  rules: PricingRules;
  existing: SubscriptionRow | null;
  today: string;
}

/**
 * A-15 (FR-26, FR-27): add, edit or renew a subscription.
 * new: `customerId`. edit / renew: `subscriptionId` (renew starts the day after the old one ends).
 */
export function SubscriptionFormScreen({
  mode,
  customerId,
  subscriptionId,
}: {
  mode: Mode;
  customerId?: string;
  subscriptionId?: string;
}) {
  const { state, reload } = useQuery(
    async (repo): Promise<Loaded> => {
      const existing = subscriptionId ? await repo.getSubscription(subscriptionId) : null;
      const owner = existing?.customerId ?? customerId;
      if (!owner) throw new Error('No customer was given.');
      const detail = await repo.getCustomerDetail(owner);
      return {
        customer: detail.customer,
        plans: await repo.listPlans(),
        rules: await repo.getPricingRules(),
        existing,
        today: await repo.getToday(),
      };
    },
    [mode, customerId, subscriptionId],
  );

  const title =
    mode === 'new'
      ? 'Add subscription'
      : mode === 'edit'
        ? 'Edit subscription'
        : 'Renew subscription';
  return (
    <>
      <p className="crumbs">
        {state.status === 'ready' ? (
          <Link href={`/admin/customers/${state.data.customer.id}`}>← Customer</Link>
        ) : (
          <Link href="/admin/customers">← Customers</Link>
        )}
      </p>
      <PageHead title={title} />
      <QueryBoundary query={state} reload={reload}>
        {(data) => <SubscriptionForm mode={mode} data={data} />}
      </QueryBoundary>
    </>
  );
}

function SubscriptionForm({ mode, data }: { mode: Mode; data: Loaded }) {
  const { repo } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const { customer, plans, rules, existing, today } = data;

  // Plans on offer: active ones, plus the plan this subscription already uses.
  const offered = plans.filter((p) => p.isActive || p.id === existing?.planId);
  const firstPlan = offered[0]?.id ?? '';

  const [planId, setPlanId] = useState(existing?.planId ?? firstPlan);
  const [term, setTerm] = useState<PlanTerm>(existing?.term ?? 'weekly');
  const [startDate, setStartDate] = useState(
    mode === 'renew' && existing
      ? addDays(existing.endDate, 1)
      : (existing?.startDate ?? addDays(today, 1)),
  );
  // Overrides: null means "follow the suggestion" (end date from the term, amount from the plan price).
  const [endOverride, setEndOverride] = useState<string | null>(
    mode === 'edit' ? (existing?.endDate ?? null) : null,
  );
  const [breakfast, setBreakfast] = useState(existing?.breakfastAddon ?? false);
  const [amountOverride, setAmountOverride] = useState<string | null>(
    mode === 'edit' && existing ? String(existing.amountPerPeriod) : null,
  );
  const [amountNote, setAmountNote] = useState(mode === 'edit' ? (existing?.amountNote ?? '') : '');
  const [manualState, setManualState] = useState<ManualState>(
    mode === 'edit' ? (existing?.manualState ?? 'active') : 'active',
  );
  const [notes, setNotes] = useState(mode === 'edit' ? (existing?.notes ?? '') : '');
  const [errors, setErrors] = useState<Partial<Record<SubscriptionField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [overlap, setOverlap] = useState<SubscriptionRow | null>(null);
  const [saving, setSaving] = useState(false);

  const plan = plans.find((p) => p.id === planId);
  const suggestedEnd = startDate ? safeEnd(startDate, term) : '';
  const endDate = endOverride ?? suggestedEnd;
  const suggested =
    plan && startDate && endDate
      ? safeDefaultAmount({
          plan,
          term,
          breakfastAddon: breakfast,
          breakfastPerDay: rules.breakfastAddonPrice,
          startDate,
          endDate,
        })
      : null;
  // Monthly has no default (Q-10), so a renewal of a monthly plan starts from the previous amount.
  const monthlyFallback =
    mode === 'renew' && existing && suggested === null ? String(existing.amountPerPeriod) : '';
  const amount = amountOverride ?? (suggested === null ? monthlyFallback : String(suggested));

  const input = () => ({
    planId,
    term,
    startDate,
    endDate,
    breakfastAddon: breakfast,
    amount,
    amountNote,
    manualState,
    notes,
  });

  async function save(ignoreOverlap: boolean) {
    setServerError(null);
    const result = validateSubscription(input(), {
      planIds: offered.map((p) => p.id),
      suggestedAmount: suggested,
    });
    if (!result.ok) {
      setErrors(result.errors);
      setOverlap(null);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (!ignoreOverlap) {
        const other = await repo.findOverlap(
          customer.id,
          result.value.startDate,
          result.value.endDate,
          mode === 'edit' ? existing?.id : undefined,
        );
        // A renewal starts the day after the old plan ends, so the plan it renews is never a conflict.
        if (other && !(mode === 'renew' && other.id === existing?.id)) {
          setOverlap(other);
          return;
        }
      }
      if (mode === 'edit' && existing) {
        await repo.updateSubscription(existing.id, result.value);
        toast({
          text: 'Subscription saved.',
          link: { href: '/admin/history', label: 'Change history' },
        });
      } else {
        await repo.createSubscription(
          customer.id,
          result.value,
          mode === 'renew' ? existing?.id : undefined,
        );
        toast({
          text: 'Subscription saved.',
          link: { href: `/admin/payments/new?customer=${customer.id}`, label: 'Record a payment' },
        });
      }
      router.push(`/admin/customers/${customer.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  const days = startDate && endDate && endDate >= startDate ? daysIn(startDate, endDate) : 0;
  const planLine =
    plan && suggested !== null
      ? breakfast
        ? `Plan ${formatRs(plan.weeklyPrice ?? 0)} + breakfast ${formatRs(rules.breakfastAddonPrice * days)} (${days} days) = ${formatRs(suggested)}`
        : `Plan price for this period: ${formatRs(suggested)}`
      : null;

  return (
    <div className="panel">
      <form noValidate onSubmit={onSubmit}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Customer: <b>{customer.name}</b>
        </p>
        {mode === 'renew' && existing ? (
          <Alert
            tone="info"
            title={`Renewal, pre-filled from the plan ending ${formatShortDate(existing.endDate)}.`}
          >
            It starts the day after: {formatShortDate(startDate)}. Check the dates and amount, then
            save.
          </Alert>
        ) : null}
        <ErrorSummary
          errors={errors}
          serverError={serverError}
          labels={{
            planId: { id: 'sub-plan', label: 'Plan' },
            startDate: { id: 'sub-start', label: 'Start date' },
            endDate: { id: 'sub-end', label: 'End date' },
            amount: { id: 'sub-amount', label: 'Amount' },
            amountNote: { id: 'sub-reason', label: 'Reason for a different amount' },
            notes: { id: 'sub-notes', label: 'Notes' },
          }}
        />
        <div className="form-grid c2">
          <SelectField
            id="sub-plan"
            label="Plan"
            required
            value={planId}
            onChange={setPlanId}
            error={errors.planId}
            options={offered.map((p) => ({
              value: p.id,
              label: `${p.name}${p.weeklyPrice === null ? '' : ` (${formatRs(p.weeklyPrice)} a week)`}${p.isActive ? '' : ' (not on the website)'}`,
            }))}
          />
          <RadioGroup<PlanTerm>
            name="term"
            label="Term"
            value={term}
            onChange={setTerm}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          <TextField
            id="sub-start"
            label="Start date"
            required
            type="date"
            value={startDate}
            onChange={setStartDate}
            error={errors.startDate}
          />
          <TextField
            id="sub-end"
            label="End date"
            required
            type="date"
            value={endDate}
            onChange={setEndOverride}
            hint={
              endOverride === null ? (
                `Suggested from the term (${term === 'weekly' ? '7 days' : '4 weeks'}). You can change it.`
              ) : (
                <>
                  Changed by you.{' '}
                  <button
                    type="button"
                    className="btn-link-reset"
                    style={{ textDecoration: 'underline' }}
                    onClick={() => setEndOverride(null)}
                  >
                    Use the suggested date
                  </button>
                </>
              )
            }
            error={errors.endDate}
          />
        </div>
        <CheckField
          id="sub-breakfast"
          label={`Add breakfast (${formatRs(rules.breakfastAddonPrice)} a day)`}
          checked={breakfast}
          onChange={setBreakfast}
        />
        <fieldset className="fieldset">
          <legend>Amount for this period</legend>
          {planLine ? (
            <p style={{ margin: '0 0 var(--sp-2)' }}>
              {planLine}{' '}
              <span className="small muted">(from today’s price; stored on this subscription)</span>
            </p>
          ) : (
            <p style={{ margin: '0 0 var(--sp-2)' }} className="muted">
              Monthly term: type the amount. There is no default until the client confirms how
              monthly prices work (Q-10).
            </p>
          )}
          <TextField
            id="sub-amount"
            label="Amount (Rs)"
            required
            inputMode="numeric"
            maxWidth="10rem"
            value={amount}
            onChange={setAmountOverride}
            error={errors.amount}
          />
          <TextField
            id="sub-reason"
            label="Reason if you changed the amount"
            value={amountNote}
            onChange={setAmountNote}
            hint="Required only when the amount differs from the plan price."
            error={errors.amountNote}
          />
        </fieldset>
        <div className="form-grid c2">
          <SelectField
            id="sub-status"
            label="Status"
            value={manualState}
            onChange={(v) => setManualState(v as ManualState)}
            hint="Expired and Upcoming are worked out from the dates. Pausing is manual: the system does not extend the end date (Q-28)."
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
            ]}
          />
          <TextAreaField
            id="sub-notes"
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            error={errors.notes}
          />
        </div>

        {overlap ? (
          <Alert
            tone="warn"
            title="This customer already has an active subscription for these dates."
            actions={
              <>
                <Link href={`/admin/customers/${customer.id}`}>Review existing</Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                  onClick={() => void save(true)}
                >
                  Save anyway
                </button>
              </>
            }
          >
            {customer.name} has {overlap.planName} {overlap.term}{' '}
            {rangeLabel(overlap.startDate, overlap.endDate)}. Saving this will overlap it.
          </Alert>
        ) : null}

        <div className="cta-row" style={{ marginTop: 'var(--sp-4)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            Save subscription
          </button>
          <Link className="btn btn-secondary" href={`/admin/customers/${customer.id}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function daysIn(start: string, end: string): number {
  return (
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
  );
}

/** A half-typed date input yields "" or an invalid value; never let that throw during render. */
function safeEnd(start: string, term: PlanTerm): string {
  try {
    return proposeEndDate(start, term);
  } catch {
    return '';
  }
}

function safeDefaultAmount(input: Parameters<typeof defaultAmount>[0]): number | null {
  try {
    return defaultAmount(input);
  } catch {
    return null;
  }
}
