import { describe, expect, it } from 'vitest';
import { mapAuditEntry, type AuditDb, type AuditNames } from '@/admin/server/audit';

function row(over: Partial<AuditDb>): AuditDb {
  return {
    id: 1,
    at: '2026-11-22T13:00:00+00:00',
    actor_label: 'Staff Sample',
    action: 'update',
    table_name: 'plans',
    record_id: 'p1',
    subject_customer_id: null,
    old_values: null,
    new_values: null,
    record_type: 'Plans',
    ...over,
  };
}
const names: AuditNames = {
  plans: new Map([['p1', 'Budget']]),
  dishes: new Map(),
  addons: new Map(),
  faq: new Map(),
  customers: new Map([['c1', 'Student Sample 01']]),
};

describe('change history wording (FR-23)', () => {
  it('publish and rollback', () => {
    const publish = mapAuditEntry(
      row({
        action: 'publish',
        table_name: 'content_releases',
        record_type: 'Content publish',
        new_values: { version: 4, note: '', changed_areas: ['Plans', 'Settings'] },
      }),
    );
    expect(publish?.summary).toBe('Published version v4 (Plans, Settings).');
    const rollback = mapAuditEntry(
      row({
        action: 'rollback',
        table_name: 'content_releases',
        record_type: 'Content publish',
        new_values: { version: 2 },
      }),
    );
    expect(rollback?.summary).toBe('Rolled back the live site to version v2. Drafts kept.');
  });

  it('a one-field draft edit shows a before/after pair with money formatted, using the current name', () => {
    const entry = mapAuditEntry(
      row({ old_values: { weekly_price: 4200 }, new_values: { weekly_price: 4500 } }),
      names,
    );
    expect(entry?.summary).toBe('Edited plan “Budget”: weekly price (draft)');
    expect(entry?.diff).toEqual({ from: 'Rs 4,200', to: 'Rs 4,500' });
    expect(entry?.actor).toBe('Staff Sample');
    expect(entry?.recordType).toBe('Plans');
  });

  it('a multi-field edit lists the fields; added and deleted rows say so', () => {
    const edit = mapAuditEntry(
      row({ old_values: { name: 'A', audience: 'x' }, new_values: { name: 'B', audience: 'y' } }),
    );
    expect(edit?.summary).toBe('Edited plan “B”: name, for (draft)');
    expect(
      mapAuditEntry(row({ action: 'insert', new_values: { name: 'New plan' } }))?.summary,
    ).toBe('Added plan “New plan” (draft)');
    expect(mapAuditEntry(row({ action: 'delete', old_values: { name: 'Gone' } }))?.summary).toBe(
      'Deleted plan “Gone” (draft)',
    );
  });

  it('menu actions use the week label', () => {
    const base = { table_name: 'menu_weeks', record_type: 'Menu', record_id: '2026-11-23' };
    expect(
      mapAuditEntry(
        row({ ...base, action: 'menu_saved', new_values: { week_start: '2026-11-23' } }),
      )?.summary,
    ).toBe('Saved menu 23–29 Nov (draft; live site unchanged)'.replace('–', ' – '));
    expect(
      mapAuditEntry(row({ ...base, action: 'menu_released', new_values: { mode: 'schedule' } }))
        ?.summary,
    ).toContain('Scheduled menu');
    expect(
      mapAuditEntry(
        row({ ...base, action: 'menu_released', new_values: { mode: 'cancel_schedule' } }),
      )?.summary,
    ).toContain('Cancelled the schedule');
    expect(
      mapAuditEntry(row({ ...base, action: 'menu_released', new_values: { mode: 'publish_now' } }))
        ?.summary,
    ).toContain('now');
  });

  it('payments: record, edit keeps earlier values, void shows the reason and original values', () => {
    const base = { table_name: 'payments', record_type: 'Payment', subject_customer_id: 'c1' };
    const full = {
      amount: 4200,
      method: 'easypaisa',
      reference: 'EP1',
      paid_on: '2026-11-20',
      voided_at: null,
      void_reason: '',
    };
    expect(
      mapAuditEntry(row({ ...base, action: 'insert', new_values: full }), names)?.summary,
    ).toBe('Recorded Rs 4,200, easypaisa (Student Sample 01)');
    const edited = mapAuditEntry(
      row({ ...base, action: 'update', old_values: full, new_values: { ...full, amount: 4000 } }),
      names,
    );
    expect(edited?.summary).toBe('Edited payment of Student Sample 01: amount');
    expect(edited?.diff).toEqual({ from: 'Rs 4,200', to: 'Rs 4,000' });
    expect(edited?.earlierValues).toContain('Previous values kept: amount Rs 4,200');
    const voided = mapAuditEntry(
      row({
        ...base,
        action: 'update',
        old_values: full,
        new_values: {
          ...full,
          voided_at: '2026-11-22T10:00:00+00:00',
          void_reason: 'Wrong amount',
        },
      }),
      names,
    );
    expect(voided?.summary).toBe('Voided payment of Rs 4,200 (Student Sample 01): Wrong amount');
    expect(voided?.earlierValues).toContain('Original values kept');
  });

  it('customers: create, archive, restore, anonymise', () => {
    const base = { table_name: 'customers', record_type: 'Customer', subject_customer_id: 'c1' };
    expect(
      mapAuditEntry(
        row({ ...base, action: 'insert', new_values: { name: 'N', type: 'student' } }),
        names,
      )?.summary,
    ).toBe('Created Student Sample 01 (student)');
    expect(
      mapAuditEntry(
        row({
          ...base,
          action: 'update',
          old_values: { archived_at: null },
          new_values: { archived_at: 'x' },
        }),
        names,
      )?.summary,
    ).toBe('Archived Student Sample 01');
    expect(
      mapAuditEntry(
        row({
          ...base,
          action: 'update',
          old_values: { archived_at: 'x' },
          new_values: { archived_at: null },
        }),
        names,
      )?.summary,
    ).toBe('Restored Student Sample 01');
    expect(mapAuditEntry(row({ ...base, action: 'anonymise', new_values: {} }))?.summary).toContain(
      'Anonymised',
    );
  });

  it('does not list tables the screen does not know (billing periods, admin accounts)', () => {
    expect(
      mapAuditEntry(row({ table_name: 'subscription_periods', record_type: 'Subscription' })),
    ).toBeNull();
    expect(
      mapAuditEntry(row({ table_name: 'admin_users', record_type: 'admin_users' })),
    ).toBeNull();
  });
});
