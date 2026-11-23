import { expect, test, type Page } from '@playwright/test';
import { NOT_FOUND_PATH, PAGES } from './pages';

const ALL_PATHS = [...PAGES.map((p) => p.path), NOT_FOUND_PATH];

async function expectChrome(page: Page) {
  // FR-02 persistent WhatsApp button, FR-03 end-of-page Order button, FR-04 Instagram link.
  await expect(page.getByRole('link', { name: 'WhatsApp: start an order' })).toBeVisible();
  const order = page
    .locator('section.t-cta')
    .getByRole('link', { name: 'Order on WhatsApp', exact: true });
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
      await expect(page.locator('h1:visible')).toHaveCount(1);
      await expect(page.locator('h1:visible')).toBeVisible();
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
        .locator('section.t-cta')
        .evaluate((el) => el.nextElementSibling?.tagName ?? null);
      expect(nextTag).toBe('FOOTER');
      const mainEndsBefore = await page
        .locator('main')
        .evaluate((el) => el.nextElementSibling?.classList.contains('t-cta') ?? false);
      expect(mainEndsBefore).toBe(true);
    });
  }
});

test.describe('placeholder WhatsApp state (number not supplied yet)', () => {
  test('buttons never link to a broken wa.me URL and open a labelled note', async ({ page }) => {
    await page.goto('/');
    const links = [
      page.getByRole('link', { name: 'WhatsApp: start an order' }),
      page.locator('section.t-cta').getByRole('link', { name: 'Order on WhatsApp', exact: true }),
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
    await page.goto('/#about');
    await expect(page.getByText('[WhatsApp number]').first()).toBeVisible();
    await expect(page.getByText('[order hours]').first()).toBeVisible();
    await expect(page.getByText('Photo coming soon')).toHaveCount(0);
  });
});

test.describe('navigation (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('logo goes Home and the six links reach their pages with the current page marked', async ({
    page,
  }) => {
    await page.goto('/#about');
    await page.getByRole('link', { name: 'Tiffin Box, home' }).click();
    await expect(page).toHaveURL(/#home$/);

    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveCount(6);
    for (const target of PAGES) {
      await nav.getByRole('link', { name: target.nav, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${target.id}$`));
      await expect(page.locator('h1:visible')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: target.nav, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('there is no menu button: the links are visible in a row', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Menu' }),
    ).toBeVisible();
  });
});

test.describe('navigation (mobile, 360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('there is no menu button; the nav sits under the logo and scrolls sideways, and navigates', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link')).toHaveCount(6);
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    const logo = await page.getByRole('link', { name: 'Tiffin Box, home' }).boundingBox();
    const navBox = await nav.boundingBox();
    expect(navBox!.y).toBeGreaterThanOrEqual(logo!.y + logo!.height - 1);
    await nav.getByRole('link', { name: 'Plans & Pricing' }).scrollIntoViewIfNeeded();
    await nav.getByRole('link', { name: 'Plans & Pricing' }).click();
    await expect(page).toHaveURL(/#plans$/);
    await expect(page.locator('h1:visible')).toHaveText('Apna plan chunein.');
  });

  test('every nav entry is reachable on a phone', async ({ page }) => {
    for (const target of PAGES) {
      await page.goto('/');
      const link = page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: target.nav, exact: true });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${target.id}$`));
    }
  });

  test('the logo is at the top-left and goes Home', async ({ page }) => {
    await page.goto('/#menu');
    const logo = page.getByRole('link', { name: 'Tiffin Box, home' });
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    const header = await page.getByRole('banner').boundingBox();
    expect(box!.x).toBeLessThan(40);
    // Top-left of the header (the Stage 2 preview banner sits above the header).
    expect(box!.y - header!.y).toBeLessThan(20);
    await logo.click();
    await expect(page).toHaveURL(/#home$/);
  });

  test('tap targets are at least 44px high', async ({ page }) => {
    await page.goto('/');
    const targets = [
      page.getByRole('link', { name: 'Tiffin Box, home' }),
      page.getByRole('link', { name: 'WhatsApp: start an order' }),
      page.locator('section.t-cta').getByRole('link', { name: 'Order on WhatsApp', exact: true }),
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
    await page.goto('/#about');
    const items = page.locator('.t-faq details');
    expect(await items.count()).toBeGreaterThanOrEqual(5);
    await expect(page.locator('.t-faq details[open]')).toHaveCount(0);

    const first = items.first();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('p')).toBeVisible();
    await first.locator('summary').click();
    await expect(first).not.toHaveAttribute('open', '');

    // Several can be open at once.
    await items.nth(0).locator('summary').click();
    await items.nth(1).locator('summary').click();
    await expect(page.locator('.t-faq details[open]')).toHaveCount(2);
  });

  test('is operable with the keyboard (Tab, Enter, Space)', async ({ page }) => {
    await page.goto('/#about');
    const first = page.locator('.t-faq details').first();
    const summary = first.locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(first).not.toHaveAttribute('open', '');
  });

  test('summaries are at least 44px high', async ({ page }) => {
    await page.goto('/#about');
    const box = await page.locator('.t-faq summary').first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe('content from the content layer', () => {
  test('Home shows the headline, tagline, tags and five "Who we serve" cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:visible')).toHaveText('Bhook lagi? Khana hazir.');
    await expect(page.locator('h1 span')).toHaveText('Khana hazir.');
    await expect(page.getByText('Ghar ka khana, Ammi ke pyaar jaisa').first()).toBeVisible();
    await expect(page.getByText('delivered to your room, desk or door')).toBeVisible();
    await expect(page.locator('.t-tag')).toHaveText([
      'Meals from Rs 500, delivered',
      'Try 3 days for Rs 4,800',
    ]);
    await expect(page.locator('[data-audiences] .t-card h3')).toHaveText([
      'Hostel students',
      'Offices',
      "Can't cook at home",
      'Families and guests',
      'Night owls',
    ]);
    await expect(page.locator('[data-audiences] .t-card dt')).toHaveCount(0);
    await expect(page.locator('[data-audiences] .t-card.t-dark')).toContainText('Rs 900 a night');
    await expect(page.getByText('late night 11 PM to 1 AM').first()).toBeVisible();
    await expect(page.locator('#home ol[data-steps] li')).toHaveCount(3);
    await expect(
      page.getByRole('link', { name: 'Delivery times, skipping and payment' }),
    ).toBeVisible();
  });

  test('Home shows the drawn tiffin illustration while no hero photo is assigned', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.t-fig svg')).toBeVisible();
    await expect(page.locator('.t-fig img')).toHaveCount(0);
    await expect(page.locator('.t-fig svg .t-steam')).toHaveCount(3);
  });

  test('header and footer use the bundled logo; the favicon is the logo too', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.t-header img')).toHaveAttribute('src', '/brand/logo.png');
    await expect(page.locator('.t-header img')).toHaveAttribute('width', '58');
    await expect(page.locator('.t-footer img')).toHaveAttribute('src', '/brand/logo.png');
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute(
      'href',
      /\/brand\/logo\.png/,
    );
    const loaded = await page
      .locator('.t-header img')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test('Menu: heading from the week dates, day tabs, three cards per day, Monday first', async ({
    page,
  }) => {
    await page.goto('/#menu');
    await expect(page.getByText('This week', { exact: true })).toBeVisible();
    await expect(page.locator('h1:visible')).toHaveText('Menu for 23 to 29 November');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(7);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.first()).toHaveAccessibleName('Monday');
    const panel = page.getByRole('tabpanel');
    await expect(panel.locator('.t-card')).toHaveCount(3);
    await expect(panel.locator('.t-card h3')).toHaveText([
      'Aloo paratha, raita, chai',
      'Aloo qeema + roti',
      'Chicken biryani + raita',
    ]);
    await expect(panel.locator('.t-kick')).toHaveText([
      'Breakfast · 8 AM',
      'Lunch · 1 PM',
      'Dinner · 8 PM',
    ]);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').locator('.t-card h3').nth(2)).toHaveText(
      'Chicken qorma + roti',
    );
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('Menu tabs move with the arrow keys, Home and End', async ({ page }) => {
    await page.goto('/#menu');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(7);
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.nth(6)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.nth(6)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
  });

  test('Menu has the note under the cards, the Customize link and no photo placeholder', async ({
    page,
  }) => {
    await page.goto('/#menu');
    await expect(
      page.getByText(
        'Late-night meal (11 PM to 1 AM) is chosen from the dinner menu or the Customize list. Budget plan meals are daal or sabzi with 2 roti.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Photo coming soon')).toHaveCount(0);
    await page.getByRole('link', { name: "Don't like a dish? Customize it" }).click();
    await expect(page).toHaveURL(/#customize$/);
  });

  test('Plans shows five plan cards in order with chips, prices, totals and Choose buttons', async ({
    page,
  }) => {
    await page.goto('/#plans');
    await expect(page.locator('article.t-plan')).toHaveCount(5);
    await expect(page.locator('article.t-pop')).toHaveCount(1);
    await expect(page.locator('article.t-plan h3')).toHaveText([
      'Starter',
      'Budget',
      'Student',
      'Office Lunch',
      'All 3 Meals',
    ]);
    await expect(page.locator('article.t-plan .t-chip')).toHaveText([
      'New',
      'Cheapest',
      'Most popular',
    ]);
    await expect(page.locator('article.t-plan .t-per')).toHaveText([
      'Rs 800 a meal, delivery included',
      'Rs 500 a meal, delivery included',
      'Rs 750 to 800 a meal, delivery included',
      'Rs 750 a meal, delivery included',
      'Rs 2,100 a day, delivery included',
    ]);
    await expect(page.locator('article.t-plan .t-price')).toHaveText([
      'Rs 4,800 / 3 days',
      'Rs 7,000 / week',
      'Rs 10,850 / week',
      'Rs 4,500 / week',
      'Rs 14,700 / week',
    ]);
    await expect(page.locator('article.t-plan .t-btn')).toHaveText([
      'Choose Starter',
      'Choose Budget',
      'Choose Student',
      'Choose Office Lunch',
      'Choose All 3 Meals',
    ]);
    // The number is still a placeholder, so the buttons open the "number not set" note, never a broken wa.me link.
    await expect(page.locator('article.t-plan .t-btn').first()).toHaveAttribute('href', '#wa-note');
    await expect(
      page.getByText(
        'Meals start at Rs 500, including Rs 150 door-to-door delivery. Monthly plans save 5%. Prices are for one person.',
      ),
    ).toBeVisible();
  });

  test('Plans add-on cards: full-width dark late-night card with moon and price line', async ({
    page,
  }) => {
    await page.goto('/#plans');
    const night = page.locator('.t-card.t-dark.t-wide');
    await expect(night).toContainText('Late-night meal');
    await expect(night).toContainText(
      'Delivered 11 PM to 1 AM. Rs 650 meal + Rs 150 delivery + Rs 100 late-night. Add to any plan; order or skip before 9 PM.',
    );
    await expect(night).toContainText('Rs 900 a night');
    await expect(night.locator('svg')).toHaveCount(1);
    await expect(
      page.getByText('Paratha, egg and chai with any plan, Rs 550 a day, delivery included.'),
    ).toBeVisible();
    await expect(page.getByText('Monthly saves 5%')).toBeVisible();
    await expect(
      page.getByText('Pay before the month starts and save 5% compared with paying weekly.'),
    ).toBeVisible();
  });

  test("Who's eating?: Just me, Family or group with the People stepper, Guests coming", async ({
    page,
  }) => {
    await page.goto('/#plans');
    await expect(page.getByRole('heading', { name: "Who's eating?" })).toBeVisible();
    const radios = page.getByRole('radio');
    await expect(radios).toHaveCount(3);
    await expect(radios.first()).toBeChecked();
    const value = page.getByTestId('who-value');
    await expect(page.getByText('Rs 775 a meal')).toBeVisible();
    await expect(page.getByText('From Rs 550')).toBeVisible();
    await expect(value).toHaveText('Rs 10,850');
    await expect(page.getByText('14 meals × Rs 775 (Rs 625 meal + Rs 150 delivery)')).toBeVisible();
    const stepper = page.getByRole('button', { name: 'One person more' });
    await expect(stepper).toBeHidden();

    await page.locator('label.t-opt', { hasText: 'Family or group' }).click();
    await expect(stepper).toBeVisible();
    await expect(page.locator('.t-step output')).toHaveText('3');
    await expect(value).toHaveText('Rs 28,350');
    await expect(
      page.getByText('Each meal: Rs 625 × 3 + one Rs 150 delivery = Rs 2,025'),
    ).toBeVisible();
    await stepper.click();
    await expect(page.locator('.t-step output')).toHaveText('4');
    await expect(value).toHaveText('Rs 37,100');
    const less = page.getByRole('button', { name: 'One person fewer' });
    await less.click();
    await less.click();
    await expect(page.locator('.t-step output')).toHaveText('2');
    await expect(less).toBeDisabled();
    for (let i = 0; i < 9; i += 1) {
      if (await stepper.isEnabled()) await stepper.click();
    }
    await expect(page.locator('.t-step output')).toHaveText('10');
    await expect(stepper).toBeDisabled();

    await page.locator('label.t-opt', { hasText: 'Guests coming' }).click();
    await expect(stepper).toBeHidden();
    await expect(value).toHaveText('Rs 2,950');
    await expect(page.getByText('4 × Chicken biryani Rs 700 + one Rs 150 delivery')).toBeVisible();
    await expect(page.getByText('Example, 4 guests')).toBeVisible();

    await page.locator('label.t-opt', { hasText: 'Just me' }).click();
    await expect(value).toHaveText('Rs 10,850');
    await expect(
      page.getByText(
        'Example uses the Student plan (Rs 625 meal + Rs 150 delivery). Prices depend on supplier rates; we confirm your price on WhatsApp before you pay.',
      ),
    ).toBeVisible();
    // Placeholder number: the order button opens the note.
    await expect(page.getByRole('link', { name: 'Order on WhatsApp' }).first()).toHaveAttribute(
      'href',
      '#wa-note',
    );
  });

  test("Who's eating?: keyboard operable and its total is a live region", async ({ page }) => {
    await page.goto('/#plans');
    await expect(page.locator('#plans .t-total [aria-live="polite"]')).toHaveCount(1);
    await page.getByRole('radio').first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio').nth(1)).toBeChecked();
    await expect(page.getByTestId('who-value')).toHaveText('Rs 28,350');
    await page.getByRole('button', { name: 'One person more' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('who-value')).toHaveText('Rs 37,100');
  });

  test('Customize: heading, delivery line and the late-night sentence', async ({ page }) => {
    await page.goto('/#customize');
    await expect(page.locator('h1:visible')).toHaveText('Apni pasand ka khana.');
    await expect(
      page.getByText(
        'Swap any meal for a dish you love. Dish prices stay the same; Rs 150 delivery is added to every custom order, because we bring it to your door.',
      ),
    ).toBeVisible();
    await expect(page.getByText('(+Rs 100 late-night charge)')).toBeVisible();
  });

  test('Customize builder: default Chicken qorma + Raita, total updates with dish and add-ons', async ({
    page,
  }) => {
    await page.goto('/#customize');
    await expect(page.getByRole('heading', { name: 'Choose your dish' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add-ons' })).toBeVisible();
    await expect(page.locator('[data-price-row]')).toHaveCount(12);
    const total = page.getByTestId('meal-total');
    const lines = page.getByTestId('meal-lines');
    await expect(page.getByRole('radio', { name: /Chicken qorma/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Raita/ })).toBeChecked();
    await expect(total).toHaveText('Rs 880');
    await expect(lines).toContainText('Chicken qorma');
    await expect(lines).toContainText('Raita');
    await expect(lines).toContainText('Delivery to your door');

    await page.locator('label.t-opt', { hasText: 'Fried fish' }).click();
    await expect(total).toHaveText('Rs 980');
    await page.locator('label.t-chipbtn', { hasText: 'Achaar' }).click();
    await expect(total).toHaveText('Rs 1,010');
    await page.locator('label.t-chipbtn', { hasText: 'Raita' }).click();
    await expect(total).toHaveText('Rs 930');
    await expect(lines).not.toContainText('Raita');
    await expect(lines).toContainText('Achaar');
    // Placeholder number: the order button opens the note instead of a broken link.
    await expect(page.getByRole('link', { name: 'Order this on WhatsApp' })).toHaveAttribute(
      'href',
      '#wa-note',
    );
  });

  test('Customize builder is keyboard operable (arrow keys on dishes, Space on add-ons)', async ({
    page,
  }) => {
    await page.goto('/#customize');
    const total = page.getByTestId('meal-total');
    await page.getByRole('radio', { name: /Chicken qorma/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: /Aloo qeema/ })).toBeChecked();
    await expect(total).toHaveText('Rs 880');
    await page.getByRole('checkbox', { name: /Salad/ }).focus();
    await page.keyboard.press('Space');
    await expect(total).toHaveText('Rs 960');
  });

  test('How it works: steps, the delivery table with six rows, and four small blocks', async ({
    page,
  }) => {
    await page.goto('/#how');
    await expect(page.locator('h1:visible')).toHaveText('Ordering is easy.');
    await expect(
      page.getByText(
        'Starter, weekly or monthly. JazzCash, Easypaisa or bank transfer, before your days start.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delivery times and charges' })).toBeVisible();
    await expect(page.locator('table thead th')).toHaveText([
      'Meal',
      'Delivered by',
      'Skip before',
      'Delivery',
    ]);
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(0)).toContainText('Rs 150, included');
    await expect(rows.nth(1)).toContainText('1 PM');
    await expect(rows.nth(1)).toContainText('10 AM the same day');
    await expect(rows.nth(3)).toContainText('11 PM to 1 AM');
    await expect(rows.nth(3)).toContainText('Rs 150 + Rs 100 late-night');
    await expect(rows.nth(4)).toContainText('Family or group');
    await expect(rows.nth(4)).toContainText('One Rs 150 per address');
    await expect(rows.nth(5)).toContainText('Order 1 day ahead');
    await expect(rows.nth(5)).toContainText('One Rs 150 per order');
    await expect(page.locator('#how .t-grid').last().locator('h3')).toHaveText([
      'Skip a meal',
      'Pause your plan',
      'Packaging',
      'Payment',
    ]);
  });

  test('About: mission, three cards, hours from settings, no story, 12 questions', async ({
    page,
  }) => {
    await page.goto('/#about');
    await expect(page.getByText('Our mission: give people who live away from home')).toBeVisible();
    await expect(page.getByText('Our story')).toHaveCount(0);
    await expect(page.locator('#about .t-card h3')).toHaveText([
      'Where we deliver',
      'WhatsApp orders',
      'Instagram',
    ]);
    await expect(page.getByRole('link', { name: 'Message us' })).toBeVisible();
    await expect(
      page.getByText('Order hours: [order hours]; late-night orders until 9 PM.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible();
    await expect(page.locator('.t-faq details')).toHaveCount(12);
  });

  test('the footer has the QR code and "Scan to follow", no Urdu text, no sample-values line', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer.locator('[lang="ur"]')).toHaveCount(0);
    expect(await footer.innerText()).not.toMatch(/[؀-ۿ]/);
    await expect(footer).toContainText('Scan to follow');
    await expect(footer).toContainText('Ghar ka khana, Ammi ke pyaar jaisa.');
    await expect(footer).toContainText('Johar Town, Lahore (around UMT)');
    await expect(footer).toContainText('Hours: [order hours]');
    await expect(footer).not.toContainText('Sample number and hours');
    const qr = footer.getByRole('img', { name: 'QR code to Instagram @tiffinbox.lhr' });
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((el) => el.tagName.toLowerCase())).toBe('svg');
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
    await expect(page.locator('h1:visible')).toHaveText('Yeh page nahi mila.');
    await page.getByRole('link', { name: 'Go to Home' }).click();
    await expect(page).toHaveURL(/\/#home$/);
  });
});

test.describe('SEO (NFR-04)', () => {
  test('one canonical URL, one title, one description and Open Graph set for the whole site', async ({
    page,
  }) => {
    const seen = new Set<string>();
    for (const target of PAGES) {
      await page.goto(target.path);
      const title = await page.title();
      expect(title).toBe('Tiffin Box | Ghar ka khana in Johar Town, Lahore');
      seen.add(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /^https?:\/\/[^/]+\/?$/,
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
    }
    expect(seen.size).toBe(1);
  });

  test('the Home description is derived from the lowest plan price', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Meals from Rs 500/,
    );
  });

  test('sitemap lists the one page; robots blocks crawlers by default', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap.match(/<loc>/g)).toHaveLength(1);
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \//);
  });

  test('pages are noindex unless indexing is switched on', async ({ page }) => {
    await page.goto('/#menu');
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

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('Menu shows all seven days under their names', async ({ page }) => {
    await page.goto('/#menu');
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.locator('h2.t-day-name')).toHaveText([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    await expect(page.getByText('Chicken qorma + roti').first()).toBeVisible();
    await expect(page.getByText('Saag + roti')).toBeVisible();
  });

  test('Customize and Plans are readable with the default state rendered by the server', async ({
    page,
  }) => {
    await page.goto('/#customize');
    await expect(page.getByTestId('meal-total')).toHaveText('Rs 880');
    await expect(page.locator('[data-price-row]')).toHaveCount(12);
    await expect(page.getByText('Fried fish', { exact: true })).toBeVisible();
    await page.goto('/#plans');
    await expect(page.getByTestId('who-value')).toHaveText('Rs 10,850');
  });
});

test.describe('colour scheme: the public site follows the system, the admin stays light', () => {
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
  };

  test('light and dark backgrounds on the public site', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await page.locator('.tb').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      rgb('#faf6ee'),
    );
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await page.locator('.tb').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      rgb('#0e1712'),
    );
    expect(
      await page
        .locator('.t-card')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(rgb('#182a20'));
  });

  test('the admin login page is the same in dark mode as in light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/admin/login');
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dark).toBe(light);
    expect(await page.locator('.tb').count()).toBe(0);
  });
});

