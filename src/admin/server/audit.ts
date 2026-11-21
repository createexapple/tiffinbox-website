/**
 * Turns `change_history` rows (database audit log, FR-23) into the readable entries of the Change history screen.
 * Pure, unit-tested (tests/unit/admin-audit.test.ts). The audit log is written only by database triggers and the
 * publish / menu functions, so this module only reads and words it.
 *
 * Money in text uses `formatRs`; personal values (names) are only shown to the signed-in admin who may see them
 * anyway. Anonymised customers lose their values in the log itself (docs/database.md sec. 4).
 */
import { formatRs } from '@/lib/format';
import { PAYMENT_METHOD_LABEL, rangeLabel, weekLabel } from '../format';
import type { AuditEntry, RecordType } from '../types';

export interface AuditDb {
  id: number | string;
  at: string;
  actor_label: string;
  action: string;
  table_name: string;
  record_id: string | null;
  subject_customer_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  record_type: string;
}

/** Current names for records whose diff rows do not repeat the name (only changed columns are logged). */
export interface AuditNames {
  plans: ReadonlyMap<string, string>;
  dishes: ReadonlyMap<string, string>;
  addons: ReadonlyMap<string, string>;
  faq: ReadonlyMap<string, string>;
  customers: ReadonlyMap<string, string>;
}

export const EMPTY_NAMES: AuditNames = {
  plans: new Map(),
  dishes: new Map(),
  addons: new Map(),
  faq: new Map(),
  customers: new Map(),
};

/** Record types the screen knows. Rows of any other table (admin accounts, billing periods) are not listed. */
const KNOWN: ReadonlySet<string> = new Set<RecordType>([
  'Content publish',
  'Menu',
  'Plans',
  'Pricing rules',
  'Dishes',
  'Add-ons',
  'FAQ',
  'Settings',
  'Images',
  'Customer',
  'Subscription',
  'Payment',
]);

const FIELD_LABEL: Record<string, string> = {
  name: 'name',
  audience: 'for',
  meals_included: 'meals',
  price_unit: 'price unit',
  unit_price: 'price per meal/day',
  weekly_price: 'weekly price',
  monthly_price: 'monthly price',
  is_most_popular: 'most popular',
  is_active: 'shown on website',
  is_hidden: 'hidden',
  sort_order: 'display order',
  price_note: 'price note',
  price: 'price',
  comes_with: 'comes with',
  media_id: 'photo',
  question: 'question',
  answer: 'answer',
  business_name: 'business name',
  tagline: 'tagline',
  whatsapp_number: 'WhatsApp number',
  instagram_handle: 'Instagram handle',
  order_hours: 'order hours',
  last_order_time: 'last time to order',
  area_served: 'area served',
  delivery_area_text: 'delivery area text',
  delivery_boundary_text: 'delivery boundary text',
  legal_name_and_address: 'legal name and address',
  delivery_times: 'delivery times',
  skip_cutoffs: 'skip cut-offs',
  skip_cutoff_days: 'skip cut-off days',
  skips_per_week: 'skips per week',
  payment_methods: 'payment methods',
  monthly_saving_percent: 'monthly saving %',
  breakfast_addon_price: 'breakfast add-on price',
  team_deal_text: 'team deal text',
  team_min_people: 'team minimum people',
  renewal_window_days: 'renewal window (days)',
  overdue_grace_days: 'grace days',
  monthly_period_rule: 'monthly period rule',
  menu_go_live_time: 'menu go-live time',
  alt_text: 'alt text',
  type: 'type',
  phone_e164: 'phone',
  address_text: 'address',
  org_name: 'organisation',
  contact_person: 'contact person',
  member_count: 'team members',
  notes: 'notes',
  archived_at: 'archived',
  term: 'term',
  start_date: 'start date',
  end_date: 'end date',
  breakfast_addon: 'breakfast add-on',
  amount_per_period: 'amount',
  amount_note: 'amount reason',
  manual_state: 'paused / active',
  manual_state_on: 'paused / active date',
  plan_id: 'plan',
  amount: 'amount',
  method: 'method',
  paid_on: 'payment date',
  covers_from: 'covers from',
  covers_to: 'covers to',
  reference: 'reference',
};

const MONEY_FIELDS = new Set([
  'unit_price',
  'weekly_price',
  'monthly_price',
  'price',
  'amount',
  'amount_per_period',
  'breakfast_addon_price',
]);

/** Friendly name of a database column for history and pending-change text. */
export const fieldLabel = (key: string): string => FIELD_LABEL[key] ?? key.replace(/_/g, ' ');
const label = fieldLabel;

