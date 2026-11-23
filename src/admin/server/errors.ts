/**
 * Translates a PostgREST / PostgreSQL error from Supabase into the admin's error model (docs/database.md sec. 4).
 * Pure and unit-tested (tests/unit/admin-errors.test.ts).
 *
 *   PT400  validation failed; DETAIL is a JSON array [{field, message}]  -> invalid (or blocked for publish) + fields
 *   PT403  caller is not an active admin                                  -> forbidden
 *   PT404  not found                                                      -> not_found
 *   23503  foreign key / in-use guard                                     -> blocked
 *   23505  unique violation                                               -> invalid
 *   23514 / 22xxx / 23502  check, data or not-null violation              -> invalid
 *   42501  insufficient privilege / RLS                                   -> forbidden
 *   anything else (network, timeout, 5xx)                                 -> `fallback` (a generic message)
 *
 * Postgres messages can contain row values, so they are never passed through except the PT400 messages the
 * database wrote on purpose for the admin.
 */
import type { RepoErrorCode } from '../repository';
import type { ActionFailure } from './result';

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
}

export interface TranslateOptions {
  /** Used for anything unrecognised: "load_failed" for reads, "save_failed" for writes, "publish_failed" for publish. */
  fallback: Extract<RepoErrorCode, 'load_failed' | 'save_failed' | 'publish_failed'>;
  /** PT400 means "blocked" (publish checks) rather than "invalid" (a form field). */
  validationAs?: 'invalid' | 'blocked';
}

/**
 * Messages the database's own triggers raise on purpose (no row values in them). They are shown as written
 * (capitalised) with code "invalid", instead of the generic text.
 */
const SAFE_MESSAGES = [
  'this customer is archived; restore the customer first',
  'the subscription does not belong to this customer',
  'a voided payment cannot be edited',
  'an anonymised customer cannot be edited',
] as const;

export function safeTriggerMessage(message: string | null | undefined): string | null {
  const found = SAFE_MESSAGES.find((m) => message?.trim().toLowerCase() === m);
  return found ? `${found.charAt(0).toUpperCase()}${found.slice(1)}.` : null;
}

const GENERIC: Record<TranslateOptions['fallback'], string> = {
  load_failed: 'The data could not be loaded. Nothing was lost. Please try again.',
  save_failed: 'That could not be saved. Nothing was changed. Please try again.',
  publish_failed: 'The website could not be refreshed. Nothing was changed. Please try again.',
};

/** Parses the PT400 DETAIL ("[{field, message}, ...]"); empty when it is not that shape. */
export function parseValidationDetails(details: string | null | undefined): Record<string, string> {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    if (!Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const { field, message } = item as { field?: unknown; message?: unknown };
      if (typeof field === 'string' && typeof message === 'string' && !(field in out)) {
        out[field] = message;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function translateDbError(error: DbErrorLike, options: TranslateOptions): ActionFailure {
  const code = error.code ?? '';
  const safe = safeTriggerMessage(error.message);
  if (safe) return { code: 'invalid', message: safe };
  switch (code) {
    case 'PT400': {
      const fields = parseValidationDetails(error.details);
      const messages = Object.values(fields);
      return {
        code: options.validationAs ?? 'invalid',
        message: messages.length > 0 ? messages.join(' ') : 'Some values need fixing.',
        ...(messages.length > 0 ? { fields } : {}),
      };
    }
    case 'PT403':
    case '42501':
      return {
        code: 'forbidden',
        message: 'Your account is not allowed to do this. Ask the owner to check your access.',
      };
    case 'PT404':
      return { code: 'not_found', message: 'This record was not found. It may have been removed.' };
    case '23503':
      return {
        code: 'blocked',
        message:
          'This is still in use, so it cannot be removed. Remove it from where it is used first.',
      };
    case '23505':
      return { code: 'invalid', message: 'That already exists.' };
    case '23514':
    case '23502':
    case '22P02':
    case '22007':
    case '22008':
      return { code: 'invalid', message: 'Some values are not valid. Please check and try again.' };
    default:
      return { code: options.fallback, message: GENERIC[options.fallback] };
  }
}
