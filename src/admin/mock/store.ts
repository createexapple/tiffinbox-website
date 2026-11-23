/**
 * MOCK REPOSITORY: in-memory implementation of `AdminRepository`, used ONLY by network-free unit and e2e tests
 * (selected by the explicit test flag in src/lib/env.ts, never in a deployed environment). NOTHING IS SAVED.
 * State lives in memory for the browser session and is lost on reload; the admin shell shows a "test mode" banner.
 * The real implementation is `ActionsAdminRepository` (Supabase server actions).
 *
 * It stands in for the SQL views (statuses, balances, overview counts) using ./status-rules and ./ledger, so
 * screens only display values the repository provides. Mock-only controls (scenarios, simulated failures) are on
 * `MockControls`, not on the repository.
 */
import { formatRs } from '@/lib/format';
import { addDays, daysBetween } from '../dates';
import { PAYMENT_METHOD_LABEL, dateKeyOf, rangeLabel, weekLabel } from '../format';
import { activePayments, sumAmounts } from '../ledger';
import { allocatePayments, balanceOf, monthlyPriceCheck } from './ledger';
import { findDuplicatePhone, findDuplicateReference, findOverlappingSubscription } from '../rules';
import {
  RepoError,
  type AdminRepository,
  type AddonValues,
  type CustomerValues,
  type DishValues,
  type FaqValues,
  type MediaRow,
  type OrderedCollection,
  type PlanValues,
} from '../repository';
import {
  isRenewalDue,
  menuWeekStatus,
  periodPaymentStatus,
  pickCurrentSubscription,
  slotsEqual,
  subscriptionStatus,
  worstPaymentStatus,
} from './status-rules';
import type {
  AddonDraft,
  AuditEntry,
  AuditFilter,
  ContentSnapshot,
  Customer,
  CustomerDetail,
  CustomerFilter,
  CustomerRow,
  DishDraft,
  FaqDraft,
  MenuSlot,
  MenuWeek,
  MenuWeekView,
  OpsSettings,
  Overview,
  Payment,
  PaymentFilter,
  PaymentRow,
  PeriodRow,
  PlanDraft,
  PricingRules,
  PublishOverview,
  PublishResult,
  RecordType,
  SiteSettingsDraft,
  Subscription,
  SubscriptionRow,
} from '../types';
import { validateMenuSlots } from '../validation/content';
import { formatPhone } from '../validation/operations';
import { PAGE_IMAGE_SLOTS, pageImageLabel } from '../types';
import type { PaymentValue, SubscriptionValue } from '../validation/operations';
import { buildPublishChecks, describePendingChanges } from './pending';
import {
  MOCK_ACCOUNT,
  MOCK_ACTOR,
  MOCK_NOW_BASE,
  MOCK_TODAY,
  buildScenario,
  type MockScenario,
  type MockState,
} from './seed';

export interface MockFlags {
  /** Every data load fails (shows the error state with Retry). */
  failLoads: boolean;
  /** Every data load is slow (shows the loading state). */
  slowLoads: boolean;
  /** The next publish fails once (shows the publish failure state). */
  failNextPublish: boolean;
}