export function valueText(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'not set';
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return formatRs(value);
  if (key === 'method' && typeof value === 'string') {
    return PAYMENT_METHOD_LABEL[value as keyof typeof PAYMENT_METHOD_LABEL] ?? value;
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Keys that differ between the old and new values, ignoring bookkeeping columns. */
function changedKeys(row: AuditDb): string[] {
  const oldV = row.old_values ?? {};
  const newV = row.new_values ?? {};
  const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)]);
  keys.delete('updated_at');
  return [...keys].filter((k) => JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]));
}

/** "Edited <noun> “name” (draft): a, b" with a before/after pair when exactly one short value changed. */
function describeEdit(
  verb: string,
  subject: string,
  suffix: string,
  row: AuditDb,
): Pick<AuditEntry, 'summary' | 'diff'> {
  const keys = changedKeys(row);
  const oldV = row.old_values ?? {};
  const newV = row.new_values ?? {};
  if (keys.length === 1 && keys[0] !== undefined) {
    const key = keys[0];
    const from = valueText(key, oldV[key]);
    const to = valueText(key, newV[key]);
    if (from.length <= 60 && to.length <= 60) {
      return { summary: `${verb} ${subject}: ${label(key)}${suffix}`, diff: { from, to } };
    }
  }
  const list = keys.length > 0 ? `: ${keys.map(label).join(', ')}` : '';
  return { summary: `${verb} ${subject}${list}${suffix}` };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

function recordName(
  row: AuditDb,
  map: ReadonlyMap<string, string>,
  nameKey: string,
  fallback: string,
): string {
  const fromRow = str(row.new_values?.[nameKey]) || str(row.old_values?.[nameKey]);
  return fromRow || (row.record_id ? map.get(row.record_id) : undefined) || fallback;
}

function listArea(
  row: AuditDb,
  noun: string,
  names: ReadonlyMap<string, string>,
  nameKey: string,
): Pick<AuditEntry, 'summary' | 'diff'> {
  const name = recordName(row, names, nameKey, `a ${noun}`);
  const subject = name.startsWith('a ') ? name : `${noun} “${name}”`;
  if (row.action === 'insert') return { summary: `Added ${subject} (draft)` };
  if (row.action === 'delete') return { summary: `Deleted ${subject} (draft)` };
  const keys = changedKeys(row);
  if (keys.length === 1 && keys[0] === 'sort_order') {
    return { summary: `Changed the display order of ${subject} (draft)` };
  }
  return describeEdit('Edited', subject, ' (draft)', row);
}

function customerName(row: AuditDb, names: AuditNames): string {
  const fromRow = str(row.new_values?.name) || str(row.old_values?.name);
  return (
    (row.subject_customer_id ? names.customers.get(row.subject_customer_id) : undefined) ||
    fromRow ||
    'a customer'
  );
}

function describe(
  row: AuditDb,
  names: AuditNames,
): Pick<AuditEntry, 'summary' | 'diff' | 'earlierValues'> | null {
  const oldV = row.old_values ?? {};
  const newV = row.new_values ?? {};

  switch (row.table_name) {
    case 'content_releases': {
      if (row.action === 'rollback') {
        return {
          summary: `Rolled back the live site to version v${str(newV.version) || num(newV.version)}. Drafts kept.`,
        };
      }
      const areas = Array.isArray(newV.changed_areas) ? (newV.changed_areas as string[]) : [];
      const note = str(newV.note);
      return {
        summary:
          `Published version v${num(newV.version)}` +
          (areas.length > 0 ? ` (${areas.join(', ')})` : '') +
          '.' +
          (note !== '' ? ` Note: ${note}` : ''),
      };
    }
    case 'menu_weeks': {
      const start = str(newV.week_start) || str(row.record_id);
      const week = /^\d{4}-\d{2}-\d{2}$/.test(start) ? weekLabel(start) : 'a week';
      if (row.action === 'menu_saved') {
        return { summary: `Saved menu ${week} (draft; live site unchanged)` };
      }
      if (row.action === 'menu_copied') return { summary: `Copied a menu into ${week} (draft)` };
      if (row.action === 'menu_released') {
        const mode = str(newV.mode);
        if (mode === 'schedule') return { summary: `Scheduled menu ${week} to go live` };
        if (mode === 'cancel_schedule') {
          return { summary: `Cancelled the schedule for menu ${week} (back to draft)` };
        }
        return { summary: `Published menu ${week} now` };
      }
      return { summary: `Menu ${week} changed` };
    }
    case 'plans':
      return listArea(row, 'plan', names.plans, 'name');
    case 'dishes':
      return listArea(row, 'dish', names.dishes, 'name');
    case 'addons':
      return listArea(row, 'add-on', names.addons, 'name');
    case 'faq_entries':
      return listArea(row, 'question', names.faq, 'question');
    case 'pricing_rules':
      return describeEdit('Changed', 'pricing rules', ' (draft)', row);
    case 'site_settings':
      return describeEdit('Changed', 'site settings', ' (draft)', row);
    case 'ops_settings': {
      const keys = changedKeys(row);
      const parts = keys.map((k) => `${label(k)} ${valueText(k, newV[k])}`);
      return {
        summary: `Subscription rules changed${parts.length > 0 ? `: ${parts.join(', ')}` : ''} (saved immediately)`,
      };
    }
    case 'media': {
      if (row.action === 'insert')
        return { summary: `Added image ${str(newV.file_name) || 'file'}` };
      if (row.action === 'delete')
        return { summary: `Deleted image ${str(oldV.file_name) || 'file'}` };
      return describeEdit('Edited', 'image details', '', row);
    }
    case 'page_images': {
      const slot = str(row.record_id) === 'og_share' ? 'share preview' : 'home page';
      if (row.action === 'delete') return { summary: `Removed the ${slot} image (draft)` };
      return { summary: `Set the ${slot} image (draft)` };
    }
    case 'customers': {
      const name = customerName(row, names);
      if (row.action === 'anonymise') {
        return { summary: 'Anonymised a customer (personal data removed, payment amounts kept)' };
      }
      if (row.action === 'insert') {
        return { summary: `Created ${name} (${str(newV.type) || 'customer'})` };
      }
      const keys = changedKeys(row);
      if (keys.length === 1 && keys[0] === 'archived_at') {
        return { summary: `${newV.archived_at ? 'Archived' : 'Restored'} ${name}` };
      }
      const shown = keys.filter((k) => k !== 'archived_at');
      return {
        summary: `Edited ${name}: ${shown.length > 0 ? shown.map(label).join(', ') : 'no field changed'}`,
      };
    }
    case 'subscriptions': {
      const name = customerName(row, names);
      const plan = str(newV.plan_name_snapshot) || str(oldV.plan_name_snapshot) || 'plan';
      const term = str(newV.term) || str(oldV.term);
      const start = str(newV.start_date) || str(oldV.start_date);
      const end = str(newV.end_date) || str(oldV.end_date);
      const range = start && end ? ` ${rangeLabel(start, end)}` : '';
      if (row.action === 'insert') {
        return {
          summary: `Created: ${plan} ${term}${range}, ${formatRs(num(newV.amount_per_period))} (${name})`,
        };
      }
      const moved =
        oldV.amount_per_period !== undefined && oldV.amount_per_period !== newV.amount_per_period;
      return {
        summary: `Edited ${plan} ${term}${range} (${name})`,
        ...(moved
          ? {
              diff: {
                from: formatRs(num(oldV.amount_per_period)),
                to: formatRs(num(newV.amount_per_period)),
              },
            }
          : {}),
      };
    }
    case 'payments': {
      const name = customerName(row, names);
      if (row.action === 'insert') {
        const method = PAYMENT_METHOD_LABEL[newV.method as keyof typeof PAYMENT_METHOD_LABEL];
        return {
          summary: `Recorded ${formatRs(num(newV.amount))}, ${(method ?? str(newV.method)).toLowerCase()} (${name})`,
        };
      }
      const method = PAYMENT_METHOD_LABEL[oldV.method as keyof typeof PAYMENT_METHOD_LABEL];
      const earlier = (verb: string) =>
        `${verb} values kept: amount ${formatRs(num(oldV.amount))}, ${method ?? str(oldV.method)}, ` +
        `${str(oldV.reference) === '' ? 'ref none, ' : `ref ${str(oldV.reference)}, `}date ${str(oldV.paid_on)}.`;
      if (!oldV.voided_at && newV.voided_at) {
        const reason = str(newV.void_reason);
        return {
          summary: `Voided payment of ${formatRs(num(oldV.amount))} (${name})${reason !== '' ? `: ${reason}` : ''}`,
          earlierValues: earlier('Original'),
        };
      }
      const amountChanged = oldV.amount !== newV.amount;
      return {
        summary: `Edited payment of ${name}${amountChanged ? ': amount' : ''}`,
        ...(amountChanged
          ? { diff: { from: formatRs(num(oldV.amount)), to: formatRs(num(newV.amount)) } }
          : {}),
        earlierValues: earlier('Previous'),
      };
    }
    default:
      return null;
  }
}

/** Null when the row is not shown (a table the screen does not list). */
export function mapAuditEntry(row: AuditDb, names: AuditNames = EMPTY_NAMES): AuditEntry | null {
  if (!KNOWN.has(row.record_type)) return null;
  const text = describe(row, names);
  if (!text) return null;
  return {
    id: String(row.id),
    at: row.at,
    actor: row.actor_label,
    recordType: row.record_type as RecordType,
    ...text,
  };
}
