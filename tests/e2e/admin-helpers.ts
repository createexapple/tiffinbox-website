import { expect, type Page } from '@playwright/test';

/** Test-mode sign-in (TIFFINBOX_TEST_MOCK_BACKEND=1): any well-formed email and a non-empty password reach the dashboard. */
export async function mockLogin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('staff.sample@example.test');
  await page.getByLabel('Password').fill('not-a-real-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await waitLoaded(page);
}

/** Opens the sidebar on phones, where it is a drawer. */
export async function openNav(page: Page) {
  const toggle = page.getByRole('button', { name: 'Menu', exact: true });
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }
}

/** Client-side navigation through the sidebar (keeps the in-memory mock data, unlike page.goto). */
export async function navTo(page: Page, name: string) {
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Admin' })
    .getByRole('link', { name, exact: true })
    .click();
}

export async function waitLoaded(page: Page) {
  await expect(page.getByTestId('loading')).toHaveCount(0);
}

/** Opens the reviewer "Mock controls" panel and loads a data set. */
export async function loadScenario(page: Page, label: RegExp | string) {
  await page.getByText('Mock controls (reviewers)').click();
  await page.getByRole('button', { name: label }).click();
  await waitLoaded(page);
}

export async function noHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

/** Static admin screens (reachable by URL). A-14, A-17 in their "new" form are included. */
export const ADMIN_STATIC_PAGES = [
  { id: 'A-01', path: '/admin/login', h1: 'Admin login', slug: 'a-01-login' },
  { id: 'A-02', path: '/admin', h1: 'Dashboard', slug: 'a-02-dashboard' },
  { id: 'A-03', path: '/admin/menu', h1: 'Menu', slug: 'a-03-menu' },
  { id: 'A-04', path: '/admin/plans', h1: 'Plans & pricing', slug: 'a-04-plans' },
  { id: 'A-05', path: '/admin/dishes', h1: 'Custom dishes', slug: 'a-05-dishes' },
  { id: 'A-06', path: '/admin/addons', h1: 'Add-ons', slug: 'a-06-addons' },
  { id: 'A-07', path: '/admin/faq', h1: 'FAQ', slug: 'a-07-faq' },
  { id: 'A-08', path: '/admin/settings', h1: 'Site settings', slug: 'a-08-settings' },
  { id: 'A-09', path: '/admin/media', h1: 'Images', slug: 'a-09-media' },
  { id: 'A-10', path: '/admin/publish', h1: 'Preview & publish', slug: 'a-10-publish' },
  { id: 'A-11', path: '/admin/history', h1: 'Change history', slug: 'a-11-history' },
  { id: 'A-12', path: '/admin/customers', h1: 'Customers', slug: 'a-12-customers' },
  { id: 'A-14', path: '/admin/customers/new', h1: 'Add customer', slug: 'a-14-customer-form-new' },
  { id: 'A-16', path: '/admin/payments', h1: 'Payments & dues', slug: 'a-16-payments' },
  { id: 'A-17', path: '/admin/payments/new', h1: 'Record payment', slug: 'a-17-payment-form-new' },
] as const;
