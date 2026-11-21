import { expect, test } from '@playwright/test';
import { loadScenario, mockLogin, navTo, waitLoaded } from './admin-helpers';

/** PRD screen-inventory states that need a short interaction to reach (see the report for the full map). */

test('A-02 empty state with no customers (FR-30 AC 4)', async ({ page }) => {
  await mockLogin(page);
  await loadScenario(page, /Empty/);
  await navTo(page, 'Dashboard');
  await expect(page.getByRole('heading', { name: 'Add your first customer' })).toBeVisible();
  await expect(page.getByTestId('pending-pill')).toHaveText('Live site up to date');
});

test('A-05 empty, add with validation, delete confirm, reorder announcement', async ({ page }) => {
  await mockLogin(page);
  await navTo(page, 'Custom dishes');
  await page.getByRole('button', { name: 'Move Daal chawal up' }).click();
  await expect(page.getByText('Moved up. New position: 1 of 6.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Delete Fried fish' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Delete this dish?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep it' }).click();
  await page.getByRole('button', { name: 'Add dish' }).first().click();
  await page.locator('#dish-price').fill('6.5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#dish-price-e')).toContainText('whole rupees');
  await expect(page.locator('#dish-name-e')).toBeVisible();
  await loadScenario(page, /Empty/);
  await expect(page.getByRole('heading', { name: 'No custom dishes yet' })).toBeVisible();
});

test('A-04 a price range is rejected (Q-08 sample)', async ({ page }) => {
  await mockLogin(page);
  await navTo(page, 'Plans & prices');
  await page.locator('#plan-plan-student-unitPrice').fill('550–600');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.locator('#plan-plan-student-unitPrice-e')).toContainText(
    'A range or decimals are not allowed',
  );
  await page.locator('#plan-plan-student-unitPrice').fill('600');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Plans saved as draft' })).toBeVisible();
});

test('A-09 unsupported and oversized files are rejected; a valid upload works; in-use warning', async ({
  page,
}) => {
  await mockLogin(page);
  await navTo(page, 'Images');
  await page.locator('#media-alt').fill('Steel tiffin boxes');
  await page
    .locator('#media-file')
    .setInputFiles({ name: 'kitchen.heic', mimeType: 'image/heic', buffer: Buffer.from('x') });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'kitchen.heic is not supported' }),
  ).toBeVisible();
  await page.locator('#media-file').setInputFiles({
    name: 'big.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(9 * 1024 * 1024),
  });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'big.jpg is 9 MB' })).toBeVisible();
  await page
    .locator('#media-file')
    .setInputFiles({ name: 'ok.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Uploaded ok.jpg' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete sample-3.jpg' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Customize page (Daal chawal)');
});

test('A-12/A-14 duplicate phone warning and office fields', async ({ page }) => {
  await mockLogin(page);
  await navTo(page, 'Customers');
  await page.getByRole('link', { name: 'Add customer' }).click();
  await page.getByRole('radio', { name: 'Office' }).check();
  await expect(page.locator('#cust-org')).toBeVisible();
  await page.getByRole('button', { name: 'Save customer' }).click();
  await expect(page.getByTestId('error-summary')).toContainText('fields need fixing');
  await page.getByRole('radio', { name: 'Student' }).check();
  await page.locator('#cust-name').fill('Student Sample 98');
  await page.locator('#cust-phone').fill('0300-0000001');
  await page.getByRole('button', { name: 'Save customer' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'This phone number is already saved.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Save anyway/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Student Sample 98' })).toBeVisible();
});

