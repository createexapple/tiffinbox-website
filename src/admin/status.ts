/**
 * Badge labels for the admin screens (FR-27, FR-29). The statuses themselves come from the database views and are
 * only displayed here; this module owns the wording and the CSS class per status in one place.
 */
import type { MenuWeekStatus, PaymentStatus, SubscriptionStatus } from './types';

// ---------- Badges ----------

export type BadgeKey =
  | SubscriptionStatus
  | PaymentStatus
  | MenuWeekStatus
  | 'renewal_due'
  | 'archived'
  | 'void'
  | 'shown'
  | 'hidden';

export interface BadgeSpec {
  label: string;
  /** Class from admin.css. Colour is never the only signal: each badge has its own marker shape and word. */
  className: string;
}

const BADGES: Record<BadgeKey, BadgeSpec> = {
  active: { label: 'Active', className: 'b-active' },
  paused: { label: 'Paused', className: 'b-paused' },
  expired: { label: 'Expired', className: 'b-expired' },
  upcoming: { label: 'Upcoming', className: 'b-upcoming' },
  paid: { label: 'Paid', className: 'b-paid' },
  unpaid: { label: 'Unpaid', className: 'b-unpaid' },
  overdue: { label: 'Overdue', className: 'b-overdue' },
  draft: { label: 'Draft', className: 'b-draft' },
  scheduled: { label: 'Scheduled', className: 'b-scheduled' },
  live: { label: 'Live', className: 'b-live' },
  past: { label: 'Past', className: 'b-past' },
  renewal_due: { label: 'Renewal due', className: 'b-renewal' },
  archived: { label: 'Archived', className: 'b-archived' },
  void: { label: 'Void', className: 'b-void' },
  shown: { label: 'Shown', className: 'b-active' },
  hidden: { label: 'Hidden', className: 'b-paused' },
};

export function badgeFor(key: BadgeKey): BadgeSpec {
  return BADGES[key];
}
