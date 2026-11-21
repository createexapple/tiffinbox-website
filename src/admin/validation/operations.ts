/** Validation for customers, subscriptions and payments (FR-24, FR-26, FR-28). */
import { isIsoDate } from '../dates';
import type { Customer, CustomerType, ManualState, PaymentMethod, PlanTerm } from '../types';
import {
  checkText,
  fail,
  hasErrors,
  parsePositiveRupees,
  parseWholeNumber,
  type FieldErrors,
  type Validation,
} from './common';

// ---------- Phone ----------

/**
 * Normalises a Pakistani mobile number to local form "03XXXXXXXXX" (11 digits). Accepts spaces, dashes,
 * brackets, and the international forms +92 3XX..., 0092 3XX..., 92 3XX.... Returns null if it is not a
 * valid mobile number (03 followed by 9 digits).
 */
export function normalisePhone(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0092')) digits = digits.slice(4);
  else if (digits.startsWith('92') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('3') && digits.length === 10) digits = `0${digits}`;
  return /^03\d{9}$/.test(digits) ? digits : null;
}

/** "03000000001" -> "0300-0000001" */
export function formatPhone(normalised: string): string {
  return /^03\d{9}$/.test(normalised)
    ? `${normalised.slice(0, 4)}-${normalised.slice(4)}`
    : normalised;
}

// ---------- Customer ----------

export interface CustomerInput {
  type: CustomerType;
  name: string;
  phone: string;
  address: string;
  orgName: string;
  contactPerson: string;
  memberCount: string;
  notes: string;
}

export type CustomerField = keyof CustomerInput;

export const PHONE_ERROR = 'Enter a valid Pakistani mobile number, like 0300-0000000.';

export function validateCustomer(
  input: CustomerInput,
): Validation<Omit<Customer, 'id' | 'archivedAt'>, CustomerField> {
  const errors: FieldErrors<CustomerField> = {};

  const nameError = checkText(input.name, 'the customer’s name', { required: true, max: 120 });
  if (nameError) errors.name = nameError;

  const phone = normalisePhone(input.phone);
  if (input.phone.trim() === '') errors.phone = 'Enter the phone / WhatsApp number.';
  else if (phone === null) errors.phone = PHONE_ERROR;

  const addressError = checkText(input.address, 'the address', { max: 200 });
  if (addressError) errors.address = addressError;

  let memberCount: number | null = null;
  if (input.type === 'office') {
    const orgError = checkText(input.orgName, 'the organisation name', {
      required: true,
      max: 120,
    });
    if (orgError) errors.orgName = orgError;
    const contactError = checkText(input.contactPerson, 'the contact person', {
      required: true,
      max: 120,
    });
    if (contactError) errors.contactPerson = contactError;
    memberCount = parseWholeNumber(input.memberCount);
    if (memberCount === null || memberCount < 1) {
      errors.memberCount = 'Enter the number of team members as a whole number, 1 or more.';
    }
  }

  const notesError = checkText(input.notes, 'the notes', { max: 500 });
  if (notesError) errors.notes = notesError;

  if (hasErrors(errors) || phone === null) return fail(errors);
  const isOffice = input.type === 'office';
  return {
    ok: true,
    value: {
      type: input.type,
      name: input.name.trim(),
      phone,
      address: input.address.trim(),
      orgName: isOffice ? input.orgName.trim() : '',
      contactPerson: isOffice ? input.contactPerson.trim() : '',
      memberCount: isOffice ? memberCount : null,
      notes: input.notes.trim(),
    },
  };
}

// ---------- Subscription ----------

export interface SubscriptionInput {
  planId: string;
  term: PlanTerm;
  startDate: string;
  endDate: string;
  breakfastAddon: boolean;
  amount: string;
  amountNote: string;
  manualState: ManualState;
  notes: string;
}

export type SubscriptionField = keyof SubscriptionInput;

export interface SubscriptionValue {
  planId: string;
  term: PlanTerm;
  startDate: string;
  endDate: string;
  breakfastAddon: boolean;
  amountPerPeriod: number;
  amountNote: string;
  manualState: ManualState;
  notes: string;
}

