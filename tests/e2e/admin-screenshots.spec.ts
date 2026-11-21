import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATIC_PAGES, loadScenario, mockLogin, navTo, waitLoaded } from './admin-helpers';

/**
 * Evidence screenshots of the admin, off by default. Run with: SCREENSHOTS=1 npx playwright test admin-screenshots
 * Output: docs/test-results/stage2/screenshots/admin/<screen>-<mobile|desktop>.png (360 and 1280 wide).
 * Mock data only: every record in the pictures is synthetic.
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture screenshots');

const SIZES = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const DIR = 'docs/test-results/stage2/screenshots/admin';

async function shot(page: Page, slug: string, size: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${DIR}/${slug}-${size}.png`, fullPage: true });
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const screen of ADMIN_STATIC_PAGES) {
      test(`${screen.id} ${screen.path}`, async ({ page }) => {
        await page.goto(screen.path);
        await waitLoaded(page);
        await shot(page, screen.slug, size.name);
      });
    }

    test('A-13 customer detail, office view, archived, forms (A-14 edit, A-15, A-17)', async ({
      page,
    }) => {
      await page.goto('/admin/customers');
      await waitLoaded(page);

      await page.getByRole('link', { name: 'Home Sample 03' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Home Sample 03' })).toBeVisible();
      await waitLoaded(page);
      await shot(page, 'a-13-customer-overdue-renewal', size.name);
      await page.getByRole('tab', { name: 'Payments' }).click();
      await shot(page, 'a-13-customer-payments-tab', size.name);
      await page.getByRole('tab', { name: 'Subscriptions' }).click();

      await page.getByRole('link', { name: 'Edit', exact: true }).click();
      await waitLoaded(page);
      await shot(page, 'a-14-customer-form-edit', size.name);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page.getByRole('link', { name: 'Add subscription' }).click();
      await waitLoaded(page);
      await shot(page, 'a-15-subscription-form-new', size.name);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page
        .getByRole('link', { name: /^Renew.*subscription$/ })
        .first()
        .click();
      await waitLoaded(page);
      await shot(page, 'a-15-subscription-form-renew', size.name);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page.getByRole('link', { name: /^Edit.*subscription$/ }).click();
      await waitLoaded(page);
      await shot(page, 'a-15-subscription-form-edit', size.name);

      await navTo(page, 'Customers');
      await page.getByRole('link', { name: 'Office Sample Traders' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Office Sample Traders' }),
      ).toBeVisible();
      await waitLoaded(page);
      await shot(page, 'a-13-customer-office', size.name);
    });

    test('A-17 edit / void and A-12 filtered', async ({ page }) => {
      await page.goto('/admin/payments');
      await waitLoaded(page);
      await page.getByRole('tab', { name: 'Payments recorded' }).click();
      await shot(page, 'a-16-payments-ledger', size.name);
      await page.getByRole('link', { name: /Edit \/ void.*EP-0001/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Edit payment' })).toBeVisible();
      await waitLoaded(page);
      await shot(page, 'a-17-payment-form-edit-void', size.name);
    });

    test('selected states: validation, warnings, empty, blocked publish', async ({ page }) => {
      await page.goto('/admin/customers/new');
      await page.getByRole('button', { name: 'Save customer' }).click();
      await shot(page, 'a-14-state-validation-error', size.name);

      await page.goto('/admin/login');
      await page.getByRole('button', { name: 'Log in' }).click();
      await shot(page, 'a-01-state-validation-error', size.name);

      await mockLogin(page);
      await navTo(page, 'Preview & publish');
      await waitLoaded(page);
      await shot(page, 'a-10-state-blocked', size.name);

      await navTo(page, 'Customers');
      await page.locator('#q').fill('0399');
      await shot(page, 'a-12-state-no-results', size.name);

      await loadScenario(page, /Empty/);
      await navTo(page, 'Dashboard');
      await waitLoaded(page);
      await shot(page, 'a-02-state-empty', size.name);
      await navTo(page, 'Custom dishes');
      await waitLoaded(page);
      await shot(page, 'a-05-state-empty', size.name);
    });
  });
}
