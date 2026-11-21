/**
 * "Unpublished changes" for the dashboard pill and the Preview & publish screen (FR-22). The database decides
 * WHETHER anything differs (checksum of the draft document against the live release, `draft_status()`); this
 * module words WHAT differs by comparing the two documents. Any area the database says changed but that has no
 * wording here still appears as a generic line, so the count can never disagree with the database.
 * Pure, unit-tested (tests/unit/admin-pending.test.ts).
 */
import { weekLabel } from '../format';
import type { ContentArea, PendingChange, PublishCheckItem } from '../types';
import { fieldLabel, valueText } from './audit';

type Json = Record<string, unknown>;
type Href = PendingChange['previewHref'];

const AREA_HREF: Record<ContentArea, Href> = {
  Menu: '/menu',
  Plans: '/plans',
  'Pricing rules': '/plans',
  Dishes: '/customize',
  'Add-ons': '/customize',
  FAQ: '/about',
  Settings: '/',
  Images: '/',
};

const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const orNotSet = (v: string) => (v === '' ? 'not set' : v);
const rec = (v: unknown): Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : {};
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.map(rec) : []);

function listChanges(
  area: ContentArea,
  noun: string,
  before: Json[],
  after: Json[],
  nameKey: string,
  fields: readonly string[],
): PendingChange[] {
  const href = AREA_HREF[area];
  const out: PendingChange[] = [];
  const beforeById = new Map(before.map((r) => [String(r.id), r]));
  const afterIds = new Set(after.map((r) => String(r.id)));
  for (const row of after) {
    const old = beforeById.get(String(row.id));
    const name = String(row[nameKey] ?? '');
    if (!old) {
      out.push({ area, summary: `Added ${noun} “${name}”`, previewHref: href });
      continue;
    }
    const parts = fields
      .filter((f) => !same(old[f], row[f]))
      .map(
        (f) =>
          `${fieldLabel(f)} ${orNotSet(valueText(f, old[f]))} → ${orNotSet(valueText(f, row[f]))}`,
      );
    if (parts.length > 0)
      out.push({ area, summary: `${name}: ${parts.join('; ')}`, previewHref: href });
  }
  for (const row of before) {
    if (!afterIds.has(String(row.id))) {
      out.push({
        area,
        summary: `Removed ${noun} “${String(row[nameKey] ?? '')}”`,
        previewHref: href,
      });
    }
  }
  const order = (rows: Json[], other: Set<string>) =>
    rows
      .map((r) => String(r.id))
      .filter((id) => other.has(id))
      .join();
  if (order(before, afterIds) !== order(after, new Set(before.map((r) => String(r.id))))) {
    out.push({ area, summary: `Display order of ${noun}s changed`, previewHref: href });
  }
  return out;
}

export interface PendingInput {
  /** The live release document (`get_public_content()`), or null before the first publish. */
  released: Json | null;
  /** The draft document (`get_draft_content()`). */
  draft: Json;
  /** `draft_status().changed_areas`: the database's own list of differing areas. */
  changedAreas: readonly string[];
  /** Edits to the live menu week that are not released yet (the live week is edited as a draft, FR-14). */
  liveWeekEdits: { weekStart: string; editedSlots: number } | null;
}