test.describe('one page, six sections (hash routing)', () => {
  test('server HTML contains all six sections, each with its heading', async ({ request }) => {
    const html = await (await request.get('/')).text();
    for (const id of ['home', 'menu', 'plans', 'customize', 'how', 'about']) {
      expect(html, id).toMatch(new RegExp(`<section id="${id}" class="t-section">`));
    }
    for (const heading of [
      'Bhook lagi?',
      'Menu for 23 to 29 November',
      'Apna plan chunein.',
      'Apni pasand ka khana.',
      'Ordering is easy.',
      'Ghar se door, ghar ka swaad.',
    ]) {
      expect(html.replace(/<!-- -->/g, ''), heading).toContain(heading);
    }
  });

  test('home is shown by default and only the section of the hash is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home')).toBeVisible();
    for (const id of ['menu', 'plans', 'customize', 'how', 'about']) {
      await expect(page.locator(`#${id}`)).toBeHidden();
    }
    await page.goto('/#plans');
    await expect(page.locator('#plans')).toBeVisible();
    await expect(page.locator('#home')).toBeHidden();
    await expect(page.locator('h1:visible')).toHaveText('Apna plan chunein.');
    await page.goto('/#no-such-section');
    await expect(page.locator('#home')).toBeVisible();
  });

  test('nav links switch the section, mark it current, scroll to the top and move focus to its heading', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await page.mouse.wheel(0, 600);
    await nav.getByRole('link', { name: 'Customize', exact: true }).click();
    await expect(page.locator('#customize')).toBeVisible();
    await expect(page.locator('#home')).toBeHidden();
    await expect(nav.getByRole('link', { name: 'Customize', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('#customize h1')).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
  });

  test("buttons inside the page switch sections too (See plans, This week's menu, Customize it)", async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'See plans' }).click();
    await expect(page.locator('#plans')).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: "This week's menu" }).click();
    await expect(page.locator('#menu')).toBeVisible();
    await page.getByRole('link', { name: "Don't like a dish? Customize it" }).click();
    await expect(page.locator('#customize')).toBeVisible();
    await page.goto('/');
    await page.getByRole('link', { name: 'Delivery times, skipping and payment' }).click();
    await expect(page.locator('#how')).toBeVisible();
  });

  test('browser back and forward move between sections', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: 'Menu', exact: true }).click();
    await nav.getByRole('link', { name: 'Plans & Pricing' }).click();
    await expect(page.locator('#plans')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Menu', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.goForward();
    await expect(page.locator('#plans')).toBeVisible();
    await page.goBack();
    await page.goBack();
    await expect(page.locator('#home')).toBeVisible();
  });

  test('the old page addresses redirect permanently to their section', async ({
    request,
    page,
  }) => {
    const cases: [string, string][] = [
      ['/menu', '/#menu'],
      ['/plans', '/#plans'],
      ['/customize', '/#customize'],
      ['/how-it-works', '/#how'],
      ['/about', '/#about'],
    ];
    for (const [from, to] of cases) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(response.headers()['location'], from).toBe(to);
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to.replace('/', '\\/')}$`));
      await expect(page.locator(`${to.slice(1)}`)).toBeVisible();
    }
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('every section is visible, stacked in order, and the anchors work', async ({ page }) => {
      await page.goto('/');
      for (const id of ['home', 'menu', 'plans', 'customize', 'how', 'about']) {
        await expect(page.locator(`#${id}`)).toBeVisible();
      }
      const tops = await page.evaluate(() =>
        ['home', 'menu', 'plans', 'customize', 'how', 'about'].map(
          (id) => document.getElementById(id)!.getBoundingClientRect().top,
        ),
      );
      expect([...tops].sort((a, b) => a - b)).toEqual(tops);
      await page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link', { name: 'How it works' })
        .click();
      await expect(page).toHaveURL(/#how$/);
    });
  });
});
