/**
 * Login form validation (A-01). MOCK AUTH (Stage 2): this only checks that the fields are filled in and
 * look right. There is no real authentication, no password is stored, compared or logged.
 */
import { checkText, fail, hasErrors, type FieldErrors, type Validation } from './common';

export interface LoginInput {
  email: string;
  password: string;
}
export type LoginField = keyof LoginInput;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: LoginInput): Validation<{ email: string }, LoginField> {
  const errors: FieldErrors<LoginField> = {};
  const email = input.email.trim();
  if (email === '') errors.email = 'Enter your email address.';
  else if (!EMAIL.test(email) || checkText(email, 'the email', { max: 200 })) {
    errors.email = 'Enter a valid email address, like name@example.com.';
  }
  if (input.password === '') errors.password = 'Enter your password.';
  if (hasErrors(errors)) return fail(errors);
  return { ok: true, value: { email } };
}