export interface MockControls {
  getScenario(): MockScenario;
  reset(scenario: MockScenario): void;
  getFlags(): MockFlags;
  setFlag(flag: keyof MockFlags, value: boolean): void;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function newId(prefix: string): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid.replace(/-/g, '').slice(0, 8)}`;
}

const AUDIT_LIMIT = 500;

export class MockAdminStore implements AdminRepository, MockControls {
  private state: MockState;
  private scenario: MockScenario;
  private flags: MockFlags = { failLoads: false, slowLoads: false, failNextPublish: false };
  private ticks = 0;
  private version = 0;
  private epoch = 0;
  private listeners = new Set<() => void>();

  constructor(scenario: MockScenario = 'sample') {
    this.scenario = scenario;
    this.state = buildScenario(scenario);
  }

  // ---------- external store plumbing (React useSyncExternalStore) ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = (): number => this.version;
  /** Increments on every mock reset, so screens can drop local form state. */
  getEpoch = (): number => this.epoch;

  private touch(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  // ---------- mock controls ----------

  getScenario(): MockScenario {
    return this.scenario;
  }
  reset(scenario: MockScenario): void {
    this.scenario = scenario;
    this.state = buildScenario(scenario);
    this.ticks = 0;
    this.epoch += 1;
    this.touch();
  }
  getFlags(): MockFlags {
    return { ...this.flags };
  }
  setFlag(flag: keyof MockFlags, value: boolean): void {
    this.flags[flag] = value;
    this.touch();
  }

  // ---------- helpers ----------

  private nowIso(): string {
    return new Date(Date.parse(MOCK_NOW_BASE) + this.ticks * 60_000).toISOString();
  }

  private log(
    recordType: RecordType,
    entry: Omit<AuditEntry, 'id' | 'at' | 'actor' | 'recordType'>,
  ): void {
    this.ticks += 1;
    this.state.audit.unshift({
      id: newId('a'),
      at: this.nowIso(),
      actor: MOCK_ACTOR,
      recordType,
      ...entry,
    });
    this.state.audit.length = Math.min(this.state.audit.length, AUDIT_LIMIT);
  }

  private async read<T>(fn: () => T): Promise<T> {
    if (this.flags.slowLoads) await new Promise((resolve) => setTimeout(resolve, 1500));
    if (this.flags.failLoads) {
      throw new RepoError(
        'load_failed',
        'The data could not be loaded. Nothing was lost. Please try again.',
      );
    }
    return clone(fn());
  }

  private draftSnapshot(): ContentSnapshot {
    const s = this.state;
    return {
      settings: s.settings,
      pricingRules: s.pricingRules,
      plans: s.plans,
      dishes: s.dishes,
      addons: s.addons,
      faq: s.faq,
    };
  }

  private weekViews(): MenuWeekView[] {
    const now = this.nowIso();
    return [...this.state.menuWeeks]
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((w) => ({
        ...w,
        status: menuWeekStatus(w, this.state.menuWeeks, now),
        hasUnpublishedEdits: w.releasedSlots !== null && !slotsEqual(w.slots, w.releasedSlots),
      }));
  }

  private customerById(id: string): Customer {
    const found = this.state.customers.find((c) => c.id === id);
    if (!found) throw new RepoError('not_found', 'This customer was not found.');
    return found;
  }

  private subscriptionRow(s: Subscription): SubscriptionRow {
    const status = subscriptionStatus(s, MOCK_TODAY);
    return {
      ...s,
      status,
      renewalDue: isRenewalDue(status, s.endDate, MOCK_TODAY, this.state.ops.renewalWindowDays),
      daysToEnd: daysBetween(MOCK_TODAY, s.endDate),
    };
  }

  private allPeriodRows(): PeriodRow[] {
    const rows: PeriodRow[] = [];
    for (const sub of this.state.subscriptions) {
      const customer = this.state.customers.find((c) => c.id === sub.customerId);
      const periods = this.state.periods.filter((p) => p.subscriptionId === sub.id);
      const paidTotal = sumAmounts(
        activePayments(this.state.payments.filter((p) => p.subscriptionId === sub.id)),
      );
      const { paidByPeriod } = allocatePayments(periods, paidTotal);
      for (const period of periods) {
        const paid = paidByPeriod.get(period.id) ?? 0;
        rows.push({
          ...period,
          customerId: sub.customerId,
          customerName: customer?.name ?? 'Unknown customer',
          planName: sub.planName,
          paid,
          balance: balanceOf(period.amountDue, paid),
          status: periodPaymentStatus(period, paid, MOCK_TODAY, this.state.ops.overdueGraceDays),
        });
      }
    }
    return rows;
  }

  private customerRow(customer: Customer, periodRows: readonly PeriodRow[]): CustomerRow {
    const subs = this.state.subscriptions
      .filter((s) => s.customerId === customer.id)
      .map((s) => this.subscriptionRow(s));
    return {
      customer,
      current: pickCurrentSubscription(subs),
      subscriptionStatuses: [...new Set(subs.map((s) => s.status))],
      renewalDue: subs.some((s) => s.renewalDue),
      paymentStatus: worstPaymentStatus(
        periodRows.filter((p) => p.customerId === customer.id).map((p) => p.status),
      ),
    };
  }

  private paymentRow(p: Payment): PaymentRow {
    const customer = this.state.customers.find((c) => c.id === p.customerId);
    const sub = this.state.subscriptions.find((s) => s.id === p.subscriptionId);
    return {
      ...p,
      customerName: customer?.name ?? 'Unknown customer',
      planName: sub?.planName ?? '',
    };
  }

  private filterCustomers(filter: CustomerFilter): CustomerRow[] {
    const periodRows = this.allPeriodRows();
    const q = (filter.search ?? '').trim().toLowerCase();
    // Phone matching only applies when the search looks like a phone number, so "Home Sample 03" is a name search.
    const digits = /^[\d\s\-+()]+$/.test(q) ? q.replace(/\D/g, '') : '';
    return this.state.customers
      .filter((c) => filter.includeArchived || c.archivedAt === null)
      .map((c) => this.customerRow(c, periodRows))
      .filter((row) => {
        const c = row.customer;
        if (filter.type && c.type !== filter.type) return false;
        if (q !== '') {
          const text = [c.name, c.orgName, c.contactPerson].some((t) =>
            t.toLowerCase().includes(q),
          );
          const phone =
            digits.length > 0 && (c.phone.includes(digits) || formatPhone(c.phone).includes(q));
          if (!text && !phone) return false;
        }
        if (filter.subscription === 'renewal_due' && !row.renewalDue) return false;
        if (
          filter.subscription &&
          filter.subscription !== 'renewal_due' &&
          !row.subscriptionStatuses.includes(filter.subscription)
        ) {
          return false;
        }
        if (filter.payment && row.paymentStatus !== filter.payment) return false;
        return true;
      })
      .sort(
        (a, b) => Number(a.customer.archivedAt !== null) - Number(b.customer.archivedAt !== null),
      );
  }

  private collection<Row extends { id: string; sortOrder: number }, V extends object>(cfg: {
    key: 'dishes' | 'addons' | 'faq';
    prefix: string;
    type: RecordType;
    noun: string;
    create: (id: string, sortOrder: number, values: V) => Row;
    label: (values: Row | V) => string;
  }): OrderedCollection<Row, V> {
    const rows = () => this.state[cfg.key] as unknown as Row[];
    const set = (next: Row[]) => {
      next.sort((a, b) => a.sortOrder - b.sortOrder).forEach((r, i) => (r.sortOrder = i + 1));
      (this.state[cfg.key] as unknown as Row[]) = next;
    };
    return {
      list: () => this.read(() => [...rows()].sort((a, b) => a.sortOrder - b.sortOrder)),
      save: async (id, values) => {
        const current = rows();
        let saved: Row;
        if (id === null) {
          saved = cfg.create(newId(cfg.prefix), current.length + 1, values);
          set([...current, saved]);
          this.log(cfg.type, { summary: `Added ${cfg.noun} “${cfg.label(values)}” (draft)` });
        } else {
          const existing = current.find((r) => r.id === id);
          if (!existing) throw new RepoError('not_found', `This ${cfg.noun} was not found.`);
          saved = { ...existing, ...values } as Row;
          set(current.map((r) => (r.id === id ? saved : r)));
          this.log(cfg.type, { summary: `Edited ${cfg.noun} “${cfg.label(saved)}” (draft)` });
        }
        this.touch();
        return clone(saved);
      },
      remove: async (id) => {
        const existing = rows().find((r) => r.id === id);
        if (!existing) throw new RepoError('not_found', `This ${cfg.noun} was not found.`);
        set(rows().filter((r) => r.id !== id));
        this.log(cfg.type, { summary: `Deleted ${cfg.noun} “${cfg.label(existing)}” (draft)` });
        this.touch();
      },
      move: async (id, direction) => {
        const sorted = [...rows()].sort((a, b) => a.sortOrder - b.sortOrder);
        const index = sorted.findIndex((r) => r.id === id);
        const target = direction === 'up' ? index - 1 : index + 1;
        const a = sorted[index];
        const b = sorted[target];
        if (index < 0 || !a) throw new RepoError('not_found', `This ${cfg.noun} was not found.`);
        if (b) {
          [a.sortOrder, b.sortOrder] = [b.sortOrder, a.sortOrder];
          set(sorted);
          this.log(cfg.type, {
            summary: `Moved ${cfg.noun} “${cfg.label(a)}” ${direction} (draft)`,
          });
          this.touch();
        }
        return {
          position: Math.min(Math.max(target, 0), sorted.length - 1) + 1,
          total: sorted.length,
        };
      },
    };
  }

  // ---------- session ----------

  getToday = async () => MOCK_TODAY;
  getNow = async () => this.nowIso();
  getSession = async () => ({ ...MOCK_ACCOUNT });
  /** Test mode: any well-formed input signs in; nothing is checked, stored or sent. */
  signIn = async () => undefined;
  signOut = async () => undefined;
  changePassword = async () => undefined;

  // ---------- website content ----------

  getSettings = () => this.read(() => ({ site: this.state.settings, ops: this.state.ops }));

  saveSettings = async (site: SiteSettingsDraft, ops: OpsSettings) => {
    const before = this.state.settings;
    const changed = (Object.keys(site) as (keyof SiteSettingsDraft)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(site[k]),
    );
    this.state.settings = clone(site);
    if (changed.length > 0) {
      this.log('Settings', { summary: `Site settings changed (draft): ${changed.join(', ')}` });
    }
    const opsChanged =
      ops.renewalWindowDays !== this.state.ops.renewalWindowDays ||
      ops.overdueGraceDays !== this.state.ops.overdueGraceDays;
    if (opsChanged) {
      this.state.ops = { ...ops };
      this.log('Settings', {
        summary: `Subscription rules changed: renewal window ${ops.renewalWindowDays} days, grace ${ops.overdueGraceDays} days (saved immediately)`,
      });
    }
    this.touch();
  };

  listPlans = () =>
    this.read(() =>
      [...this.state.plans]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((plan) => ({
          ...plan,
          monthlyPrice:
            plan.isActive && plan.weeklyPrice !== null
              ? monthlyPriceCheck(plan.weeklyPrice, this.state.pricingRules.monthlySavingPercent)
              : null,
        })),
    );

  savePlans = async (
    values: { id: string; values: PlanValues }[],
    mostPopularId: string | null,
  ) => {
    const names: string[] = [];
    this.state.plans = this.state.plans.map((plan): PlanDraft => {
      const incoming = values.find((v) => v.id === plan.id);
      const next: PlanDraft = incoming ? { ...plan, ...incoming.values } : { ...plan };
      next.isMostPopular = mostPopularId === plan.id;
      if (JSON.stringify(next) !== JSON.stringify(plan)) names.push(next.name);
      return next;
    });
    if (names.length > 0)
      this.log('Plans', { summary: `Plans changed (draft): ${names.join(', ')}` });
    this.touch();
  };

  getPricingRules = () => this.read(() => this.state.pricingRules);

  savePricingRules = async (rules: Omit<PricingRules, 'teamMinPeople'>) => {
    this.state.pricingRules = { ...this.state.pricingRules, ...rules };
    this.log('Pricing rules', { summary: 'Pricing rules changed (draft)' });
    this.touch();
  };

  dishes = this.collection<DishDraft, DishValues>({
    key: 'dishes',
    prefix: 'dish',
    type: 'Dishes',
    noun: 'dish',
    create: (id, sortOrder, v) => ({ id, sortOrder, ...v }),
    label: (r) => r.name,
  });
  addons = this.collection<AddonDraft, AddonValues>({
    key: 'addons',
    prefix: 'addon',
    type: 'Add-ons',
    noun: 'add-on',
    create: (id, sortOrder, v) => ({ id, sortOrder, ...v }),
    label: (r) => r.name,
  });
  faq = this.collection<FaqDraft, FaqValues>({
    key: 'faq',
    prefix: 'faq',
    type: 'FAQ',
    noun: 'question',
    create: (id, sortOrder, v) => ({ id, sortOrder, ...v }),
    label: (r) => r.question,
  });

  private mediaUsage(mediaId: string): string[] {
    const used: string[] = [];
    for (const { slot, label } of PAGE_IMAGE_SLOTS) {
      if (this.state.pageImages[slot] === mediaId) used.push(label);
    }
    for (const dish of this.state.dishes) {
      if (dish.mediaId === mediaId) used.push(`Customize page (${dish.name})`);
    }
    return used;
  }

  listMedia = () =>
    this.read((): MediaRow[] =>
      this.state.media.map((m) => ({ ...m, usedOn: this.mediaUsage(m.id) })),
    );

  uploadMedia = async (file: File, altText: string) => {
    if (altText.trim() === '') throw new RepoError('invalid', 'Alt text is required.');
    const item = {
      id: newId('media'),
      fileName: file.name,
      altText: altText.trim(),
      width: 1600,
      height: 1200,
      bytes: file.size,
    };
    this.state.media.push(item);
    this.log('Images', { summary: `Added image ${file.name}` });
    this.touch();
    return { ...item, usedOn: [] };
  };

  deleteMedia = async (id: string) => {
    const item = this.state.media.find((m) => m.id === id);
    if (!item) throw new RepoError('not_found', 'This image was not found.');
    this.state.media = this.state.media.filter((m) => m.id !== id);
    for (const dish of this.state.dishes) if (dish.mediaId === id) dish.mediaId = null;
    for (const { slot } of PAGE_IMAGE_SLOTS) {
      if (this.state.pageImages[slot] === id) delete this.state.pageImages[slot];
    }
    this.log('Images', { summary: `Deleted image ${item.fileName}` });
    this.touch();
  };

  setPageImage: AdminRepository['setPageImage'] = async (slot, mediaId) => {
    if (mediaId === null) {
      delete this.state.pageImages[slot];
    } else {
      if (!this.state.media.some((m) => m.id === mediaId)) {
        throw new RepoError('not_found', 'This image was not found.');
      }
      this.state.pageImages[slot] = mediaId;
    }
    this.log('Images', {
      summary: `${mediaId === null ? 'Removed the image from' : 'Set the image for'} ${pageImageLabel(slot)}`,
    });
    this.touch();
  };

  // ---------- menu ----------

  listMenuWeeks = () => this.read(() => this.weekViews());

  private weekOrThrow(weekStart: string): MenuWeek {
    const week = this.state.menuWeeks.find((w) => w.weekStart === weekStart);
    if (!week) throw new RepoError('not_found', 'This menu week was not found.');
    return week;
  }

  private viewOf(weekStart: string): MenuWeekView {
    const view = this.weekViews().find((w) => w.weekStart === weekStart);
    if (!view) throw new RepoError('not_found', 'This menu week was not found.');
    return clone(view);
  }

  saveMenuWeek = async (weekStart: string, slots: MenuSlot[]) => {
    if (Object.keys(validateMenuSlots(slots)).length > 0) {
      throw new RepoError('invalid', 'Some menu slots need fixing.');
    }
    const clean = slots.map((s) => ({ ...s, dishText: s.notServed ? '' : s.dishText.trim() }));
    let week = this.state.menuWeeks.find((w) => w.weekStart === weekStart);
    if (!week) {
      week = { id: newId('mw'), weekStart, slots: clean, goLiveAt: null, releasedSlots: null };
      this.state.menuWeeks.push(week);
    } else {
      week.slots = clean;
      // A scheduled week keeps its own copy in step with the working slots (architecture sec. 8.3).
      if (this.viewOf(weekStart).status === 'scheduled') week.releasedSlots = clone(clean);
    }
    this.log('Menu', {
      summary: `Saved menu ${weekLabel(weekStart)} (draft; live site unchanged)`,
    });
    this.touch();
    return this.viewOf(weekStart);
  };

  copyMenuWeek = async (fromWeekStart: string, toWeekStart: string) => {
    const from = this.weekOrThrow(fromWeekStart);
    const copied = clone(from.slots);
    const existing = this.state.menuWeeks.find((w) => w.weekStart === toWeekStart);
    if (existing) existing.slots = copied;
    else {
      this.state.menuWeeks.push({
        id: newId('mw'),
        weekStart: toWeekStart,
        slots: copied,
        goLiveAt: null,
        releasedSlots: null,
      });
    }
    this.log('Menu', {
      summary: `Copied menu ${weekLabel(fromWeekStart)} into ${weekLabel(toWeekStart)} (draft)`,
    });
    this.touch();
    return this.viewOf(toWeekStart);
  };

  scheduleMenuWeek = async (weekStart: string, goLiveAt: string) => {
    const week = this.weekOrThrow(weekStart);
    if (Date.parse(goLiveAt) <= Date.parse(this.nowIso())) {
      throw new RepoError('invalid', 'Choose a time in the future, or use Publish now.');
    }
    week.goLiveAt = goLiveAt;
    week.releasedSlots = clone(week.slots);
    this.log('Menu', { summary: `Scheduled menu ${weekLabel(weekStart)} to go live` });
    this.touch();
    return this.viewOf(weekStart);
  };

  cancelMenuSchedule = async (weekStart: string) => {
    const week = this.weekOrThrow(weekStart);
    week.goLiveAt = null;
    week.releasedSlots = null;
    this.log('Menu', {
      summary: `Cancelled the schedule for menu ${weekLabel(weekStart)} (back to draft)`,
    });
    this.touch();
    return this.viewOf(weekStart);
  };

  publishMenuNow = async (weekStart: string) => {
    const week = this.weekOrThrow(weekStart);
    week.goLiveAt = this.nowIso();
    week.releasedSlots = clone(week.slots);
    this.log('Menu', { summary: `Published menu ${weekLabel(weekStart)} now` });
    this.touch();
    return this.viewOf(weekStart);
  };

  // ---------- publish ----------

  private pending() {
    return describePendingChanges(this.state.published, this.draftSnapshot(), this.weekViews());
  }

  getPublishOverview = () =>
    this.read((): PublishOverview => {
      const pending = this.pending();
      const checks = buildPublishChecks(this.draftSnapshot(), this.state.media);
      const live = this.state.releases[0];
      const weeks = this.weekViews();
      return {
        pending,
        checks,
        canPublish: pending.length > 0 && checks.every((c) => c.ok),
        releases: this.state.releases.map((r, i) => ({
          version: r.version,
          publishedAt: r.publishedAt,
          publishedBy: r.publishedBy,
          note: r.note,
          isLive: i === 0,
        })),
        liveVersion: live?.version ?? 0,
        unscheduledDraftWeeks: weeks.filter((w) => w.status === 'draft').map((w) => w.weekStart),
        scheduledWeeks: weeks
          .filter((w) => w.status === 'scheduled' && w.goLiveAt)
          .map((w) => ({ weekStart: w.weekStart, goLiveAt: w.goLiveAt as string })),
      };
    });

  publish = async (): Promise<PublishResult> => {
    // Short pause so the "Publishing..." state is visible, as it will be with a real refresh of the site.
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (this.flags.failNextPublish) {
      this.flags.failNextPublish = false;
      this.touch();
      throw new RepoError('publish_failed', 'The website could not be refreshed.');
    }
    const checks = buildPublishChecks(this.draftSnapshot(), this.state.media);
    const blocked = checks.find((c) => !c.ok);
    if (blocked) throw new RepoError('blocked', blocked.label);
    const pending = this.pending();
    if (pending.length === 0) throw new RepoError('invalid', 'There are no changes to publish.');

    const version = Math.max(0, ...this.state.releases.map((r) => r.version)) + 1;
    this.state.published = clone(this.draftSnapshot());
    for (const week of this.weekViews()) {
      if (week.status === 'live') {
        const target = this.weekOrThrow(week.weekStart);
        target.releasedSlots = clone(target.slots);
      }
    }
    this.log('Content publish', {
      summary: `Published version v${version} (${pending.length} change${pending.length === 1 ? '' : 's'}).`,
    });
    const publishedAt = this.nowIso();
    this.state.releases.unshift({
      version,
      publishedAt,
      publishedBy: MOCK_ACTOR,
      note: '',
      snapshot: clone(this.state.published),
    });
    this.touch();
    return { version, publishedAt };
  };

  rollback = async (version: number) => {
    const target = this.state.releases.find((r) => r.version === version);
    if (!target) throw new RepoError('not_found', 'This version was not found.');
    this.state.published = clone(target.snapshot);
    // The chosen release becomes the live one (first in the list); drafts are not changed.
    this.state.releases = [target, ...this.state.releases.filter((r) => r.version !== version)];
    this.log('Content publish', {
      summary: `Rolled back the live site to version v${version}. Drafts kept.`,
    });
    this.touch();
  };

  // ---------- history ----------

  listAudit = (filter: AuditFilter) =>
    this.read(() =>
      this.state.audit.filter((e) => {
        if (filter.recordType && e.recordType !== filter.recordType) return false;
        const day = dateKeyOf(e.at);
        if (filter.from && day < filter.from) return false;
        if (filter.to && day > filter.to) return false;
        return true;
      }),
    );

  // ---------- customers ----------

  getOverview = () =>
    this.read((): Overview => {
      const periodRows = this.allPeriodRows();
      const customers = this.state.customers.filter((c) => c.archivedAt === null);
      const rows = customers.map((c) => this.customerRow(c, periodRows));
      const active = rows.filter((r) => r.subscriptionStatuses.includes('active'));
      const sumOf = (status: 'unpaid' | 'overdue') => {
        const list = periodRows.filter((p) => p.status === status);
        return { count: list.length, total: list.reduce((s, p) => s + p.balance, 0) };
      };
      const pending = this.pending();
      const areas = new Map<string, number>();
      pending.forEach((p) => areas.set(p.area, (areas.get(p.area) ?? 0) + 1));
      const weeks = this.weekViews();
      const scheduled = weeks.find((w) => w.status === 'scheduled' && w.goLiveAt);
      const live = weeks.find((w) => w.status === 'live');
      const release = this.state.releases[0];
      return {
        today: MOCK_TODAY,
        activeSubscribers: active.length,
        officeMembers: active
          .filter((r) => r.customer.type === 'office')
          .reduce((s, r) => s + (r.customer.memberCount ?? 0), 0),
        unpaid: sumOf('unpaid'),
        overdue: sumOf('overdue'),
        renewalDue: rows.filter((r) => r.renewalDue).length,
        renewalWindowDays: this.state.ops.renewalWindowDays,
        totalCustomers: customers.length,
        pendingChanges: pending.length,
        scheduledMenu: scheduled?.goLiveAt
          ? { weekStart: scheduled.weekStart, goLiveAt: scheduled.goLiveAt }
          : null,
        liveMenuWeekStart: live?.weekStart ?? null,
        liveVersion: release?.version ?? 0,
        liveVersionPublishedAt: release?.publishedAt ?? '',
        pendingAreas: [...areas].map(([area, n]) => `${area} (${n})`),
      };
    });

  listCustomers = (filter: CustomerFilter) => this.read(() => this.filterCustomers(filter));

  getCustomerDetail = (id: string) =>
    this.read((): CustomerDetail => {
      const customer = this.customerById(id);
      const subscriptions = this.state.subscriptions
        .filter((s) => s.customerId === id)
        .map((s) => this.subscriptionRow(s))
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      const periods = this.allPeriodRows()
        .filter((p) => p.customerId === id)
        .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
      const payments = this.state.payments
        .filter((p) => p.customerId === id)
        .map((p) => this.paymentRow(p))
        .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
      return {
        customer,
        subscriptions,
        periods,
        payments,
        paymentStatus: worstPaymentStatus(periods.map((p) => p.status)),
        balance: periods.reduce((s, p) => s + p.balance, 0),
      };
    });

  createCustomer = async (values: CustomerValues) => {
    const customer: Customer = { id: newId('c'), archivedAt: null, ...values };
    this.state.customers.push(customer);
    this.log('Customer', { summary: `Created ${customer.name} (${customer.type})` });
    this.touch();
    return clone(customer);
  };

  updateCustomer = async (id: string, values: CustomerValues) => {
    const existing = this.customerById(id);
    const changed = (Object.keys(values) as (keyof CustomerValues)[]).filter(
      (k) => existing[k] !== values[k],
    );
    Object.assign(existing, values);
    this.log('Customer', {
      summary: `Edited ${existing.name}: ${changed.length > 0 ? changed.join(', ') : 'no field changed'}`,
    });
    this.touch();
    return clone(existing);
  };

  archiveCustomer = async (id: string) => {
    const customer = this.customerById(id);
    customer.archivedAt = this.nowIso();
    this.log('Customer', { summary: `Archived ${customer.name}` });
    this.touch();
  };

  restoreCustomer = async (id: string) => {
    const customer = this.customerById(id);
    customer.archivedAt = null;
    this.log('Customer', { summary: `Restored ${customer.name}` });
    this.touch();
  };

  findDuplicatePhone = (phone: string, excludeCustomerId?: string) =>
    this.read(() => findDuplicatePhone(this.state.customers, phone, excludeCustomerId));

  // ---------- subscriptions ----------

  getSubscription = (id: string) =>
    this.read(() => {
      const sub = this.state.subscriptions.find((s) => s.id === id);
      if (!sub) throw new RepoError('not_found', 'This subscription was not found.');
      return this.subscriptionRow(sub);
    });

  private applySubscriptionValue(base: Subscription, value: SubscriptionValue): Subscription {
    const plan = this.state.plans.find((p) => p.id === value.planId);
    return {
      ...base,
      planId: value.planId,
      planName: plan?.name ?? base.planName,
      term: value.term,
      startDate: value.startDate,
      endDate: value.endDate,
      breakfastAddon: value.breakfastAddon,
      amountPerPeriod: value.amountPerPeriod,
      amountNote: value.amountNote,
      manualState: value.manualState,
      manualStateOn: value.manualState === base.manualState ? base.manualStateOn : MOCK_TODAY,
      notes: value.notes,
    };
  }

  createSubscription = async (
    customerId: string,
    value: SubscriptionValue,
    renewedFromId?: string,
  ) => {
    const customer = this.customerById(customerId);
    if (customer.archivedAt) {
      throw new RepoError('invalid', 'This customer is archived. Restore the customer first.');
    }
    const blank: Subscription = {
      id: newId('s'),
      customerId,
      planId: value.planId,
      planName: '',
      term: value.term,
      startDate: value.startDate,
      endDate: value.endDate,
      breakfastAddon: false,
      amountPerPeriod: value.amountPerPeriod,
      amountNote: '',
      manualState: 'active',
      manualStateOn: null,
      renewedFromId: renewedFromId ?? null,
      notes: '',
    };
    const sub = this.applySubscriptionValue(blank, value);
    this.state.subscriptions.push(sub);
    this.state.periods.push({
      id: newId('per'),
      subscriptionId: sub.id,
      periodStart: sub.startDate,
      periodEnd: sub.endDate,
      amountDue: sub.amountPerPeriod,
      dueDate: addDays(sub.startDate, -1),
    });
    this.log('Subscription', {
      summary: `Created: ${sub.planName} ${sub.term} ${rangeLabel(sub.startDate, sub.endDate)}, ${formatRs(sub.amountPerPeriod)} (${customer.name})`,
    });
    this.touch();
    return clone(this.subscriptionRow(sub));
  };

  updateSubscription = async (id: string, value: SubscriptionValue) => {
    const index = this.state.subscriptions.findIndex((s) => s.id === id);
    const existing = this.state.subscriptions[index];
    if (index < 0 || !existing)
      throw new RepoError('not_found', 'This subscription was not found.');
    const customer = this.customerById(existing.customerId);
    const next = this.applySubscriptionValue(existing, value);
    this.state.subscriptions[index] = next;
    const period = this.state.periods.find((p) => p.subscriptionId === id);
    if (period) {
      period.periodStart = next.startDate;
      period.periodEnd = next.endDate;
      period.amountDue = next.amountPerPeriod;
      period.dueDate = addDays(next.startDate, -1);
    }
    this.log('Subscription', {
      summary: `Edited ${next.planName} ${next.term} ${rangeLabel(next.startDate, next.endDate)} (${customer.name})`,
      ...(existing.amountPerPeriod !== next.amountPerPeriod
        ? { diff: { from: formatRs(existing.amountPerPeriod), to: formatRs(next.amountPerPeriod) } }
        : {}),
    });
    this.touch();
    return clone(this.subscriptionRow(next));
  };

  findOverlap = (customerId: string, startDate: string, endDate: string, excludeId?: string) =>
    this.read(() => {
      const hit = findOverlappingSubscription(
        this.state.subscriptions,
        customerId,
        startDate,
        endDate,
        excludeId,
      );
      return hit ? this.subscriptionRow(hit) : null;
    });

  // ---------- payments ----------

  listDues = (filter: Pick<PaymentFilter, 'status' | 'from' | 'to'>) =>
    this.read(() =>
      this.allPeriodRows()
        .filter((p) => {
          if (filter.status === undefined) {
            if (p.status === 'paid') return false;
          } else if (filter.status !== 'all' && p.status !== filter.status) return false;
          if (filter.from && p.dueDate < filter.from) return false;
          if (filter.to && p.dueDate > filter.to) return false;
          return true;
        })
        .sort(
          (a, b) =>
            Number(b.status === 'overdue') - Number(a.status === 'overdue') ||
            a.dueDate.localeCompare(b.dueDate),
        ),
    );

  listPayments = (filter: Pick<PaymentFilter, 'method' | 'from' | 'to'>) =>
    this.read(() =>
      this.state.payments
        .filter((p) => {
          if (filter.method && p.method !== filter.method) return false;
          if (filter.from && p.paidOn < filter.from) return false;
          if (filter.to && p.paidOn > filter.to) return false;
          return true;
        })
        .map((p) => this.paymentRow(p))
        .sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
    );

  getPayment = (id: string) =>
    this.read(() => {
      const payment = this.state.payments.find((p) => p.id === id);
      if (!payment) throw new RepoError('not_found', 'This payment was not found.');
      return this.paymentRow(payment);
    });

  createPayment = async (customerId: string, value: PaymentValue) => {
    const customer = this.customerById(customerId);
    if (customer.archivedAt) {
      throw new RepoError('invalid', 'This customer is archived. Restore the customer first.');
    }
    if (
      !this.state.subscriptions.some(
        (s) => s.id === value.subscriptionId && s.customerId === customerId,
      )
    ) {
      throw new RepoError('invalid', 'Choose a subscription of this customer.');
    }
    const payment: Payment = {
      id: newId('p'),
      customerId,
      ...value,
      voidedAt: null,
      voidReason: '',
    };
    this.state.payments.push(payment);
    this.log('Payment', {
      summary: `Recorded ${formatRs(payment.amount)}, ${PAYMENT_METHOD_LABEL[payment.method].toLowerCase()} (${customer.name})`,
    });
    this.touch();
    return clone(this.paymentRow(payment));
  };

  updatePayment = async (id: string, value: PaymentValue) => {
    const existing = this.state.payments.find((p) => p.id === id);
    if (!existing) throw new RepoError('not_found', 'This payment was not found.');
    if (existing.voidedAt) throw new RepoError('invalid', 'A voided payment cannot be edited.');
    const customer = this.customerById(existing.customerId);
    const earlier =
      `Previous values kept: amount ${formatRs(existing.amount)}, method ${PAYMENT_METHOD_LABEL[existing.method]}, ` +
      `ref ${existing.reference === '' ? 'none' : existing.reference}, date ${existing.paidOn}.`;
    const oldAmount = existing.amount;
    Object.assign(existing, value);
    this.log('Payment', {
      summary: `Edited payment of ${customer.name}${oldAmount !== value.amount ? ': amount' : ''}`,
      ...(oldAmount !== value.amount
        ? { diff: { from: formatRs(oldAmount), to: formatRs(value.amount) } }
        : {}),
      earlierValues: earlier,
    });
    this.touch();
    return clone(this.paymentRow(existing));
  };

  voidPayment = async (id: string, reason: string) => {
    const existing = this.state.payments.find((p) => p.id === id);
    if (!existing) throw new RepoError('not_found', 'This payment was not found.');
    if (reason.trim() === '')
      throw new RepoError('invalid', 'A reason is required to void a payment.');
    const customer = this.customerById(existing.customerId);
    existing.voidedAt = this.nowIso();
    existing.voidReason = reason.trim();
    this.log('Payment', {
      summary: `Voided payment of ${formatRs(existing.amount)} (${customer.name}): ${reason.trim()}`,
      earlierValues: `Original values kept: amount ${formatRs(existing.amount)}, ${PAYMENT_METHOD_LABEL[existing.method]}, date ${existing.paidOn}.`,
    });
    this.touch();
    return clone(this.paymentRow(existing));
  };

  findDuplicateReference = (
    method: PaymentValue['method'],
    reference: string,
    excludeId?: string,
  ) =>
    this.read(() => {
      const hit = findDuplicateReference(this.state.payments, method, reference, excludeId);
      return hit ? this.paymentRow(hit) : null;
    });
}
