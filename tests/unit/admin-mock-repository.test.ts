import { beforeEach, describe, expect, it } from 'vitest';
import { RepoError } from '@/admin/repository';
import { MockAdminStore } from '@/admin/mock/store';
import type { SubscriptionValue } from '@/admin/validation/operations';

/**
 * The mock repository stands in for the SQL views at Stage 2. These tests pin the sample data to the
 * numbers in the approved prototype and check that screens' write paths move the numbers correctly.
 */
let store: MockAdminStore;
beforeEach(() => {
  store = new MockAdminStore('sample');
});

const weekly = (planId: string, start: string, end: string, amount: number): SubscriptionValue => ({
  planId,
  term: 'weekly',
  startDate: start,
  endDate: end,
  breakfastAddon: false,
  amountPerPeriod: amount,
  amountNote: '',
  manualState: 'active',
  notes: '',
});

describe('sample overview (matches the prototype dashboard)', () => {
  it('has 4 active subscribers (+22 office members), 2 unpaid, 3 overdue, 3 renewals due', async () => {
    const o = await store.getOverview();
    expect(o.activeSubscribers).toBe(4);
    expect(o.officeMembers).toBe(22);
    expect(o.unpaid).toEqual({ count: 2, total: 12250 });
    expect(o.overdue).toEqual({ count: 3, total: 21240 });
    expect(o.renewalDue).toBe(3);
    expect(o.pendingChanges).toBe(3);
    expect(o.pendingAreas).toEqual(['Menu (1)', 'Plans (1)', 'FAQ (1)']);
  });
  it('overview counts match the filtered lists (FR-30 AC 3)', async () => {
    const o = await store.getOverview();
    expect((await store.listCustomers({ subscription: 'active' })).length).toBe(
      o.activeSubscribers,
    );
    expect((await store.listCustomers({ subscription: 'renewal_due' })).length).toBe(o.renewalDue);
    expect((await store.listDues({ status: 'overdue' })).length).toBe(o.overdue.count);
    expect((await store.listDues({ status: 'unpaid' })).length).toBe(o.unpaid.count);
    const dues = await store.listDues({});
    expect(dues.reduce((s, p) => s + p.balance, 0)).toBe(o.unpaid.total + o.overdue.total);
  });
  it('is zero when there are no customers (FR-30 AC 4)', async () => {
    store.reset('fresh');
    const o = await store.getOverview();
    expect(o.totalCustomers).toBe(0);
    expect([o.activeSubscribers, o.unpaid.count, o.overdue.count, o.renewalDue]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('customers (FR-24, FR-25)', () => {
  it('searches partial name, phone and organisation, case-insensitively', async () => {
    expect((await store.listCustomers({ search: 'sample 0' })).length).toBeGreaterThan(3);
    expect((await store.listCustomers({ search: 'traders' })).map((r) => r.customer.name)).toEqual([
      'Office Sample Traders',
    ]);
    expect(
      (await store.listCustomers({ search: '0300-0000003' })).map((r) => r.customer.name),
    ).toEqual(['Home Sample 03']);
    expect(await store.listCustomers({ search: '0399' })).toEqual([]);
  });
  it('filters by type, subscription status and payment status', async () => {
    expect((await store.listCustomers({ type: 'office' })).length).toBe(2);
    expect((await store.listCustomers({ subscription: 'paused' })).length).toBe(1);
    expect((await store.listCustomers({ payment: 'overdue' })).length).toBe(3);
  });
  it('a new customer appears in the list, and archived ones are hidden by default', async () => {
    const created = await store.createCustomer({
      type: 'home',
      name: 'Home Sample 09',
      phone: '03000000009',
      address: '',
      orgName: '',
      contactPerson: '',
      memberCount: null,
      notes: '',
    });
    expect((await store.listCustomers({ search: 'Home Sample 09' })).length).toBe(1);
    await store.archiveCustomer(created.id);
    expect(await store.listCustomers({ search: 'Home Sample 09' })).toEqual([]);
    expect(
      (await store.listCustomers({ search: 'Home Sample 09', includeArchived: true })).length,
    ).toBe(1);
    await store.restoreCustomer(created.id);
    expect((await store.listCustomers({ search: 'Home Sample 09' })).length).toBe(1);
  });
  it('finds a duplicate phone', async () => {
    expect((await store.findDuplicatePhone('03000000001'))?.name).toBe('Student Sample 01');
    expect(await store.findDuplicatePhone('03999999999')).toBeNull();
  });
});

describe('subscriptions and payments (FR-26, FR-28, FR-29)', () => {
  it('a new subscription is unpaid; recording the full amount makes it paid and updates the totals', async () => {
    const customer = await store.createCustomer({
      type: 'student',
      name: 'Student Sample 09',
      phone: '03000000009',
      address: '',
      orgName: '',
      contactPerson: '',
      memberCount: null,
      notes: '',
    });
    const sub = await store.createSubscription(
      customer.id,
      weekly('plan-student', '2026-11-30', '2026-12-06', 8050),
    );
    expect(sub.status).toBe('upcoming');
    let detail = await store.getCustomerDetail(customer.id);
    expect(detail.periods[0]).toMatchObject({
      amountDue: 8050,
      paid: 0,
      balance: 8050,
      status: 'unpaid',
    });
    const before = await store.getOverview();

    await store.createPayment(customer.id, {
      subscriptionId: sub.id,
      coversFrom: '2026-11-30',
      coversTo: '2026-12-06',
      amount: 8050,
      paidOn: '2026-11-22',
      method: 'jazzcash',
      reference: 'JC-9',
      note: '',
    });
    detail = await store.getCustomerDetail(customer.id);
    expect(detail.periods[0]).toMatchObject({ paid: 8050, balance: 0, status: 'paid' });
    expect(detail.paymentStatus).toBe('paid');
    const after = await store.getOverview();
    expect(after.unpaid.total).toBe(before.unpaid.total - 8050);
    expect(after.unpaid.count).toBe(before.unpaid.count - 1);
  });
  it('a part payment leaves a balance and the status stays unpaid or overdue', async () => {
    const detail = await store.getCustomerDetail(
      (await store.listCustomers({ search: 'Traders' }))[0]!.customer.id,
    );
    expect(detail.periods[0]).toMatchObject({
      amountDue: 12540,
      paid: 6000,
      balance: 6540,
      status: 'overdue',
    });
  });
  it('paying an overdue period in full clears it from the overdue count and total', async () => {
    const before = await store.getOverview();
    const home3 = (await store.listCustomers({ search: 'Home Sample 03' }))[0]!;
    const sub = home3.current!;
    await store.createPayment(home3.customer.id, {
      subscriptionId: sub.id,
      coversFrom: sub.startDate,
      coversTo: sub.endDate,
      amount: 10500,
      paidOn: '2026-11-22',
      method: 'easypaisa',
      reference: '',
      note: '',
    });
    const after = await store.getOverview();
    expect(after.overdue.count).toBe(before.overdue.count - 1);
    expect(after.overdue.total).toBe(before.overdue.total - 10500);
  });
  it('voiding a payment removes it from totals but keeps the row and the history', async () => {
    const [payment] = await store.listPayments({ method: 'easypaisa' });
    const o1 = await store.getOverview();
    await store.voidPayment(payment!.id, 'Entered twice');
    const o2 = await store.getOverview();
    expect(o2.overdue.count).toBe(o1.overdue.count + 1);
    expect(o2.overdue.total).toBe(o1.overdue.total + 30590);
    const detail = await store.getCustomerDetail(payment!.customerId);
    expect(detail.periods[0]?.paid).toBe(0);
    expect(detail.payments[0]?.voidedAt).not.toBeNull();
    const history = await store.listAudit({ recordType: 'Payment' });
    expect(history[0]?.earlierValues).toMatch(/Original values kept/);
  });
  it('editing a payment keeps the previous values in change history (FR-23 AC 2)', async () => {
    const [payment] = await store.listPayments({ method: 'bank_transfer' });
    await store.updatePayment(payment!.id, {
      subscriptionId: payment!.subscriptionId,
      coversFrom: payment!.coversFrom,
      coversTo: payment!.coversTo,
      amount: payment!.amount + 1,
      paidOn: payment!.paidOn,
      method: payment!.method,
      reference: payment!.reference,
      note: '',
    });
    const [latest] = await store.listAudit({ recordType: 'Payment' });
    expect(latest?.earlierValues).toMatch(/Previous values kept/);
    expect(latest?.diff).toBeDefined();
  });
  it('detects overlap and duplicate references', async () => {
    const s1 = (await store.listCustomers({ search: 'Student Sample 01' }))[0]!;
    expect((await store.findOverlap(s1.customer.id, '2026-12-01', '2026-12-10'))?.planName).toBe(
      'Student',
    );
    expect(await store.findOverlap(s1.customer.id, '2026-12-07', '2026-12-10')).toBeNull();
    expect((await store.findDuplicateReference('easypaisa', 'EP-0001'))?.customerName).toBe(
      'Student Sample 01',
    );
    expect(await store.findDuplicateReference('jazzcash', 'EP-0001')).toBeNull();
  });
  it('refuses new records for an archived customer', async () => {
    const c = (await store.listCustomers({ search: 'Student Sample 08' }))[0]!;
    await store.archiveCustomer(c.customer.id);
    await expect(
      store.createSubscription(
        c.customer.id,
        weekly('plan-budget', '2026-11-30', '2026-12-06', 4200),
      ),
    ).rejects.toBeInstanceOf(RepoError);
  });
});

describe('content drafts, menu and publishing (FR-14..16, FR-22)', () => {
  it('shows the sample drafts as pending and blocks publish while settings are empty', async () => {
    const o = await store.getPublishOverview();
    expect(o.pending.length).toBe(3);
    expect(o.canPublish).toBe(false);
    expect(o.checks[0]).toMatchObject({ ok: false });
    await expect(store.publish()).rejects.toMatchObject({ code: 'blocked' });
  });
  it('publishes when ready, bumps the version, and then has no pending changes', async () => {
    store.reset('ready');
    expect((await store.getPublishOverview()).canPublish).toBe(true);
    const result = await store.publish();
    expect(result.version).toBe(13);
    const after = await store.getPublishOverview();
    expect(after.pending).toEqual([]);
    expect(after.liveVersion).toBe(13);
    expect((await store.getOverview()).pendingChanges).toBe(0);
  });
  it('a failed publish leaves the live version and the drafts untouched (FR-22 AC 3)', async () => {
    store.reset('ready');
    store.setFlag('failNextPublish', true);
    await expect(store.publish()).rejects.toMatchObject({ code: 'publish_failed' });
    const o = await store.getPublishOverview();
    expect(o.liveVersion).toBe(12);
    expect(o.pending.length).toBe(3);
    await expect(store.publish()).resolves.toMatchObject({ version: 13 });
  });
  it('editing a dish adds a pending change; rollback keeps drafts', async () => {
    store.reset('no_drafts');
    expect((await store.getPublishOverview()).pending).toEqual([]);
    const [dish] = await store.dishes.list();
    await store.dishes.save(dish!.id, {
      name: dish!.name,
      comesWith: dish!.comesWith,
      price: 999,
      isHidden: false,
      mediaId: null,
    });
    expect((await store.getPublishOverview()).pending[0]?.area).toBe('Dishes');
    await store.rollback(11);
    expect((await store.getPublishOverview()).liveVersion).toBe(11);
  });
  it("editing this week's menu is saved as a draft and shows as an unpublished change", async () => {
    store.reset('no_drafts');
    const [week] = (await store.listMenuWeeks()).filter((w) => w.status === 'live');
    const slots = week!.slots.map((s, i) => (i === 0 ? { ...s, dishText: 'Halwa puri' } : s));
    const saved = await store.saveMenuWeek(week!.weekStart, slots);
    expect(saved.hasUnpublishedEdits).toBe(true);
    expect((await store.getPublishOverview()).pending.map((p) => p.area)).toEqual(['Menu']);
  });
  it('rejects invalid menu slots on the server side too', async () => {
    const [week] = await store.listMenuWeeks();
    const slots = week!.slots.map((s, i) => (i === 0 ? { ...s, dishText: '<b>x</b>' } : s));
    await expect(store.saveMenuWeek(week!.weekStart, slots)).rejects.toMatchObject({
      code: 'invalid',
    });
  });
  it('schedules, cancels and publishes a menu week, with derived statuses', async () => {
    store.reset('fresh');
    const live = (await store.listMenuWeeks()).find((w) => w.status === 'live')!;
    const copy = await store.copyMenuWeek(live.weekStart, '2026-11-30');
    expect(copy.status).toBe('draft');
    expect((await store.scheduleMenuWeek('2026-11-30', '2026-11-29T18:00:00+05:00')).status).toBe(
      'scheduled',
    );
    expect((await store.cancelMenuSchedule('2026-11-30')).status).toBe('draft');
    await expect(
      store.scheduleMenuWeek('2026-11-30', '2026-11-20T18:00:00+05:00'),
    ).rejects.toMatchObject({ code: 'invalid' });
    const now = await store.publishMenuNow('2026-11-30');
    expect(now.status).toBe('live');
    expect((await store.listMenuWeeks()).find((w) => w.weekStart === live.weekStart)?.status).toBe(
      'past',
    );
  });
  it('reorders FAQ entries and reports the new position', async () => {
    const [first, second] = await store.faq.list();
    expect(await store.faq.move(second!.id, 'up')).toEqual({ position: 1, total: 7 });
    expect((await store.faq.list())[0]?.id).toBe(second!.id);
    expect((await store.faq.list())[1]?.id).toBe(first!.id);
  });
  it('warns where an image is used before deleting', async () => {
    const used = (await store.listMedia()).find((m) => m.usedOn.length > 0)!;
    expect(used.usedOn.length).toBeGreaterThan(0);
    await store.deleteMedia(used.id);
    expect((await store.listMedia()).some((m) => m.id === used.id)).toBe(false);
  });
});

describe('simulated failures (mock controls)', () => {
  it('fails every load with a clear error when asked, and recovers', async () => {
    store.setFlag('failLoads', true);
    await expect(store.listCustomers({})).rejects.toMatchObject({ code: 'load_failed' });
    store.setFlag('failLoads', false);
    await expect(store.listCustomers({})).resolves.toHaveLength(8);
  });
});

describe('page images', () => {
  it('assigns and clears the Home page photo, and reports it in "used on"', async () => {
    const store = new MockAdminStore('sample');
    const [first] = await store.listMedia();
    if (!first) throw new Error('seed has no media');
    await store.setPageImage('home_hero', first.id);
    expect((await store.listMedia()).find((m) => m.id === first.id)?.usedOn).toContain(
      'Home page (main photo)',
    );
    await store.setPageImage('home_hero', null);
    expect((await store.listMedia()).find((m) => m.id === first.id)?.usedOn).not.toContain(
      'Home page (main photo)',
    );
    await expect(store.setPageImage('home_hero', 'missing')).rejects.toThrow();
  });
});
