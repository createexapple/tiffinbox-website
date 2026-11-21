'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CUSTOMER_TYPE_LABEL } from '@/admin/format';
import type { Customer, CustomerType } from '@/admin/types';
import {
  formatPhone,
  validateCustomer,
  type CustomerField,
  type CustomerInput,
} from '@/admin/validation/operations';
import { useAdmin, useQuery } from '../AdminProvider';
import { ErrorSummary, RadioGroup, TextField } from '../fields';
import { useToast } from '../Toast';
import { Alert, PageHead, QueryBoundary } from '../ui';

/** A-14 (FR-24): add or edit a customer. `customerId` set = edit. */
export function CustomerFormScreen({ customerId }: { customerId?: string }) {
  const { state, reload } = useQuery(
    async (repo) => (customerId ? (await repo.getCustomerDetail(customerId)).customer : null),
    [customerId],
  );
  return (
    <>
      <p className="crumbs">
        <Link href={customerId ? `/admin/customers/${customerId}` : '/admin/customers'}>
          {customerId ? '← Customer' : '← Customers'}
        </Link>
      </p>
      <QueryBoundary query={state} reload={reload}>
        {(customer) => <CustomerForm customer={customer} />}
      </QueryBoundary>
    </>
  );
}

function CustomerForm({ customer }: { customer: Customer | null }) {
  const { repo } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  const [input, setInput] = useState<CustomerInput>(() => ({
    type: customer?.type ?? 'student',
    name: customer?.name ?? '',
    phone: customer ? formatPhone(customer.phone) : '',
    address: customer?.address ?? '',
    orgName: customer?.orgName ?? '',
    contactPerson: customer?.contactPerson ?? '',
    memberCount: customer?.memberCount ? String(customer.memberCount) : '',
    notes: customer?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<CustomerField, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
    if (key === 'phone') setDuplicate(null);
  };

  async function save(ignoreDuplicate: boolean) {
    setServerError(null);
    const result = validateCustomer(input);
    if (!result.ok) {
      setErrors(result.errors);
      setDuplicate(null);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (!ignoreDuplicate) {
        const other = await repo.findDuplicatePhone(result.value.phone, customer?.id);
        if (other) {
          setDuplicate(other);
          return;
        }
      }
      if (customer) {
        await repo.updateCustomer(customer.id, result.value);
        toast({
          text: 'Saved. The customer record is up to date.',
          link: { href: '/admin/history', label: 'Change history' },
        });
        router.push(`/admin/customers/${customer.id}`);
      } else {
        const created = await repo.createCustomer(result.value);
        toast({
          text: 'Customer saved.',
          link: {
            href: `/admin/customers/${created.id}/subscriptions/new`,
            label: 'Add a subscription',
          },
        });
        router.push(`/admin/customers/${created.id}`);
      }
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

  const isOffice = input.type === 'office';

  return (
    <>
      <PageHead
        title={customer ? `Edit ${customer.name}` : 'Add customer'}
        sub="Choose Office to see the team fields."
      />
      <div className="panel">
        <form noValidate onSubmit={onSubmit}>
          <ErrorSummary
            errors={errors}
            serverError={serverError}
            labels={{
              name: { id: 'cust-name', label: 'Name' },
              phone: { id: 'cust-phone', label: 'Phone / WhatsApp' },
              address: { id: 'cust-address', label: 'Address' },
              orgName: { id: 'cust-org', label: 'Organisation name' },
              contactPerson: { id: 'cust-contact', label: 'Contact person' },
              memberCount: { id: 'cust-members', label: 'Team members' },
            }}
          />
          <RadioGroup<CustomerType>
            name="type"
            label="Customer type"
            value={input.type}
            onChange={(type) => set('type', type)}
            options={(['student', 'office', 'home'] as const).map((t) => ({
              value: t,
              label: CUSTOMER_TYPE_LABEL[t],
            }))}
          />
          <div className="form-grid c2">
            <TextField
              id="cust-name"
              label="Name"
              required
              value={input.name}
              onChange={(v) => set('name', v)}
              error={errors.name}
            />
            <TextField
              id="cust-phone"
              label="Phone / WhatsApp"
              required
              type="tel"
              inputMode="tel"
              placeholder="03XX-XXXXXXX"
              value={input.phone}
              onChange={(v) => set('phone', v)}
              hint="Pakistani mobile number, for example 0300-0000000."
              error={errors.phone}
            />
            <div className="span2">
              <TextField
                id="cust-address"
                label="Address / hostel / office"
                value={input.address}
                onChange={(v) => set('address', v)}
                error={errors.address}
              />
            </div>
          </div>
          {isOffice ? (
            <fieldset className="fieldset">
              <legend>Office details</legend>
              <div className="form-grid c2">
                <TextField
                  id="cust-org"
                  label="Organisation name"
                  required
                  value={input.orgName}
                  onChange={(v) => set('orgName', v)}
                  error={errors.orgName}
                />
                <TextField
                  id="cust-contact"
                  label="Contact person"
                  required
                  value={input.contactPerson}
                  onChange={(v) => set('contactPerson', v)}
                  error={errors.contactPerson}
                />
                <TextField
                  id="cust-members"
                  label="Team members"
                  required
                  type="number"
                  inputMode="numeric"
                  min={1}
                  maxWidth="8rem"
                  value={input.memberCount}
                  onChange={(v) => set('memberCount', v)}
                  hint="Whole number, 1 or more."
                  error={errors.memberCount}
                />
              </div>
            </fieldset>
          ) : null}

          {duplicate ? (
            <Alert
              tone="warn"
              title="This phone number is already saved."
              actions={
                <>
                  <Link href={`/admin/customers/${duplicate.id}`}>Open {duplicate.name}</Link>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={saving}
                    onClick={() => void save(true)}
                  >
                    Save anyway as {customer ? 'this customer' : 'a new customer'}
                  </button>
                </>
              }
            >
              {formatPhone(duplicate.phone)} belongs to {duplicate.name}. Is this the same person?
            </Alert>
          ) : null}

          <div className="cta-row" style={{ marginTop: 'var(--sp-4)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              Save customer
            </button>
            <Link
              className="btn btn-secondary"
              href={customer ? `/admin/customers/${customer.id}` : '/admin/customers'}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
