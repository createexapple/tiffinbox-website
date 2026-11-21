/**
 * Warning rules that do not block saving (FR-24, FR-26, FR-28): duplicate phone, overlapping
 * subscription, duplicate payment reference, future payment date. Pure functions.
 * Stage 2 stand-in: at Stage 3 the lookups run in the database (indexed), the wording stays here.
 */
import { rangesOverlap } from './dates';
import type { Customer, Payment, PaymentMethod, Subscription } from './types';

/** Another customer with the same phone number (the phone is indexed, not unique: FR-24). */
export function findDuplicatePhone(
  customers: readonly Customer[],
  phone: string,
  excludeCustomerId?: string,
): Customer | null {
  return customers.find((c) => c.phone === phone && c.id !== excludeCustomerId) ?? null;
}

/** An existing, non-paused subscription of the same customer whose dates overlap (FR-26). */
export function findOverlappingSubscription(
  subs: readonly Subscription[],
  customerId: string,
  startDate: string,
  endDate: string,
  excludeSubscriptionId?: string,
): Subscription | null {
  return (
    subs.find(
      (s) =>
        s.customerId === customerId &&
        s.id !== excludeSubscriptionId &&
        s.manualState === 'active' &&
        rangesOverlap(s.startDate, s.endDate, startDate, endDate),
    ) ?? null
  );
}

/** Another non-voided payment with the same method and reference (FR-28). Empty references never match. */
export function findDuplicateReference(
  payments: readonly Payment[],
  method: PaymentMethod,
  reference: string,
  excludePaymentId?: string,
): Payment | null {
  const ref = reference.trim().toLowerCase();
  if (ref === '') return null;
  return (
    payments.find(
      (p) =>
        p.id !== excludePaymentId &&
        p.voidedAt === null &&
        p.method === method &&
        p.reference.trim().toLowerCase() === ref,
    ) ?? null
  );
}

export function isFutureDate(date: string, today: string): boolean {
  return date > today;
}
