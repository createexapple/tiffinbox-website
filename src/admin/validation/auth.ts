/**
 * Login form validation (A-01, FR-13). Runs in the browser for instant messages and again on the server in the
 * sign-in action (the server never trusts the client). It only checks the shape of the fields; whether the
 * credentials are right is decided by Supabase Auth, and the answer is always the same generic message.
 */
import { checkText, fail, hasErrors, type FieldErrors, type Validation } from './common';

export interface LoginInput {
  email: string;
  password: string;
}
export type LoginField = keyof LoginInput;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_PASSWORD_LENGTH = 200;

export function validateLogin(input: LoginInput): Validation<{ email: string }, LoginField> {
  const errors: FieldErrors<LoginField> = {};
  const email = input.email.trim();
  if (email === '') errors.email = 'Enter your email address.';
  else if (!EMAIL.test(email) || checkText(email, 'the email', { max: 200 })) {
    errors.email = 'Enter a valid email address, like name@example.com.';
  }
  if (input.password === '') errors.password = 'Enter your password.';
  else if (input.password.length > MAX_PASSWORD_LENGTH)
    errors.password = 'That password is too long.';
  if (hasErrors(errors)) return fail(errors);
  return { ok: true, value: { email } };
}
