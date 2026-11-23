import { expect, type Page } from '@playwright/test';

export const ADMIN_SKIP_MESSAGE =
  'NOT RUN: set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an admin account on the STAGING project, created by the Engineering Lead; see docs/backend.md)';

/** Credentials come from the environment only; they are never written to a file, a log or a trace. */
export function adminCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}

export async function signIn(page: Page, creds: { email: string; password: string }) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByTestId('loading')).toHaveCount(0);
}
