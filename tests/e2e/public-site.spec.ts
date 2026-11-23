import { expect, test, type Page } from '@playwright/test';
import { NOT_FOUND_PATH, PAGES } from './pages';

const ALL_PATHS = [...PAGES.map((p) => p.path), NOT_FOUND_PATH];

async function expectChrome(page: Page) {
  // FR-02 persistent WhatsApp button, FR-03 end-of-page Order button, FR-04 Instagram link.
  await expect(page.getByRole('link', { name: 'WhatsApp: start an order' })).toBeVisible();
  const order = page.getByRole('link', { name: 'Order on WhatsApp', exact: true });
  await expect(order).toBeVisible();
  const instagram = page.getByRole('contentinfo').getByRole('link', { name: /@tiffinbox\.lhr/ });
  await expect(instagram).toBeVisible();
  await expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/tiffinbox.lhr/');
  await expect(instagram).toHaveAttribute('target', '_blank');
  await expect(instagram).toHaveAttribute('rel', /noopener/);
}

test.describe('every public page', () => {
  for (const path of ALL_PATHS) {
    const expectedStatus = path === NOT_FOUND_PATH ? 404 : 200;

    test(`${path} loads (${expectedStatus}) with exactly one H1 and landmarks`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(expectedStatus);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1);
      expect(await page.title()).not.toBe('');
    });

    test(`${path} has the WhatsApp button, Order button and Instagram link`, async ({ page }) => {
      await page.goto(path);
      await expectChrome(page);
    });

    test(`${path}: Order on WhatsApp is the last content block above the footer`, async ({
      page,
    }) => {
      await page.goto(path);
      const nextTag = await page
        .locator('section.order-end')
        .evaluate((el) => el.nextElementSibling?.tagName ?? null);
      expect(nextTag).toBe('FOOTER');
      const mainEndsBefore = await page
        .locator('main')
        .evaluate((el) => el.nextElementSibling?.classList.contains('order-end') ?? false);
      expect(mainEndsBefore).toBe(true);
    });
  }
});

