import { expect, test } from '@playwright/test';

/** Real backend, no credentials needed: the public site on published content, and the admin guard. */

test.describe('public site on the real published release', () => {
  test('/api/health is up and returns no content data', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(Object.keys(await res.json()).sort()).toEqual(['status', 'version']);
  });

  test('pages render from the database, with no sample-content banner', async ({ page }) => {
    for (const path of ['/', '/menu', '/plans', '/customize', '/how-it-works', '/about']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByText('Preview with sample content')).toHaveCount(0);
      await expect(page.getByTestId('preview-banner')).toHaveCount(0);
    }
  });

  test('/plans shows priced plans and /menu shows a table or the designed "not published" state', async ({
    page,
  }) => {
    await page.goto('/plans');
    await expect(page.getByText(/Rs\s?\d/).first()).toBeVisible();
    await page.goto('/menu');
    const table = page.locator('table').first();
    const notPublished = page.getByText('The menu is not published yet.');
    await expect(table.or(notPublished)).toBeVisible();
  });

  test('revalidate refuses callers without the secret', async ({ request }) => {
    const res = await request.post('/api/revalidate');
    expect([401, 503]).toContain(res.status());
  });
});

test.describe('admin guard (no session)', () => {
  for (const path of [
    '/admin',
    '/admin/customers',
    '/admin/payments',
    '/admin/publish',
    '/admin/settings',
  ]) {
    test(`${path} redirects to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Admin login' })).toBeVisible();
    });
  }

  test('the session-expired redirect message', async ({ page }) => {
    await page.goto('/admin/login?reason=expired');
    await expect(page.getByText('You were logged out.')).toBeVisible();
  });

  test('preview cannot be switched on without an admin session', async ({ page, context }) => {
    await page.goto('/admin/preview?to=%2Fmenu');
    await expect(page).toHaveURL(/\/admin\/login/);
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === '__prerender_bypass')).toBe(false);
  });

  test('a wrong login gives the generic message and no real mock banner', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByTestId('mock-banner')).toHaveCount(0);
    await expect(page.getByText('Mock only: preview other login states')).toHaveCount(0);
    await page.getByLabel('Email').fill('nobody@example.test');
    await page.getByLabel('Password').fill('not-the-password-123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email or password is not correct.' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
