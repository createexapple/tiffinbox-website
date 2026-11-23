import { describe, expect, it } from 'vitest';
import { buildPublishChecks, describePending } from '@/admin/server/pending';
import { publicContentDocument } from './fixtures/public-content';

type Doc = Record<string, unknown>;
const released = (): Doc => publicContentDocument();
const clone = (d: Doc): Doc => JSON.parse(JSON.stringify(d)) as Doc;

describe('describePending (unpublished changes, FR-22)', () => {
  it('reports nothing when the draft equals the live release', () => {
    expect(
      describePending({
        released: released(),
        draft: released(),
        changedAreas: [],
        liveWeekEdits: null,
      }),
    ).toEqual([]);
  });

  it('words plan, pricing rule, dish, settings and image changes with a preview page each', () => {
    const draft = clone(released());
    (draft.plans as Doc[])[0]!.weekly_price = 4500;
    (draft.pricing_rules as Doc).monthly_saving_percent = 7;
    (draft.dishes as Doc[])[0]!.price = 600;
    (draft.settings as Doc).order_hours = '10 AM to 10 PM';
    (draft.settings as { delivery_times: Doc }).delivery_times.lunch = '13:30';
    draft.page_images = { home_hero: { path: 'x.jpg', alt: 'a', width: 1, height: 1 } };
    const out = describePending({
      released: released(),
      draft,
      changedAreas: ['Settings', 'Pricing rules', 'Plans', 'Dishes', 'Images'],
      liveWeekEdits: null,
    });
    const text = out.map((c) => `${c.area}: ${c.summary}`);
    expect(text).toContain('Plans: Budget: weekly price Rs 4,200 → Rs 4,500');
    expect(text).toContain('Pricing rules: monthly saving %: 5 → 7');
    expect(text).toContain('Dishes: Daal chawal: price Rs 550 → Rs 600');
    expect(text).toContain('Settings: Order hours: 9 AM to 9 PM → 10 AM to 10 PM');
    expect(text).toContain('Settings: Lunch delivery time: 13:00 → 13:30');
    expect(text).toContain('Images: Page images changed');
    expect(out.find((c) => c.area === 'Plans')?.previewHref).toBe('/plans');
    expect(out.find((c) => c.area === 'Dishes')?.previewHref).toBe('/customize');
  });

  it('words added, removed and re-ordered rows', () => {
    const draft = clone(released());
    (draft.addons as Doc[]).push({ id: 'a2', name: 'Salad', price: 80 });
    (draft.faq as Doc[]) = [];
    const out = describePending({
      released: released(),
      draft,
      changedAreas: ['Add-ons', 'FAQ'],
      liveWeekEdits: null,
    });
    expect(out.map((c) => c.summary)).toEqual([
      'Added add-on “Salad”',
      'Removed question “Where do you deliver?”',
    ]);
    const reordered = clone(released());
    (reordered.plans as Doc[]).reverse();
    const order = describePending({
      released: released(),
      draft: reordered,
      changedAreas: ['Plans'],
      liveWeekEdits: null,
    });
    expect(order.map((c) => c.summary)).toContain('Display order of plans changed');
  });

  it('includes unreleased edits to the live menu week', () => {
    const out = describePending({
      released: released(),
      draft: released(),
      changedAreas: [],
      liveWeekEdits: { weekStart: '2026-11-23', editedSlots: 2 },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ area: 'Menu', previewHref: '/menu' });
    expect(out[0]?.summary).toContain('2 slots edited');
  });

  it('never disagrees with the database: an area it reports as changed always appears', () => {
    const out = describePending({
      released: released(),
      draft: released(),
      changedAreas: ['Add-ons'],
      liveWeekEdits: null,
    });
    expect(out).toEqual([
      { area: 'Add-ons', summary: 'Add-ons changed', previewHref: '/customize' },
    ]);
  });

  it('copes with no release yet (first publish)', () => {
    const out = describePending({
      released: null,
      draft: released(),
      changedAreas: ['Plans'],
      liveWeekEdits: null,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.summary !== '')).toBe(true);
  });
});

describe('buildPublishChecks (database publish_errors to the check list)', () => {
  it('lists passing checks when the database found nothing', () => {
    const checks = buildPublishChecks([]);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.map((c) => c.label)).toContain('Every active plan has a price');
  });

  it('turns database errors into blocking items with a place to fix them', () => {
    const checks = buildPublishChecks([
      { field: 'settings.whatsapp_number', message: 'WhatsApp number must be digits only.' },
      {
        field: 'plans.abc',
        message: 'Student: set a price per meal or day and a weekly price before publishing.',
      },
      { field: 'other', message: 'Something else.' },
    ]);
    const blocked = checks.filter((c) => !c.ok);
    expect(blocked).toHaveLength(3);
    expect(blocked[0]).toMatchObject({ fixHref: '/admin/settings' });
    expect(blocked[1]).toMatchObject({ fixHref: '/admin/plans' });
    expect(blocked[1]?.label).toContain('Student');
    expect(blocked[2]?.label).toContain('Something else.');
  });
});
