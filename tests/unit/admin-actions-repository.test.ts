import { describe, expect, it, vi } from 'vitest';

// The repository imports server actions; they are not called here, only the result handling is tested.
vi.mock('@/admin/server/auth', () => ({}));
vi.mock('@/admin/server/content', () => ({}));
vi.mock('@/admin/server/customers', () => ({}));
vi.mock('@/admin/server/media', () => ({}));
vi.mock('@/admin/server/menu', () => ({}));
vi.mock('@/admin/server/overview', () => ({}));
vi.mock('@/admin/server/payments', () => ({}));
vi.mock('@/admin/server/publishing', () => ({}));
vi.mock('@/admin/server/subscriptions', () => ({}));

import { unwrapResult } from '@/admin/actions-repository';
import { RepoError } from '@/admin/repository';
import { failure, success } from '@/admin/server/result';

describe('unwrapResult (server action result to RepoError)', () => {
  it('returns the data of a successful result', async () => {
    await expect(unwrapResult(Promise.resolve(success({ a: 1 })))).resolves.toEqual({ a: 1 });
  });

  it('turns failures into RepoError with code, message and fields', async () => {
    const result = failure('invalid', 'Fix it.', { name: 'Too long.' });
    const error = await unwrapResult(Promise.resolve(result)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RepoError);
    expect(error).toMatchObject({
      code: 'invalid',
      message: 'Fix it.',
      fields: { name: 'Too long.' },
    });
  });

  it('sends the browser to the login page when the session is gone', async () => {
    const onSignedOut = vi.fn();
    const error = await unwrapResult(
      Promise.resolve(failure('unauthenticated', 'You were logged out.')),
      onSignedOut,
    ).catch((e: unknown) => e);
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(error).toMatchObject({ code: 'unauthenticated' });
  });

  it('reports a transport failure as "could not be reached", not a crash', async () => {
    const error = await unwrapResult(Promise.reject(new Error('Failed to fetch'))).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ code: 'load_failed' });
    expect((error as Error).message).toContain('could not be reached');
    expect((error as Error).message).not.toContain('Failed to fetch');
  });
});