/**
 * `suggestedAmount` is the amount the plan price proposes (null for monthly terms). When the admin
 * types a different amount, a reason is required (FR-26, A-20).
 */
export function validateSubscription(
  input: SubscriptionInput,
  ctx: { planIds: readonly string[]; suggestedAmount: number | null },
): Validation<SubscriptionValue, SubscriptionField> {
  const errors: FieldErrors<SubscriptionField> = {};

  if (!ctx.planIds.includes(input.planId)) errors.planId = 'Choose a plan from the list.';
  if (!isIsoDate(input.startDate)) errors.startDate = 'Choose the start date.';
  if (!isIsoDate(input.endDate)) errors.endDate = 'Choose the end date.';
  else if (isIsoDate(input.startDate) && input.endDate < input.startDate) {
    errors.endDate = 'End date is before the start date.';
  }

  const amount = parsePositiveRupees(input.amount);
  if (amount === null) errors.amount = 'Enter the amount in whole rupees, more than 0.';
  else if (ctx.suggestedAmount !== null && amount !== ctx.suggestedAmount) {
    if (input.amountNote.trim() === '') {
      errors.amountNote = 'Add a reason: the amount is different from the plan price.';
    }
  }
  const noteError = checkText(input.amountNote, 'the reason', { max: 200 });
  if (noteError) errors.amountNote = noteError;
  const notesError = checkText(input.notes, 'the notes', { max: 500 });
  if (notesError) errors.notes = notesError;

  if (hasErrors(errors) || amount === null) return fail(errors);
  return {
    ok: true,
    value: {
      planId: input.planId,
      term: input.term,
      startDate: input.startDate,
      endDate: input.endDate,
      breakfastAddon: input.breakfastAddon,
      amountPerPeriod: amount,
      amountNote: input.amountNote.trim(),
      manualState: input.manualState,
      notes: input.notes.trim(),
    },
  };
}

// ---------- Payment ----------

export interface PaymentInput {
  subscriptionId: string;
  coversFrom: string;
  coversTo: string;
  amount: string;
  paidOn: string;
  method: PaymentMethod | '';
  reference: string;
  note: string;
}

export type PaymentField = keyof PaymentInput | 'voidReason';

export interface PaymentValue {
  subscriptionId: string;
  coversFrom: string;
  coversTo: string;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  note: string;
}

export function validatePayment(input: PaymentInput): Validation<PaymentValue, PaymentField> {
  const errors: FieldErrors<PaymentField> = {};

  if (input.subscriptionId === '') errors.subscriptionId = 'Choose the subscription this pays for.';
  if (!isIsoDate(input.coversFrom)) errors.coversFrom = 'Choose the first day covered.';
  if (!isIsoDate(input.coversTo)) errors.coversTo = 'Choose the last day covered.';
  else if (isIsoDate(input.coversFrom) && input.coversTo < input.coversFrom) {
    errors.coversTo = 'The last day covered is before the first day.';
  }
  const amount = parsePositiveRupees(input.amount);
  if (amount === null) errors.amount = 'Enter the amount in whole rupees, more than 0.';
  if (!isIsoDate(input.paidOn)) errors.paidOn = 'Choose the payment date.';
  if (input.method === '') errors.method = 'Choose how it was paid.';
  const refError = checkText(input.reference, 'the reference', { max: 60 });
  if (refError) errors.reference = refError;
  const noteError = checkText(input.note, 'the note', { max: 300 });
  if (noteError) errors.note = noteError;

  if (hasErrors(errors) || amount === null || input.method === '') return fail(errors);
  return {
    ok: true,
    value: {
      subscriptionId: input.subscriptionId,
      coversFrom: input.coversFrom,
      coversTo: input.coversTo,
      amount,
      paidOn: input.paidOn,
      method: input.method,
      reference: input.reference.trim(),
      note: input.note.trim(),
    },
  };
}

export function validateVoidReason(reason: string): string | null {
  return checkText(reason, 'the reason', { required: true, max: 200 });
}