export function describePending(input: PendingInput): PendingChange[] {
  const rel = input.released ?? {};
  const dr = input.draft;
  const out: PendingChange[] = [];

  if (input.liveWeekEdits) {
    const { weekStart, editedSlots } = input.liveWeekEdits;
    out.push({
      area: 'Menu',
      summary: `This week ${weekLabel(weekStart)}: ${editedSlots} slot${editedSlots === 1 ? '' : 's'} edited`,
      previewHref: AREA_HREF.Menu,
    });
  }

  out.push(
    ...listChanges('Plans', 'plan', list(rel.plans), list(dr.plans), 'name', [
      'name',
      'audience',
      'meals_included',
      'unit_price',
      'weekly_price',
      'is_most_popular',
    ]),
  );

  const oldRules = rec(rel.pricing_rules);
  const newRules = rec(dr.pricing_rules);
  for (const key of ['monthly_saving_percent', 'breakfast_addon_price', 'team_deal_text']) {
    if (!same(oldRules[key], newRules[key])) {
      out.push({
        area: 'Pricing rules',
        summary: `${fieldLabel(key)}: ${orNotSet(valueText(key, oldRules[key]))} → ${orNotSet(valueText(key, newRules[key]))}`,
        previewHref: AREA_HREF['Pricing rules'],
      });
    }
  }

  out.push(
    ...listChanges('Dishes', 'dish', list(rel.dishes), list(dr.dishes), 'name', [
      'name',
      'comes_with',
      'price',
      'image',
    ]),
    ...listChanges('Add-ons', 'add-on', list(rel.addons), list(dr.addons), 'name', [
      'name',
      'price',
    ]),
    ...listChanges('FAQ', 'question', list(rel.faq), list(dr.faq), 'question', [
      'question',
      'answer',
    ]),
  );

  const oldSettings = rec(rel.settings);
  const newSettings = rec(dr.settings);
  const settingsKeys = new Set([...Object.keys(oldSettings), ...Object.keys(newSettings)]);
  for (const key of settingsKeys) {
    if (same(oldSettings[key], newSettings[key])) continue;
    if (key === 'delivery_times' || key === 'skip_cutoffs') {
      const noun = key === 'delivery_times' ? 'delivery time' : 'skip cut-off';
      const before = rec(oldSettings[key]);
      const after = rec(newSettings[key]);
      for (const meal of MEALS) {
        if (before[meal] !== after[meal]) {
          out.push({
            area: 'Settings',
            summary: `${meal.charAt(0).toUpperCase()}${meal.slice(1)} ${noun}: ${orNotSet(String(before[meal] ?? ''))} → ${orNotSet(String(after[meal] ?? ''))}`,
            previewHref: AREA_HREF.Settings,
          });
        }
      }
      continue;
    }
    out.push({
      area: 'Settings',
      summary: `${fieldLabel(key)[0]?.toUpperCase() ?? ''}${fieldLabel(key).slice(1)}: ${orNotSet(valueText(key, oldSettings[key]))} → ${orNotSet(valueText(key, newSettings[key]))}`,
      previewHref: AREA_HREF.Settings,
    });
  }

  if (!same(rel.page_images, dr.page_images)) {
    out.push({ area: 'Images', summary: 'Page images changed', previewHref: AREA_HREF.Images });
  }

  // Safety net: any area the database reports as changed must show up.
  const covered = new Set(out.map((c) => c.area));
  for (const name of input.changedAreas) {
    if (name in AREA_HREF && !covered.has(name as ContentArea)) {
      out.push({
        area: name as ContentArea,
        summary: `${name} changed`,
        previewHref: AREA_HREF[name as ContentArea],
      });
    }
  }
  return out;
}

// ---------- Publish check ----------

export interface PublishErrorDb {
  field: string;
  message: string;
}

const SETTINGS_GROUP = (f: string) => f.startsWith('settings.');
const PLANS_GROUP = (f: string) => f === 'plans' || f.startsWith('plans.');

/**
 * The publish check list (FR-10, FR-22) from the database's own `publish_errors`. Passing items are listed too so
 * the admin sees what was checked. Wording of failures comes from the database; links say where to fix.
 */
export function buildPublishChecks(errors: readonly PublishErrorDb[]): PublishCheckItem[] {
  const settings = errors.filter((e) => SETTINGS_GROUP(e.field));
  const plans = errors.filter((e) => PLANS_GROUP(e.field));
  const other = errors.filter((e) => !SETTINGS_GROUP(e.field) && !PLANS_GROUP(e.field));
  const items: PublishCheckItem[] = [];

  if (settings.length === 0) {
    items.push({
      ok: true,
      label:
        'WhatsApp number, business name, Instagram, order hours, delivery area and times are set',
    });
  } else {
    for (const e of settings) {
      items.push({
        ok: false,
        label: `Blocked: ${e.message}`,
        fix: 'Fix it in Site settings (placeholder text cannot go live).',
        fixHref: '/admin/settings',
        fixLabel: 'Go to Settings',
      });
    }
  }

  if (plans.length === 0) {
    items.push({ ok: true, label: 'Every active plan has a price' });
  } else {
    for (const e of plans) {
      items.push({
        ok: false,
        label: `Blocked: ${e.message}`,
        fix: 'Enter the price in Plans & prices, or switch the plan off.',
        fixHref: '/admin/plans',
        fixLabel: 'Go to Plans & prices',
      });
    }
  }

  for (const e of other) items.push({ ok: false, label: `Blocked: ${e.message}` });
  return items;
}
