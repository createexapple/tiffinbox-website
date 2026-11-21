'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PAYMENT_METHOD_LABEL, formatDateTime, rangeLabel } from '@/admin/format';
import { isFutureDate } from '@/admin/rules';
import type { CustomerDetail, CustomerRow, PaymentMethod, PaymentRow } from '@/admin/types';
import {
  validatePayment,
  validateVoidReason,
  type PaymentField,
} from '@/admin/validation/operations';
import { formatRs, formatShortDate } from '@/lib/format';
import { useAdmin, useQuery } from '../AdminProvider';
import { ErrorSummary, RadioGroup, SelectField, TextAreaField, TextField } from '../fields';
import { useToast } from '../Toast';
import { Alert, Dialog, PageHead, QueryBoundary, StatusBadge } from '../ui';

interface Loaded {
  payment: PaymentRow | null;
  detail: CustomerDetail | null;
  customers: CustomerRow[];
  today: string;
}

/**
 * A-17 (FR-28): record a payment, or edit / void one.
 * `paymentId` set = edit. Otherwise `customerId` (and optionally `subscriptionId`) pre-select the customer.
 */
export function PaymentFormScreen({
  paymentId,
  customerId,
  subscriptionId,
}: {
  paymentId?: string;
  customerId?: string;
  subscriptionId?: string;
}) {
  const [picked, setPicked] = useState(customerId ?? '');
  const { state, reload } = useQuery(
    async (repo): Promise<Loaded> => {
      const payment = paymentId ? await repo.getPayment(paymentId) : null;
      const owner = payment?.customerId ?? picked;
      return {
        payment,
        detail: owner ? await repo.getCustomerDetail(owner) : null,
        customers: owner ? [] : await repo.listCustomers({}),
        today: await repo.getToday(),
      };
    },
    [paymentId, picked],
  );

  return (
    <>
      <p className="crumbs">
        {picked || paymentId ? (
          state.status === 'ready' && state.data.detail ? (
            <Link href={`/admin/customers/${state.data.detail.customer.id}`}>← Customer</Link>
          ) : (
            <Link href="/admin/payments">← Payments</Link>
          )
        ) : (
          <Link href="/admin/payments">← Payments</Link>
        )}
      </p>
      <PageHead
        title={paymentId ? 'Edit payment' : 'Record payment'}
        sub="Takes under a minute. Receipts are sent by you on WhatsApp."
      />
      <QueryBoundary query={state} reload={reload}>
        {(data) =>
          data.detail ? (
            <PaymentForm
              key={`${data.payment?.id ?? 'new'}-${data.detail.customer.id}`}
              data={data as Loaded & { detail: CustomerDetail }}
              subscriptionId={subscriptionId}
            />
          ) : (
            <div className="panel">
              <SelectField
                id="pay-customer"
                label="Customer"
                required
                value={picked}
                onChange={setPicked}
                options={[
                  { value: '', label: 'Choose a customer…' },
                  ...data.customers.map((c) => ({ value: c.customer.id, label: c.customer.name })),
                ]}
              />
              <p className="small muted">
                Pick the customer first, then the subscription this payment is for.
              </p>
            </div>
          )
        }
      </QueryBoundary>
    </>
  );
}

