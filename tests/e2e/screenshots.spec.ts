import { test } from '@playwright/test';
import { NOT_FOUND_PATH, PAGES } from './pages';

/**
 * Evidence screenshots, off by default. Run with: SCREENSHOTS=1 npx playwright test screenshots
 * Output: docs/test-results/stage2/screenshots/<page>-<mobile|desktop>.png
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture screenshots');

const SIZES = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const slug = (path: string) => (path === '/' ? 'home' : path.replace(/^\/#?/, ''));

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    for (const path of [...PAGES.map((p) => p.path), NOT_FOUND_PATH]) {
      test(`${path}`, async ({ page }) => {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `docs/test-results/stage2/screenshots/${slug(path === NOT_FOUND_PATH ? '/404' : path)}-${size.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}

test('mobile menu open', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.screenshot({ path: 'docs/test-results/stage2/screenshots/home-mobile-menu-open.png' });
});
