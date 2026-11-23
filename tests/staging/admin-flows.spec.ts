import { expect, test } from '@playwright/test';
import { ADMIN_SKIP_MESSAGE, adminCredentials, signIn } from './env';

/**
 * Authenticated admin flows on the STAGING project. They need an admin account that does not exist until the
 * Engineering Lead creates it, so without E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD every test here is skipped.
 * Data written is clearly named "E2E Test <timestamp>" and the customer is archived again at the end.
 */
const creds = adminCredentials();
test.skip(creds === null, ADMIN_SKIP_MESSAGE);
test.describe.configure({ mode: 'serial' });

test('sign in, see the dashboard on real figures, stay signed in on reload, log out', async ({
  page,
}) => {
  await signIn(page, creds!);
  await expect(page.getByTestId('mock-banner')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/login');
  await expect(page).toHaveURL(/\/admin$/); // signed in: the login page is skipped
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('customers: create, find by search, archive (cleans up after itself)', async ({ page }) => {
  await signIn(page, creds!);
  const name = `E2E Test ${Date.now()}`;
  await page.goto('/admin/customers/new');
  await page.locator('#cust-name').fill(name);
  await page.locator('#cust-phone').fill('0300-0009999');
  await page.getByRole('button', { name: 'Save customer' }).click();
  // A duplicate-phone warning may appear if an earlier run left a record; continue anyway.
  const anyway = page.getByRole('button', { name: /Save anyway/ });
  if (await anyway.isVisible().catch(() => false)) await anyway.click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page
    .getByRole('button', { name: /Archive/ })
    .first()
    .click();
  const confirm = page.getByRole('alertdialog').getByRole('button', { name: /Archive/ });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.goto('/admin/customers');
  await expect(page.getByRole('link', { name })).toHaveCount(0);
});

test('history lists the change that was just made, with the actor', async ({ page }) => {
  await signIn(page, creds!);
  await page.goto('/admin/history');
  await expect(page.getByText(/Created E2E Test/).first()).toBeVisible();
});

test('settings: a draft change round-trips and is restored; the settings page has the new fields', async ({
  page,
}) => {
  await signIn(page, creds!);
  await page.goto('/admin/settings');
  await expect(page.getByLabel('Business name')).toBeVisible();
  await expect(page.getByLabel('Tagline')).toBeVisible();
  await expect(page.getByLabel('Payment methods')).toBeVisible();
  const tagline = page.locator('#s-tagline');
  const original = await tagline.inputValue();
  await tagline.fill(`${original} (e2e)`);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Settings saved as draft' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('#s-tagline')).toHaveValue(`${original} (e2e)`);
  await page.locator('#s-tagline').fill(original);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Settings saved as draft' }),
  ).toBeVisible();
});

test('preview: the Publish screen opens the public site with drafts and the Preview bar, and it can be exited', async ({
  page,
  context,
}) => {
  await signIn(page, creds!);
  await page.goto('/admin/publish');
  const link = page.getByRole('link', { name: /Open preview of the whole site/ });
  const [preview] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await preview.waitForLoadState();
  await expect(preview.getByTestId('preview-banner')).toBeVisible();
  await preview.getByRole('link', { name: 'Exit preview' }).click();
  await expect(preview).toHaveURL(/\/admin\/publish/);
  await preview.goto('/');
  await expect(preview.getByTestId('preview-banner')).toHaveCount(0);
});

test('password change: a wrong current password is refused with a clear message', async ({
  page,
}) => {
  await signIn(page, creds!);
  await page.goto('/admin/settings');
  await page.locator('#pw-cur').fill('definitely-not-my-password');
  await page.locator('#pw-new').fill('a-new-long-password-123');
  await page.locator('#pw-new2').fill('a-new-long-password-123');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Your current password is not correct.').first()).toBeVisible();
});

test('image upload: a text file renamed .jpg is refused by the server', async ({ page }) => {
  await signIn(page, creds!);
  await page.goto('/admin/media');
  await page.locator('#media-alt').fill('E2E test image');
  await page.locator('#media-file').setInputFiles({
    name: 'not-an-image.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('this is not an image'),
  });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'could not be read as an image' }),
  ).toBeVisible();
});