function PaymentForm({
  data,
  subscriptionId: presetSubscription,
}: {
  data: Loaded & { detail: CustomerDetail };
  subscriptionId?: string | undefined;
}) {
  const { repo } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const { payment, detail, today } = data;
  const customer = detail.customer;
  const subs = detail.subscriptions;
  const voided = payment?.voidedAt != null;

  const openFirst =
    subs.find((s) => detail.periods.some((p) => p.subscriptionId === s.id && p.balance > 0)) ??
    subs[0];
  const [subscriptionId, setSubscriptionId] = useState(
    payment?.subscriptionId ?? presetSubscription ?? openFirst?.id ?? '',
  );
  const sub = subs.find((s) => s.id === subscriptionId);
  const period = detail.periods.find((p) => p.subscriptionId === subscriptionId);

  const [fromOverride, setFromOverride] = useState<string | null>(payment?.coversFrom ?? null);
  const [toOverride, setToOverride] = useState<string | null>(payment?.coversTo ?? null);
  const coversFrom = fromOverride ?? sub?.startDate ?? '';
  const coversTo = toOverride ?? sub?.endDate ?? '';
  const [amountOverride, setAmountOverride] = useState<string | null>(
    payment ? String(payment.amount) : null,
  );
  const suggestedAmount = period && period.balance > 0 ? String(period.balance) : '';
  const amount = amountOverride ?? suggestedAmount;
  const [paidOn, setPaidOn] = useState(payment?.paidOn ?? today);
  const [method, setMethod] = useState<PaymentMethod | ''>(payment?.method ?? '');
  const [reference, setReference] = useState(payment?.reference ?? '');
  const [note, setNote] = useState(payment?.note ?? '');
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | undefined>();
  const [confirmVoid, setConfirmVoid] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<PaymentField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<PaymentRow | null>(null);
  const [keepFuture, setKeepFuture] = useState(false);
  const [saving, setSaving] = useState(false);

  const future = isFutureDate(paidOn, today) && !keepFuture;

  async function save(ignoreDuplicate: boolean) {
    setServerError(null);
    const result = validatePayment({
      subscriptionId,
      coversFrom,
      coversTo,
      amount,
      paidOn,
      method,
      reference,
      note,
    });
    if (!result.ok) {
      setErrors(result.errors);
      setDuplicate(null);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (!ignoreDuplicate) {
        const other = await repo.findDuplicateReference(
          result.value.method,
          result.value.reference,
          payment?.id,
        );
        if (other) {
          setDuplicate(other);
          return;
        }
      }
      if (payment) await repo.updatePayment(payment.id, result.value);
      else await repo.createPayment(customer.id, result.value);
      const after = await repo.getCustomerDetail(customer.id);
      const target = after.periods.find((p) => p.subscriptionId === result.value.subscriptionId);
      const range = target ? rangeLabel(target.periodStart, target.periodEnd) : 'this period';
      const outcome =
        target && target.status === 'paid'
          ? `${customer.name} is now Paid for ${range}.`
          : target
            ? `${customer.name} still owes ${formatRs(target.balance)} for ${range}.`
            : '';
      toast({
        text: `Payment saved. ${outcome} Send the receipt on WhatsApp yourself.`,
        link: { href: `/admin/customers/${customer.id}`, label: 'View customer' },
      });
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

  function askVoid() {
    const message = validateVoidReason(voidReason);
    setVoidError(message ?? undefined);
    if (!message) setConfirmVoid(true);
  }

  async function doVoid() {
    setConfirmVoid(false);
    if (!payment) return;
    try {
      await repo.voidPayment(payment.id, voidReason);
      toast({
        text: 'Payment voided. The original stays in Change history.',
        link: { href: '/admin/history', label: 'Change history' },
      });
      router.push(`/admin/customers/${customer.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  const archived = customer.archivedAt !== null;
  const blocked = voided || archived || subs.length === 0;

  return (
    <div className="panel">
      <form noValidate onSubmit={onSubmit}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Customer: <b>{customer.name}</b>
        </p>
        {archived ? (
          <Alert tone="info" title="This customer is archived.">
            Restore the customer before recording payments.
          </Alert>
        ) : null}
        {subs.length === 0 ? (
          <Alert
            tone="warn"
            title="This customer has no subscription yet."
            actions={
              <Link href={`/admin/customers/${customer.id}/subscriptions/new`}>
                Add a subscription
              </Link>
            }
          >
            A payment is recorded against a subscription period.
          </Alert>
        ) : null}
        {voided && payment ? (
          <Alert tone="info" title="This payment was voided.">
            Voided {payment.voidedAt ? formatDateTime(payment.voidedAt) : ''}. Reason:{' '}
            {payment.voidReason}. The original values stay in Change history.
          </Alert>
        ) : null}

        <ErrorSummary
          errors={errors}
          serverError={serverError}
          labels={{
            subscriptionId: { id: 'pay-sub', label: 'Subscription' },
            coversFrom: { id: 'pay-from', label: 'Period covered: from' },
            coversTo: { id: 'pay-to', label: 'Period covered: to' },
            amount: { id: 'pay-amount', label: 'Amount' },
            paidOn: { id: 'pay-date', label: 'Payment date' },
            method: { id: 'pay-method-group', label: 'Method' },
            reference: { id: 'pay-ref', label: 'Reference' },
            note: { id: 'pay-note', label: 'Note' },
          }}
        />

        <SelectField
          id="pay-sub"
          label="Subscription"
          required
          value={subscriptionId}
          onChange={(v) => {
            setSubscriptionId(v);
            setFromOverride(null);
            setToOverride(null);
            setAmountOverride(null);
          }}
          error={errors.subscriptionId}
          options={subs.map((s) => ({
            value: s.id,
            label: `${s.planName}, ${s.term} ${rangeLabel(s.startDate, s.endDate)} (due ${formatRs(s.amountPerPeriod)})`,
          }))}
        />
        <div className="form-grid c2">
          <TextField
            id="pay-from"
            label="Period covered: from"
            required
            type="date"
            value={coversFrom}
            onChange={setFromOverride}
            error={errors.coversFrom}
          />
          <TextField
            id="pay-to"
            label="Period covered: to"
            required
            type="date"
            value={coversTo}
            onChange={setToOverride}
            error={errors.coversTo}
          />
        </div>
        {period ? (
          <p className="small" style={{ marginTop: 0 }} data-testid="balance-line">
            Due <b>{formatRs(period.amountDue)}</b> · already paid <b>{formatRs(period.paid)}</b>
            {payment ? ' (including this payment)' : ''} · balance <b>{formatRs(period.balance)}</b>{' '}
            <StatusBadge kind={period.status} />
          </p>
        ) : null}
        <div className="form-grid c2">
          <TextField
            id="pay-amount"
            label="Amount (Rs)"
            required
            inputMode="numeric"
            maxWidth="12rem"
            value={amount}
            onChange={setAmountOverride}
            error={errors.amount}
          />
          <TextField
            id="pay-date"
            label="Payment date"
            required
            type="date"
            value={paidOn}
            onChange={(v) => {
              setPaidOn(v);
              setKeepFuture(false);
            }}
            error={errors.paidOn}
          />
        </div>
        {future ? (
          <Alert
            tone="warn"
            title={`The payment date is in the future (${formatShortDate(paidOn)}).`}
            actions={
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPaidOn(today)}
                >
                  Use today
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setKeepFuture(true)}
                >
                  Keep {formatShortDate(paidOn)}
                </button>
              </>
            }
          >
            Today is {formatShortDate(today)}. Is the date right?
          </Alert>
        ) : null}
        <div id="pay-method-group" tabIndex={-1}>
          <RadioGroup<PaymentMethod>
            name="method"
            label="Method"
            value={method}
            onChange={setMethod}
            error={errors.method}
            options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({
              value: m,
              label: PAYMENT_METHOD_LABEL[m],
            }))}
          />
        </div>
        <TextField
          id="pay-ref"
          label="Reference (transaction ID, optional)"
          value={reference}
          onChange={(v) => {
            setReference(v);
            setDuplicate(null);
          }}
          error={errors.reference}
        />
        <TextAreaField
          id="pay-note"
          label="Note (optional)"
          value={note}
          onChange={setNote}
          error={errors.note}
        />

        {duplicate ? (
          <Alert
            tone="warn"
            title="This reference was already used."
            actions={
              <>
                <Link href="/admin/payments">View that payment</Link>
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
            {duplicate.reference} is saved on another {PAYMENT_METHOD_LABEL[duplicate.method]}{' '}
            payment ({duplicate.customerName}, {formatShortDate(duplicate.paidOn)}). Check you are
            not recording the same payment twice.
          </Alert>
        ) : null}

        <div className="cta-row" style={{ marginTop: 'var(--sp-4)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving || blocked}>
            Save payment
          </button>
          <Link className="btn btn-secondary" href={`/admin/customers/${customer.id}`}>
            Cancel
          </Link>
        </div>

        {payment && !voided ? (
          <fieldset className="fieldset" style={{ marginTop: 'var(--sp-5)' }}>
            <legend>Void this payment</legend>
            <TextAreaField
              id="pay-void"
              label="Reason (required)"
              value={voidReason}
              onChange={setVoidReason}
              hint="The original values stay in Change history."
              error={voidError}
            />
            <button type="button" className="btn btn-danger" onClick={askVoid}>
              Void payment
            </button>
          </fieldset>
        ) : null}
      </form>

      <Dialog
        open={confirmVoid}
        destructive
        onClose={() => setConfirmVoid(false)}
        title="Void this payment?"
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmVoid(false)}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={doVoid}>
              Void payment
            </button>
          </>
        }
      >
        <p>
          {payment ? formatRs(payment.amount) : ''} will no longer count as paid and the dues total
          will update. The original payment stays in Change history.
        </p>
      </Dialog>
    </div>
  );
}
