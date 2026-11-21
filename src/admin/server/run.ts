/**
 * Shared plumbing for the server actions (not itself a server action file). `runAction` is the single wrapper that
 *   1. calls `requireAdmin()` first (layer 2 of architecture sec. 7: every action checks the session itself),
 *   2. runs the action body with the signed-in admin's own database client (RLS applies to everything it does),
 *   3. converts every outcome into a serialisable `ActionResult` (no throwing to the browser), and
 *   4. logs failures as structured JSON with the action name and a code only: no personal data, no tokens,
 *      no database messages (they can contain row values).
 */
import 'server-only';
import { AuthRequiredError, requireAdmin, type AdminContext } from '@/lib/auth/session';
import { translateDbError, type DbErrorLike, type TranslateOptions } from './errors';
import { failure, success, type ActionFailure, type ActionResult } from './result';
import type { RepoErrorCode } from '../repository';

export type FailureMode = TranslateOptions['fallback'];

/** Thrown inside an action body to stop with a specific, admin-safe failure. */
export class ActionError extends Error {
  readonly failure: ActionFailure;
  constructor(failureValue: ActionFailure) {
    super(failureValue.message);
    this.name = 'ActionError';
    this.failure = failureValue;
  }
}

export function stop(code: RepoErrorCode, message: string, fields?: Record<string, string>): never {
  throw new ActionError(fields ? { code, message, fields } : { code, message });
}

/** Throws an `ActionError` for a Supabase error; does nothing when there is none. */
export function check(error: DbErrorLike | null | undefined, options: TranslateOptions): void {
  if (error) throw new ActionError(translateDbError(error, options));
}

/** Unwraps a Supabase response that must have a row/array; throws the translated error otherwise. */
export function unwrap<T>(
  response: { data: unknown; error: DbErrorLike | null },
  options: TranslateOptions,
): T {
  check(response.error, options);
  return response.data as T;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the browser: anything that is not a uuid is "not found" before it reaches the database. */
export function assertUuid(value: string, what = 'record'): void {
  if (!UUID.test(value)) stop('not_found', `This ${what} was not found.`);
}

export const READ: TranslateOptions = { fallback: 'load_failed' };
export const WRITE: TranslateOptions = { fallback: 'save_failed' };
export const PUBLISH: TranslateOptions = { fallback: 'publish_failed', validationAs: 'blocked' };

const FALLBACK_MESSAGE: Record<FailureMode, string> = {
  load_failed: 'The data could not be loaded. Nothing was lost. Please try again.',
  save_failed: 'That could not be saved. Nothing was changed. Please try again.',
  publish_failed: 'The website could not be refreshed. Nothing was changed. Please try again.',
};

function log(action: string, code: string): void {
  console.warn(JSON.stringify({ event: 'admin_action_failed', action, code }));
}

export async function runAction<T>(
  action: string,
  mode: FailureMode,
  body: (admin: AdminContext) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const admin = await requireAdmin();
    return success(await body(admin));
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      log(action, `auth_${error.reason}`);
      return failure(
        'unauthenticated',
        error.reason === 'expired'
          ? 'You were logged out. Please log in again.'
          : 'Please log in to continue.',
      );
    }
    if (error instanceof ActionError) {
      log(action, error.failure.code);
      return { ok: false, error: error.failure };
    }
    // Unknown failure (network, bug): never echo the message to the browser.
    log(action, 'unexpected');
    return failure(mode, FALLBACK_MESSAGE[mode]);
  }
}

/** Reads every page of a PostgREST query (default page cap is 1000 rows) up to `cap` rows. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: DbErrorLike | null }>,
  options: TranslateOptions = READ,
  cap = 5000,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += pageSize) {
    const rows = unwrap<T[] | null>(await page(from, from + pageSize - 1), options) ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