test('A-15 end before start is blocked; overlap warns; A-17 duplicate reference and future date warn', async ({
  page,
}) => {
  await mockLogin(page);
  await navTo(page, 'Customers');
  await page.getByRole('link', { name: 'Student Sample 01' }).click();
  await page.getByRole('link', { name: 'Add subscription' }).click();
  await page.locator('#sub-start').fill('2026-12-01');
  await page.locator('#sub-end').fill('2026-11-23');
  await page.getByRole('button', { name: 'Save subscription' }).click();
  await expect(page.locator('#sub-end-e')).toContainText('before the start date');
  await page.locator('#sub-end').fill('2026-12-07');
  await page.getByRole('button', { name: 'Save subscription' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'already has an active subscription' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.getByRole('link', { name: 'Record payment' }).first().click();
  await page.locator('#pay-amount').fill('100');
  await page.locator('#pay-date').fill('2026-11-25');
  await expect(page.getByText('The payment date is in the future')).toBeVisible();
  await page.getByLabel('Easypaisa').check();
  await page.locator('#pay-ref').fill('EP-0001');
  await page.getByRole('button', { name: 'Keep 25 Nov' }).click();
  await page.getByRole('button', { name: 'Save payment' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'This reference was already used.' }),
  ).toBeVisible();
});

test('A-17 voiding needs a reason and updates dues; history keeps the original', async ({
  page,
}) => {
  await mockLogin(page);
  await navTo(page, 'Payments & dues');
  await page.getByRole('tab', { name: 'Payments recorded' }).click();
  await page.getByRole('link', { name: /Edit \/ void.*EP-0001/ }).click();
  await page.getByRole('button', { name: 'Void payment' }).click();
  await expect(page.locator('#pay-void-e')).toBeVisible();
  await page.locator('#pay-void').fill('Entered twice');
  await page.getByRole('button', { name: 'Void payment' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Void payment' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Student Sample 01' })).toBeVisible();
  await navTo(page, 'Change history');
  await page.locator('#h-type').selectOption('Payment');
  await expect(page.getByText('Original values kept').first()).toBeAttached();
});

test('A-13 archive asks for confirmation when a plan is active; A-11 history filter and empty state', async ({
  page,
}) => {
  await mockLogin(page);
  await navTo(page, 'Customers');
  await page.getByRole('link', { name: 'Student Sample 01' }).click();
  await page.getByRole('button', { name: 'Archive this customer' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('active subscription');
  await page.getByRole('button', { name: 'Archive anyway' }).click();
  await expect(page.getByText('This customer is archived.')).toBeVisible();
  await navTo(page, 'Change history');
  await page.locator('#h-type').selectOption('Customer');
  await expect(page.getByRole('status').filter({ hasText: '2 entries matching' })).toBeVisible();
  await page.locator('#h-type').selectOption('Images');
  await expect(page.getByRole('heading', { name: 'No entries match these filters' })).toBeVisible();
});

test('loading and error states for data views (mock controls)', async ({ page }) => {
  await mockLogin(page);
  await navTo(page, 'Customers');
  await waitLoaded(page);
  await page.getByText('Mock controls (reviewers)').click();
  await page.getByLabel('Data cannot be loaded').check();
  await page.locator('#fs').selectOption('active');
  await expect(
    page.getByRole('alert').filter({ hasText: 'This could not be loaded.' }),
  ).toBeVisible();
  await page.getByLabel('Data cannot be loaded').uncheck();
  await expect(page.getByRole('status').filter({ hasText: '4 customers' })).toBeVisible();
  await page.getByLabel('Slow loading').check();
  await page.locator('#fs').selectOption('paused');
  await page.getByLabel('Slow loading').uncheck();
});

test('A-03 empty next week, copy last week, schedule and cancel', async ({ page }) => {
  await mockLogin(page);
  await loadScenario(page, /Empty/);
  await navTo(page, 'Menu');
  await expect(page.getByRole('heading', { name: /No menu for 30 Nov – 6 Dec yet/ })).toBeVisible();
  await page.getByRole('button', { name: 'Copy last week (21 slots)' }).click();
  await expect(page.locator('#slot-0-lunch')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Schedule go-live' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Scheduled.' })).toBeVisible();
  await expect(page.getByText(/Scheduled for/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel schedule' }).click();
  await expect(page.getByText('No go-live time set')).toBeVisible();
});
