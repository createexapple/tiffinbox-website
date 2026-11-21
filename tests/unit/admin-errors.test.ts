import { describe, expect, it } from 'vitest';
import {
  parseValidationDetails,
  safeTriggerMessage,
  translateDbError,
} from '@/admin/server/errors';

const WRITE = { fallback: 'save_failed' } as const;
const READ = { fallback: 'load_failed' } as const;
const PUBLISH = { fallback: 'publish_failed', validationAs: 'blocked' } as const;

describe('translateDbError (PostgREST error to admin error)', () => {
  it('PT400 becomes "invalid" with field messages from DETAIL', () => {
    const out = translateDbError(
      {
        code: 'PT400',
        message: 'validation_failed',
        details: JSON.stringify([
          { field: 'slots.1/lunch', message: 'Enter a dish.' },
          { field: 'week_start', message: 'A menu week starts on a Monday.' },
        ]),
      },
      WRITE,
    );
    expect(out.code).toBe('invalid');
    expect(out.fields).toEqual({
      'slots.1/lunch': 'Enter a dish.',
      week_start: 'A menu week starts on a Monday.',
    });
    expect(out.message).toBe('Enter a dish. A menu week starts on a Monday.');
  });

  it('PT400 during publish becomes "blocked" (the publish check reasons)', () => {
    const out = translateDbError(
      {
        code: 'PT400',
        details:
          '[{"field":"settings.whatsapp_number","message":"WhatsApp number must be digits only."}]',
      },
      PUBLISH,
    );
    expect(out.code).toBe('blocked');
    expect(out.message).toContain('WhatsApp number');
  });

  it('PT400 with unreadable details still gives a usable message and no fields', () => {
    const out = translateDbError({ code: 'PT400', details: 'not json' }, WRITE);
    expect(out).toEqual({ code: 'invalid', message: 'Some values need fixing.' });
  });

  it('PT403 and RLS errors become "forbidden"', () => {
    expect(translateDbError({ code: 'PT403', message: 'forbidden' }, WRITE).code).toBe('forbidden');
    expect(translateDbError({ code: '42501' }, WRITE).code).toBe('forbidden');
  });

  it('PT404 becomes "not_found"', () => {
    expect(translateDbError({ code: 'PT404' }, READ).code).toBe('not_found');
  });

  it('foreign-key / in-use guard becomes "blocked"; constraint violations become "invalid"', () => {
    expect(translateDbError({ code: '23503' }, WRITE).code).toBe('blocked');
    for (const code of ['23505', '23514', '23502', '22P02']) {
      expect(translateDbError({ code }, WRITE).code).toBe('invalid');
    }
  });

  it('passes the database trigger messages that were written for the admin, and nothing else', () => {
    const archived = translateDbError(
      { code: '23514', message: 'this customer is archived; restore the customer first' },
      WRITE,
    );
    expect(archived).toEqual({
      code: 'invalid',
      message: 'This customer is archived; restore the customer first.',
    });
    expect(
      safeTriggerMessage('duplicate key value violates unique constraint "x" Key (phone)=(+92300)'),
    ).toBeNull();
  });

  it('never echoes a database message or details for unknown errors', () => {
    const secret = 'Key (phone_e164)=(+923001234567) already exists';
    const out = translateDbError({ code: 'XX000', message: secret, details: secret }, WRITE);
    expect(out.code).toBe('save_failed');
    expect(JSON.stringify(out)).not.toContain('923001234567');
    expect(translateDbError({ message: 'TypeError: fetch failed' }, READ).code).toBe('load_failed');
    expect(translateDbError({ code: 'XX000' }, PUBLISH).code).toBe('publish_failed');
  });
});

describe('parseValidationDetails', () => {
  it('keeps the first message per field and ignores malformed items', () => {
    expect(
      parseValidationDetails(
        '[{"field":"a","message":"one"},{"field":"a","message":"two"},{"x":1},null,"s"]',
      ),
    ).toEqual({ a: 'one' });
    expect(parseValidationDetails(null)).toEqual({});
    expect(parseValidationDetails('{"field":"a"}')).toEqual({});
  });
});