test.describe('placeholder WhatsApp state (number not supplied yet)', () => {
  test('buttons never link to a broken wa.me URL and open a labelled note', async ({ page }) => {
    await page.goto('/');
    const links = [
      page.getByRole('link', { name: 'WhatsApp: start an order' }),
      page.getByRole('link', { name: 'Order on WhatsApp', exact: true }),
    ];
    for (const link of links) {
      const href = await link.getAttribute('href');
      expect(href).toBe('#wa-note');
      expect(href).not.toContain('wa.me');
    }
    await expect(page.getByRole('dialog')).toBeHidden();
    await links[1]!.click();
    const dialog = page.getByRole('dialog', { name: 'WhatsApp number not set yet' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('[WhatsApp number]');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('shows the labelled placeholders from the design', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByText('[WhatsApp number]').first()).toBeVisible();
    await expect(page.getByText('[order hours]').first()).toBeVisible();
    await expect(page.getByRole('img', { name: /Photo coming soon/ })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Tiffin Box logo' })).toBeVisible();
  });
});

test.describe('navigation (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('logo goes Home and the six links reach their pages with the current page marked', async ({
    page,
  }) => {
    await page.goto('/about');
    await page.getByRole('link', { name: 'Tiffin Box, home' }).click();
    await expect(page).toHaveURL(/\/$/);

    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveCount(6);
    for (const target of PAGES) {
      await nav.getByRole('link', { name: target.nav, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${target.path === '/' ? '/$' : target.path + '$'}`));
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: target.nav, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('the menu toggle button is hidden and the links are visible without it', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Menu' }),
    ).toBeVisible();
  });
});

test.describe('navigation (mobile, 360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('menu opens and closes by button and Escape, and navigates', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Plans & Pricing' })).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link')).toHaveCount(6);
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();

    await toggle.click();
    await nav.getByRole('link', { name: 'Plans & Pricing' }).click();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('h1')).toHaveText('Apna plan chunein.');
  });

  test('every nav entry is reachable from the mobile menu', async ({ page }) => {
    for (const target of PAGES) {
      await page.goto('/');
      await page.getByRole('button', { name: 'Menu' }).click();
      await page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: target.nav, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`${target.path === '/' ? '/$' : target.path + '$'}`));
    }
  });

  test('the logo is at the top-left and goes Home', async ({ page }) => {
    await page.goto('/menu');
    const logo = page.getByRole('link', { name: 'Tiffin Box, home' });
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    const header = await page.getByRole('banner').boundingBox();
    expect(box!.x).toBeLessThan(40);
    // Top-left of the header (the Stage 2 preview banner sits above the header).
    expect(box!.y - header!.y).toBeLessThan(20);
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('tap targets are at least 44px high', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const targets = [
      page.getByRole('button', { name: 'Menu' }),
      page.getByRole('link', { name: 'Tiffin Box, home' }),
      page.getByRole('link', { name: 'WhatsApp: start an order' }),
      page.getByRole('link', { name: 'Order on WhatsApp', exact: true }),
      ...(await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all()),
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, 'target has a box').not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
    }
  });
});

test.describe('no horizontal overflow (NFR-02)', () => {
  for (const width of [360, 390, 768, 1280]) {
    test.describe(`${width}px`, () => {
      test.use({ viewport: { width, height: 800 } });
      for (const path of ALL_PATHS) {
        test(`${path}`, async ({ page }) => {
          await page.goto(path);
          const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
        });
      }
    });
  }
});

test.describe('FAQ (FR-11)', () => {
  test('toggles open and closed with the mouse', async ({ page }) => {
    await page.goto('/about');
    const items = page.locator('.faq details');
    expect(await items.count()).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.faq details[open]')).toHaveCount(0);

    const first = items.first();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.ans')).toBeVisible();
    await first.locator('summary').click();
    await expect(first).not.toHaveAttribute('open', '');

    // Several can be open at once.
    await items.nth(0).locator('summary').click();
    await items.nth(1).locator('summary').click();
    await expect(page.locator('.faq details[open]')).toHaveCount(2);
  });

  test('is operable with the keyboard (Tab, Enter, Space)', async ({ page }) => {
    await page.goto('/about');
    const first = page.locator('.faq details').first();
    const summary = first.locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(first).not.toHaveAttribute('open', '');
  });

  test('summaries are at least 44px high', async ({ page }) => {
    await page.goto('/about');
    const box = await page.locator('.faq summary').first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe('content from the content layer', () => {
  test('Home shows the headline, tagline and "Meals from" derived from the lowest plan price', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Bhook lagi? Khana hazir.');
    await expect(page.getByText('Ghar ka khana, Ammi ke pyaar jaisa').first()).toBeVisible();
    await expect(page.locator('.chip')).toHaveText([
      'Meals from Rs 500, delivered',
      'Try 3 days for Rs 4,800',
    ]);
    await expect(page.locator('.audiences .card')).toHaveCount(5);
    await expect(page.getByText('Late night 11 PM – 1 AM').first()).toBeVisible();
    await expect(page.locator('.steps li')).toHaveCount(3);
  });

  test('Menu shows seven days, a week label and the Customize link', async ({ page }) => {
    await page.goto('/menu');
    await expect(page.locator('h1')).toHaveText('Menu for 23–29 Nov');
    await expect(page.locator('.menu-table tbody tr')).toHaveCount(7);
    await page.getByRole('link', { name: 'Customize your meal' }).click();
    await expect(page).toHaveURL(/\/customize$/);
  });

  test('Plans shows five plans in order with tags, ranges and totals, then add-ons and who is eating', async ({
    page,
  }) => {
    await page.goto('/plans');
    await expect(page.locator('article.plan')).toHaveCount(5);
    await expect(page.locator('article.plan.popular')).toHaveCount(1);
    await expect(page.locator('article.plan h3')).toHaveText([
      'Starter',
      'Budget',
      'Student',
      'Office Lunch',
      'All 3 Meals',
    ]);
    await expect(page.locator('article.plan .badge-pop')).toHaveText([
      'New',
      'Cheapest',
      '★ Most popular',
    ]);
    await expect(page.locator('article.plan .price')).toHaveText([
      'Rs 800 per meal',
      'Rs 500 per meal',
      'Rs 750–800 per meal',
      'Rs 750 per meal',
      'Rs 2,100 per day',
    ]);
    await expect(page.locator('article.plan .weekly')).toHaveText([
      'Rs 4,800 for 3 days',
      'Rs 7,000 a week',
      'Rs 10,850 a week',
      'Rs 4,500 a week',
      'Rs 14,700 a week',
    ]);
    await expect(page.locator('article.plan .incl')).toHaveText(Array(5).fill('Delivery included'));
    await expect(page.getByText('Meals start at Rs 500, including Rs 150')).toBeVisible();
    await expect(page.getByText('Monthly saves 5%')).toBeVisible();
    await expect(page.getByText('Rs 550 a day, delivery included')).toBeVisible();
    const night = page.locator('.addon-card.dark');
    await expect(night).toContainText('Late-night meal');
    await expect(night).toContainText('Rs 900 a night, Rs 6,300 for 7 nights');
    await expect(night.locator('svg')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Who’s eating?' })).toBeVisible();
    await expect(page.getByText('Student: Rs 775 a meal')).toBeVisible();
    await expect(page.getByText('Rs 625 × 3 + Rs 150 = Rs 2,025 a meal')).toBeVisible();
    await expect(page.getByText('4 × Chicken biryani Rs 700 + Rs 150 = Rs 2,950')).toBeVisible();
    await expect(page.getByText(/Prices depend on our supplier/)).toBeVisible();
  });

  test('Menu has the late-night note and Customize shows the delivery line and example', async ({
    page,
  }) => {
    await page.goto('/menu');
    await expect(
      page.getByText('Late-night meal (11 PM – 1 AM) is chosen from the dinner menu'),
    ).toBeVisible();
    await page.goto('/customize');
    await expect(page.locator('h1')).toHaveText('Apni pasand ka khana.');
    await expect(page.getByText('Rs 150 delivery is added to every custom order')).toBeVisible();
    await expect(
      page.getByText('Chicken qorma Rs 650 + raita Rs 80 + delivery Rs 150 = Rs 880.'),
    ).toBeVisible();
    await expect(page.getByText('(+Rs 100 late-night charge)')).toBeVisible();
  });

  test('Customize lists dishes with prices and add-ons', async ({ page }) => {
    await page.goto('/customize');
    await expect(page.getByRole('heading', { name: 'Custom dishes' })).toBeVisible();
    await expect(page.locator('.price-row')).toHaveCount(12);
    await expect(page.getByText('Rs 750')).toBeVisible();
  });

  test('How it works shows the delivery table with late night, family and guest rows', async ({
    page,
  }) => {
    await page.goto('/how-it-works');
    await expect(page.locator('table thead th')).toHaveText([
      'Meal',
      'Delivered by',
      'Skip before',
      'Delivery charge',
    ]);
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(1)).toContainText('1 PM');
    await expect(rows.nth(1)).toContainText('10 AM the same day');
    await expect(rows.nth(3)).toContainText('11 PM – 1 AM');
    await expect(rows.nth(3)).toContainText('Rs 150 + Rs 100 late-night');
    await expect(rows.nth(4)).toContainText('One Rs 150 for everyone at one address');
    await expect(rows.nth(5)).toContainText('Order 1 day ahead');
    await expect(page.getByText('Choose Starter, weekly or monthly')).toBeVisible();
  });

  test('About has the 12 FAQ entries, the story placeholder and late-night order hours', async ({
    page,
  }) => {
    await page.goto('/about');
    await expect(page.locator('.faq details')).toHaveCount(12);
    await expect(page.getByText('[Our story — coming soon]')).toBeVisible();
    await expect(page.getByText('late-night orders until 9 PM')).toBeVisible();
  });

  test('the footer shows the Urdu name, the Instagram link and a QR code, with no script', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    const urdu = footer.locator('[lang="ur"]');
    await expect(urdu).toHaveText('ٹفن باکس');
    await expect(urdu).toHaveAttribute('dir', 'rtl');
    const qr = footer.getByRole('img', { name: 'QR code for Instagram @tiffinbox.lhr' });
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((el) => el.tagName.toLowerCase())).toBe('svg');
    const font = await urdu.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/Noto Nastaliq Urdu/i);
  });

  test('no public page shows a question code or a draft note', async ({ page }) => {
    for (const path of ALL_PATHS) {
      await page.goto(path);
      const text = await page.locator('body').innerText();
      expect(text, path).not.toMatch(/\bQ-\d+/);
      expect(text, path).not.toMatch(/draft copy|replace before launch|placeholder, replace/i);
    }
  });

  test('404 offers Home and the WhatsApp button', async ({ page }) => {
    const response = await page.goto(NOT_FOUND_PATH);
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Yeh page nahi mila.');
    await page.getByRole('link', { name: 'Go to Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('SEO (NFR-04)', () => {
  test('each page has a unique title, description, one canonical and Open Graph tags', async ({
    page,
  }) => {
    const titles = new Set<string>();
    for (const target of PAGES) {
      await page.goto(target.path);
      const title = await page.title();
      expect(title).toContain('Tiffin Box');
      titles.add(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
    }
    expect(titles.size).toBe(PAGES.length);
  });

  test('the Home description is derived from the lowest plan price', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Meals from Rs 500/,
    );
  });

  test('sitemap lists the six pages; robots blocks crawlers by default', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap.match(/<loc>/g)).toHaveLength(6);
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \//);
  });

  test('pages are noindex unless indexing is switched on', async ({ page }) => {
    await page.goto('/menu');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('Home carries structured data without unconfirmed facts', async ({ page }) => {
    await page.goto('/');
    const json = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(json ?? '{}');
    expect(data['@type']).toBe('FoodEstablishment');
    expect(data.telephone).toBeUndefined();
    expect(data.openingHours).toBeUndefined();
  });
});

test.describe('privacy (NFR-11) and fonts (NFR-01)', () => {
  test('no third-party requests and no cookies on a public page', async ({ page, context }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.hostname !== 'localhost') external.push(req.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});
