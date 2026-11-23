/**
 * "Unpublished changes" for A-02 and A-10 (FR-22): compares the draft working copy with what is live.
 * Stage 2 stand-in: at Stage 3 the database assembles the payload from the draft tables and compares
 * its checksum with the current release (architecture sec. 8.1); the summaries then come from there.
 */
import { formatRs } from '@/lib/format';
import { weekLabel, MEAL_LABEL } from '../format';
import { slotsEqual } from './status-rules';
import type {
  ContentArea,
  ContentSnapshot,
  MenuWeekView,
  PendingChange,
  PublishCheckItem,
} from '../types';
import { MEALS } from '../validation/content';

type Href = PendingChange['previewHref'];

interface FieldSpec<T> {
  label: string;
  get: (row: T) => string;
}

const orNotSet = (v: string) => (v === '' ? 'not set' : v);

function listChanges<T extends { id: string; sortOrder: number }>(
  area: ContentArea,
  href: Href,
  noun: string,
  published: readonly T[],
  draft: readonly T[],
  name: (row: T) => string,
  fields: readonly FieldSpec<T>[],
): PendingChange[] {
  const changes: PendingChange[] = [];
  const pubById = new Map(published.map((r) => [r.id, r]));
  const draftIds = new Set(draft.map((r) => r.id));
  for (const row of draft) {
    const before = pubById.get(row.id);
    if (!before) {
      changes.push({ area, summary: `Added ${noun} “${name(row)}”`, previewHref: href });
      continue;
    }
    const parts = fields
      .filter((f) => f.get(before) !== f.get(row))
      .map((f) => `${f.label} ${orNotSet(f.get(before))} → ${orNotSet(f.get(row))}`);
    if (parts.length > 0) {
      changes.push({ area, summary: `${name(row)}: ${parts.join('; ')}`, previewHref: href });
    }
  }
  for (const row of published) {
    if (!draftIds.has(row.id)) {
      changes.push({ area, summary: `Removed ${noun} “${name(row)}”`, previewHref: href });
    }
  }
  const common = (rows: readonly T[], other: ReadonlySet<string>) =>
    [...rows]
      .filter((r) => other.has(r.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.id);
  const pubOrder = common(published, draftIds);
  const draftOrder = common(draft, new Set(published.map((r) => r.id)));
  if (pubOrder.join() !== draftOrder.join()) {
    changes.push({ area, summary: `Display order of ${noun}s changed`, previewHref: href });
  }
  return changes;
}

export function describePendingChanges(
  published: ContentSnapshot,
  draft: ContentSnapshot,
  menuWeeks: readonly MenuWeekView[],
): PendingChange[] {
  const out: PendingChange[] = [];

  // Menu: only edits to the live week need publishing. A scheduled week already stores its own copy.
  for (const week of menuWeeks) {
    if (
      week.status === 'live' &&
      week.releasedSlots &&
      !slotsEqual(week.slots, week.releasedSlots)
    ) {
      const edited = week.slots.filter((s, i) => {
        const before = week.releasedSlots?.[i];
        return (
          !before ||
          before.dishText.trim() !== s.dishText.trim() ||
          before.notServed !== s.notServed
        );
      }).length;
      out.push({
        area: 'Menu',
        summary: `This week ${weekLabel(week.weekStart)}: ${edited} slot${edited === 1 ? '' : 's'} edited`,
        previewHref: '/menu',
      });
    }
  }

  out.push(
    ...listChanges('Plans', '/plans', 'plan', published.plans, draft.plans, (p) => p.name, [
      { label: 'name', get: (p) => p.name },
      { label: 'for', get: (p) => p.audience },
      { label: 'meals', get: (p) => p.mealsIncluded },
      {
        label: 'price per meal/day',
        get: (p) => (p.unitPrice === null ? '' : formatRs(p.unitPrice)),
      },
      {
        label: 'weekly price',
        get: (p) => (p.weeklyPrice === null ? '' : formatRs(p.weeklyPrice)),
      },
      { label: 'most popular', get: (p) => (p.isMostPopular ? 'yes' : 'no') },
      { label: 'shown on website', get: (p) => (p.isActive ? 'yes' : 'no') },
    ]),
  );

  const rules: [string, (r: ContentSnapshot['pricingRules']) => string][] = [
    ['Monthly saving %', (r) => String(r.monthlySavingPercent)],
    ['Breakfast add-on price', (r) => formatRs(r.breakfastAddonPrice)],
    ['Team deal text', (r) => r.teamDealText],
  ];
  for (const [label, get] of rules) {
    if (get(published.pricingRules) !== get(draft.pricingRules)) {
      out.push({
        area: 'Pricing rules',
        summary: `${label}: ${orNotSet(get(published.pricingRules))} → ${orNotSet(get(draft.pricingRules))}`,
        previewHref: '/plans',
      });
    }
  }

  out.push(
    ...listChanges('Dishes', '/customize', 'dish', published.dishes, draft.dishes, (d) => d.name, [
      { label: 'name', get: (d) => d.name },
      { label: 'comes with', get: (d) => d.comesWith },
      { label: 'price', get: (d) => formatRs(d.price) },
      { label: 'photo', get: (d) => d.mediaId ?? '' },
      { label: 'shown', get: (d) => (d.isHidden ? 'no' : 'yes') },
    ]),
    ...listChanges(
      'Add-ons',
      '/customize',
      'add-on',
      published.addons,
      draft.addons,
      (a) => a.name,
      [
        { label: 'name', get: (a) => a.name },
        { label: 'price', get: (a) => formatRs(a.price) },
        { label: 'shown', get: (a) => (a.isHidden ? 'no' : 'yes') },
      ],
    ),
    ...listChanges('FAQ', '/about', 'question', published.faq, draft.faq, (f) => f.question, [
      { label: 'question', get: (f) => f.question },
      { label: 'answer edited', get: (f) => f.answer },
      { label: 'shown', get: (f) => (f.isHidden ? 'no' : 'yes') },
    ]),
  );

  const settingFields: [string, (s: ContentSnapshot['settings']) => string][] = [
    ['Business name', (s) => s.businessName],
    ['Tagline', (s) => s.tagline],
    ['Area served', (s) => s.areaServed],
    ['Delivery boundary text', (s) => s.deliveryBoundaryText],
    ['Legal name and address', (s) => s.legalNameAndAddress],
    ['Payment methods', (s) => s.paymentMethods.join(', ')],
    ['WhatsApp number', (s) => s.whatsappNumber],
    ['Instagram handle', (s) => s.instagramHandle],
    ['Order hours', (s) => s.orderHours],
    ['Last time to order', (s) => s.lastOrderTime],
    ['Delivery area text', (s) => s.deliveryAreaText],
    ['Skips per week', (s) => String(s.skipsPerWeek)],
    ...MEALS.map((m): [string, (s: ContentSnapshot['settings']) => string] => [
      `${MEAL_LABEL[m]} delivery time`,
      (s) => s.deliveryTimes[m],
    ]),
    ...MEALS.map((m): [string, (s: ContentSnapshot['settings']) => string] => [
      `${MEAL_LABEL[m]} skip cut-off`,
      (s) => s.skipCutoffs[m],
    ]),
  ];
  for (const [label, get] of settingFields) {
    if (get(published.settings) !== get(draft.settings)) {
      out.push({
        area: 'Settings',
        summary: `${label}: ${orNotSet(get(published.settings))} → ${orNotSet(get(draft.settings))}`,
        previewHref: '/',
      });
    }
  }
  return out;
}

/** Publish check (FR-10, FR-22): placeholders and missing prices cannot go live. */
export function buildPublishChecks(
  draft: ContentSnapshot,
  media: readonly { altText: string }[],
): PublishCheckItem[] {
  const s = draft.settings;
  const missing: string[] = [];
  if (s.whatsappNumber === '') missing.push('WhatsApp number');
  if (s.instagramHandle === '') missing.push('Instagram handle');
  if (s.orderHours === '') missing.push('order hours');
  const unpriced = draft.plans.filter(
    (p) => p.isActive && (!p.unitPrice || !p.weeklyPrice || p.unitPrice <= 0 || p.weeklyPrice <= 0),
  );
  return [
    missing.length === 0
      ? { ok: true, label: 'WhatsApp number, Instagram and order hours are set' }
      : {
          ok: false,
          label: `Blocked: ${missing.join(', ')} not set`,
          fix: 'Add it in Site settings (placeholder text cannot go live).',
          fixHref: '/admin/settings',
          fixLabel: 'Go to Settings',
        },
    unpriced.length === 0
      ? { ok: true, label: 'Every active plan has a price' }
      : {
          ok: false,
          label: `Blocked: ${unpriced.map((p) => p.name).join(', ')} has no price`,
          fix: 'Enter the price in Plans & prices, or switch the plan off.',
          fixHref: '/admin/plans',
          fixLabel: 'Go to Plans & prices',
        },
    media.every((m) => m.altText.trim() !== '')
      ? { ok: true, label: 'Every image has alt text' }
      : {
          ok: false,
          label: 'Blocked: an image has no alt text',
          fix: 'Add alt text in Images.',
          fixHref: '/admin/media',
          fixLabel: 'Go to Images',
        },
  ];
}
