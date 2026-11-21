import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_STATIC_PAGES,
  loadScenario,
  mockLogin,
  navTo,
  noHorizontalOverflow,
  waitLoaded,
} from './admin-helpers';

const VIEWPORTS = [
  { name: '360', width: 360, height: 780 },
  { name: '1280', width: 1280, height: 800 },
] as const;

async function expectOneH1(page: Page, name: string) {
  const h1 = page.locator('h1');
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText(name);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('note').first()).toContainText('Mock data: nothing is saved');
}

for (const viewport of VIEWPORTS) {
  test.describe(`every admin screen at ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const screen of ADMIN_STATIC_PAGES) {
      test(`${screen.id} ${screen.path}: one H1, mock banner, no horizontal overflow`, async ({
        page,
      }) => {
        const response = await page.goto(screen.path);
        expect(response?.status()).toBe(200);
        await waitLoaded(page);
        await expectOneH1(page, screen.h1);
        await noHorizontalOverflow(page);
      });
    }

    test('A-13, A-14 edit, A-15 (add, edit, renew) and A-17 edit: one H1, no horizontal overflow', async ({
      page,
    }) => {
      await page.goto('/admin/customers');
      await waitLoaded(page);
      await page.getByRole('link', { name: 'Home Sample 03' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Home Sample 03' })).toBeVisible();
      await waitLoaded(page);
      await expectOneH1(page, 'Home Sample 03');
      await noHorizontalOverflow(page);

      await page.getByRole('link', { name: 'Edit', exact: true }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Edit Home Sample 03' }),
      ).toBeVisible();
      await waitLoaded(page);
      await expectOneH1(page, 'Edit Home Sample 03');
      await noHorizontalOverflow(page);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page.getByRole('link', { name: 'Add subscription' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Add subscription' })).toBeVisible();
      await waitLoaded(page);
      await expectOneH1(page, 'Add subscription');
      await noHorizontalOverflow(page);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page.getByRole('link', { name: /^Edit.*subscription$/ }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Edit subscription' }),
      ).toBeVisible();
      await waitLoaded(page);
      await expectOneH1(page, 'Edit subscription');
      await noHorizontalOverflow(page);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page
        .getByRole('link', { name: /^Renew.*subscription$/ })
        .first()
        .click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Renew subscription' }),
      ).toBeVisible();
      await waitLoaded(page);
      await expectOneH1(page, 'Renew subscription');
      await noHorizontalOverflow(page);
      await page.getByRole('link', { name: 'Cancel' }).click();

      await page.getByRole('tab', { name: 'Payments' }).click();
      await noHorizontalOverflow(page);
      await page.getByRole('link', { name: 'Record payment' }).first().click();
      await expect(page.getByRole('heading', { level: 1, name: 'Record payment' })).toBeVisible();
      await waitLoaded(page);
      await noHorizontalOverflow(page);
    });

    test('A-17 edit / void from the payments ledger', async ({ page }) => {
      await page.goto('/admin/payments');
      await waitLoaded(page);
      await page.getByRole('tab', { name: 'Payments recorded' }).click();
      await page.getByRole('link', { name: /Edit \/ void.*EP-0001/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Edit payment' })).toBeVisible();
      await waitLoaded(page);
      await expectOneH1(page, 'Edit payment');
      await noHorizontalOverflow(page);
    });
  });
}

test.describe('login form in test mode (FR-13; real sign-in is covered by tests/staging)', () => {
  test('valid-looking input goes to the dashboard; the test-mode banner says no login is checked', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await expect(page.getByTestId('mock-banner')).toContainText('no login is checked');
    await mockLogin(page);
    await expect(page).toHaveURL(/\/admin$/);
    // The password never appears in the address bar.
    expect(page.url()).not.toContain('password');
  });

  test('empty and malformed input show field-level errors and stay on the login page', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByTestId('error-summary')).toContainText('2 fields need fixing');
    await expect(page.locator('#login-email-e')).toHaveText('Enter your email address.');
    await expect(page.locator('#login-password-e')).toHaveText('Enter your password.');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('x');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.locator('#login-email-e')).toHaveText(
      'Enter a valid email address, like name@example.com.',
    );
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('error, throttled and session-expired states are reachable', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByText('Mock only: preview other login states').click();
    await page.getByRole('button', { name: 'Wrong credentials' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email or password is not correct.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Throttled' }).click();
    await expect(page.getByText('Too many attempts.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeDisabled();
    await page.getByRole('button', { name: 'Session expired' }).click();
    await expect(page.getByText('You were logged out.')).toBeVisible();
    await page.goto('/admin/login?reason=expired');
    await expect(page.getByText('You were logged out.')).toBeVisible();
  });
});

test.describe('customers: add, subscribe, pay (FR-24, FR-26, FR-28, FR-29)', () => {
  test('a new customer appears in the list; a subscription and payment move balances and status', async ({
    page,
  }) => {
    await mockLogin(page);
    const dues = async () => {
      await navTo(page, 'Dashboard');
      await waitLoaded(page);
      const unpaid = page.getByRole('link', { name: /Unpaid/ });
      const count = Number((await unpaid.locator('.n').textContent()) ?? '0');
      const total = (await unpaid.locator('.s').textContent()) ?? '';
      return { count, total };
    };
    const before = await dues();
    expect(before).toEqual({ count: 2, total: 'Rs 12,250 due' });

    // Add a customer
    await navTo(page, 'Customers');
    await page.getByRole('link', { name: 'Add customer' }).click();
    await page.locator('#cust-name').fill('Student Sample 99');
    await page.locator('#cust-phone').fill('0300-0000099');
    await page.getByRole('button', { name: 'Save customer' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Student Sample 99' })).toBeVisible();

    // It appears in the list
    await navTo(page, 'Customers');
    await page.locator('#q').fill('Sample 99');
    await expect(page.getByRole('link', { name: 'Student Sample 99' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '1 customer' })).toBeVisible();

    // Add a weekly subscription: end date and amount are proposed from the plan
    await page.getByRole('link', { name: 'Student Sample 99' }).click();
    await page.getByRole('link', { name: 'Add subscription' }).click();
    await expect(page.locator('#sub-end')).toHaveValue('2026-11-29');
    await expect(page.locator('#sub-amount')).toHaveValue('4200');
    await page.getByRole('button', { name: 'Save subscription' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Student Sample 99' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Budget/ })).toContainText('Upcoming');

    // Its period is unpaid, with a balance
    await page.getByRole('tab', { name: 'Payments' }).click();
    const dueRow = page.getByRole('table', { name: 'Dues by period' }).getByRole('row').nth(1);
    await expect(dueRow).toContainText('Rs 4,200');
    await expect(dueRow).toContainText('Unpaid');

    // The dashboard counts moved by exactly this subscription
    const during = await dues();
    expect(during).toEqual({ count: 3, total: 'Rs 16,450 due' });

    // Record the payment in full
    await navTo(page, 'Customers');
    await page.locator('#q').fill('Sample 99');
    await page.getByRole('link', { name: 'Student Sample 99' }).click();
    await page.getByRole('link', { name: 'Record payment' }).first().click();
    await expect(page.locator('#pay-amount')).toHaveValue('4200');
    await expect(page.getByTestId('balance-line')).toContainText('balance Rs 4,200');
    await page.getByLabel('JazzCash').check();
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Student Sample 99' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'is now Paid' })).toBeVisible();
    await page.getByRole('tab', { name: 'Payments' }).click();
    const paidRow = page.getByRole('table', { name: 'Dues by period' }).getByRole('row').nth(1);
    await expect(paidRow).toContainText('Paid');
    await expect(paidRow).toContainText('Rs 0');

    // The dashboard is back to where it started
    expect(await dues()).toEqual(before);
  });

  test('a part payment leaves a balance and the period stays unpaid or overdue', async ({
    page,
  }) => {
    await mockLogin(page);
    await navTo(page, 'Payments & dues');
    await waitLoaded(page);
    const row = page.getByRole('row', { name: /Home Sample 07/ });
    await row.getByRole('link', { name: /Record payment/ }).click();
    await page.locator('#pay-amount').fill('1000');
    await page.getByLabel('Easypaisa').check();
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'still owes Rs 3,200' })).toBeVisible();
    await page.getByRole('tab', { name: 'Payments' }).click();
    const dueRow = page.getByRole('table', { name: 'Dues by period' }).getByRole('row').nth(1);
    await expect(dueRow).toContainText('Rs 1,000');
    await expect(dueRow).toContainText('Rs 3,200');
    await expect(dueRow).toContainText('Unpaid');
  });
});

test.describe('menu draft and publishing (FR-14, FR-22)', () => {
  test('editing the live week saves a draft and shows as an unpublished change', async ({
    page,
  }) => {
    await mockLogin(page);
    await loadScenario(page, /nothing pending/);
    await expect(page.getByTestId('pending-pill')).toHaveText('Live site up to date');

    await navTo(page, 'Menu');
    await page.getByRole('tab', { name: /This week/ }).click();
    await expect(page.getByText('You are editing the live week.')).toBeVisible();
    await page.locator('#slot-0-breakfast').fill('Halwa puri, chai');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Draft saved. Live site unchanged.' }),
    ).toBeVisible();
    await expect(page.getByTestId('pending-pill')).toHaveText('1 unpublished change');

    await navTo(page, 'Preview & publish');
    await expect(page.getByRole('heading', { name: '1 change waiting' })).toBeVisible();
    const row = page.getByRole('row', { name: /Menu/ });
    await expect(row).toContainText('This week 23 – 29 Nov: 1 slot edited');
  });

  test('over-long text and markup are refused with a clear message at the field', async ({
    page,
  }) => {
    await mockLogin(page);
    await navTo(page, 'Menu');
    await page.getByRole('tab', { name: /This week/ }).click();
    await page.locator('#slot-2-dinner').fill('x'.repeat(130));
    await page.locator('#slot-3-lunch').fill('<b>Karhi</b>');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByTestId('error-summary')).toContainText('2 fields need fixing');
    await expect(page.locator('#slot-2-dinner-e')).toContainText('too long (max 120 characters)');
    await expect(page.locator('#slot-3-lunch-e')).toContainText('plain text only');
    await expect(page.locator('#slot-2-dinner')).toHaveAttribute('aria-invalid', 'true');
  });

  test('publish is blocked until settings are filled in, then publishes, then rolls back', async ({
    page,
  }) => {
    await mockLogin(page);
    await navTo(page, 'Preview & publish');
    await expect(page.getByText('Blocked: WhatsApp number, order hours not set')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish changes' })).toBeDisabled();

    await navTo(page, 'Settings');
    await page.locator('#s-wa').fill('920000000000');
    await page.locator('#s-hours').fill('Sample hours');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Settings saved as draft' }),
    ).toBeVisible();

    await navTo(page, 'Preview & publish');
    await expect(page.getByRole('button', { name: 'Publish changes' })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Publishing…').first()).toBeVisible();
    await expect(page.getByText('The live site now shows version v13')).toBeVisible();
    await expect(page.getByTestId('pending-pill')).toHaveText('Live site up to date');
    await expect(page.getByRole('heading', { name: 'No changes to publish' })).toBeVisible();

    await page.getByRole('button', { name: 'Roll back to v12' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Roll back' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'back on version v12' })).toBeVisible();
  });

  test('a failed publish leaves the live site on the previous version (FR-22 AC 3)', async ({
    page,
  }) => {
    await mockLogin(page);
    await loadScenario(page, /settings filled in/);
    await page.getByLabel('Next publish fails').check();
    await navTo(page, 'Preview & publish');
    await page.getByRole('button', { name: 'Publish changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
    const failure = page.getByRole('alert').filter({ hasText: 'Publishing did not work.' });
    await expect(failure).toContainText('still shows version v12');
    await expect(failure).toContainText('Your drafts are safe');
  });
});

test.describe('customer search (NFR-12)', () => {
  test('search text and filters never reach the URL, the title, the network or the console', async ({
    page,
  }) => {
    const consoleLines: string[] = [];
    const requests: string[] = [];
    page.on('console', (msg) => consoleLines.push(msg.text()));
    page.on('request', (req) => requests.push(`${req.url()} ${req.postData() ?? ''}`));
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await mockLogin(page);
    await navTo(page, 'Customers');
    await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
    await waitLoaded(page);
    const before = page.url();
    expect(new URL(before).pathname).toBe('/admin/customers');

    await page.locator('#q').fill('Traders');
    await expect(page.getByRole('link', { name: 'Office Sample Traders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Student Sample 01' })).toHaveCount(0);
    await page.locator('#q').press('Enter');
    await page.locator('#ft').selectOption('office');
    await page.locator('#fp').selectOption('overdue');

    expect(page.url()).toBe(before);
    expect(new URL(page.url()).search).toBe('');
    expect(await page.title()).not.toMatch(/Traders|Sample|0300/);
    expect(requests.filter((r) => /Traders|0300/i.test(r))).toEqual([]);

    await page.locator('#q').fill('0300-0000003');
    await page.locator('#ft').selectOption('');
    await page.locator('#fp').selectOption('');
    await expect(page.getByRole('link', { name: 'Home Sample 03' })).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    expect(requests.filter((r) => /0300-?0000003/.test(r))).toEqual([]);

    // Customer detail: opaque id in the path, no name or phone in the URL or title.
    await page.getByRole('link', { name: 'Home Sample 03' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Home Sample 03' })).toBeVisible();
    expect(new URL(page.url()).pathname).toMatch(/^\/admin\/customers\/c-[0-9a-f]{8}$/);
    expect(page.url()).not.toMatch(/Home|Sample|0300/);
    expect(await page.title()).toBe('Customer | Tiffin Box admin');

    expect(consoleLines.filter((l) => /Sample|0300|Traders/.test(l))).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('dashboard cards open the filtered lists with matching counts (FR-30)', async ({ page }) => {
    await mockLogin(page);
    const card = (name: RegExp) => page.getByRole('link', { name });
    await expect(card(/Active subscribers/).locator('.n')).toHaveText('4');
    await card(/Active subscribers/).click();
    await expect(page.getByRole('status').filter({ hasText: '4 customers' })).toBeVisible();
    await expect(page.locator('#fs')).toHaveValue('active');

    await navTo(page, 'Dashboard');
    await card(/Plans ending within 7 days/).click();
    await expect(page.getByRole('status').filter({ hasText: '3 customers' })).toBeVisible();
    await expect(page.locator('#fs')).toHaveValue('renewal_due');

    await navTo(page, 'Dashboard');
    await card(/Overdue/).click();
    await expect(page.getByRole('status').filter({ hasText: '3 periods' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Total balance/ })).toContainText('Rs 21,240');
  });
});

test.describe('admin pages are never indexed (NFR-07)', () => {
  for (const path of ['/admin/login', '/admin', '/admin/customers', '/admin/payments/new']) {
    test(`${path} has noindex in the header and the meta tag, and is not cached`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.headers()['x-robots-tag']).toMatch(/noindex/);
      expect(response?.headers()['cache-control']).toMatch(/no-store/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
  }

  test('the sitemap lists no admin page and robots.txt does not invite crawlers in', async ({
    request,
  }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/admin');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \//);
  });

  test('the public site does not link to the admin (NFR-07)', async ({ page }) => {
    await page.goto('/');
    expect(await page.locator('a[href^="/admin"]').count()).toBe(0);
  });
});
