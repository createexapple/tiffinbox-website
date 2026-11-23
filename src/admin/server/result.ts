/**
 * What every server action returns. Server actions never throw to the browser: Next.js hides the message of a
 * thrown error in production, so each action returns a plain, serialisable result and the client repository turns
 * a failure into a `RepoError` (src/admin/actions-repository.ts). No framework or server-only imports here, so the
 * client can import the types.
 */
import type { RepoErrorCode } from '../repository';

export interface ActionFailure {
  code: RepoErrorCode;
  /** Safe to show to the admin. Never contains personal data, SQL or stack traces. */
  message: string;
  /** Field-level messages (database field names) when the database rejected specific fields. */
  fields?: Record<string, string>;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionFailure };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(
  code: RepoErrorCode,
  message: string,
  fields?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, error: fields ? { code, message, fields } : { code, message } };
}
