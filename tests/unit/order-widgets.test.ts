/* eslint-disable react/no-children-prop -- createElement cannot take children as an argument for this typed provider */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MealBuilder } from '@/components/public/MealBuilder';
import { WhoEating } from '@/components/public/WhoEating';
import { WhatsAppProvider } from '@/components/public/whatsapp-context';
import { MOCK_CONTENT } from '@/content/mock';
import { builderDefaults, whoEatingInput, whoNote } from '@/content/orders';
import { buildWhatsAppLink } from '@/lib/whatsapp';

const ready = buildWhatsAppLink('+92 300 1234567');
const placeholder = buildWhatsAppLink('[WhatsApp number]');

function builder(link: typeof ready) {
  const d = builderDefaults(MOCK_CONTENT.customDishes, MOCK_CONTENT.addOns);
  return renderToStaticMarkup(
    createElement(WhatsAppProvider, {
      link,
      children: createElement(MealBuilder, {
        dishes: MOCK_CONTENT.customDishes,
        addOns: MOCK_CONTENT.addOns,
        delivery: 150,
        defaultDishId: d.dishId,
        defaultAddOnIds: d.addOnIds,
      }),
    }),
  );
}

function who(link: typeof ready) {
  const input = whoEatingInput(MOCK_CONTENT.plans, MOCK_CONTENT.customDishes, 150)!;
  return renderToStaticMarkup(
    createElement(WhatsAppProvider, {
      link,
      children: createElement(WhoEating, { input, note: whoNote(input) }),
    }),
  );
}

describe('server-rendered default state (what a visitor without JavaScript sees)', () => {
  it('Customize: Chicken qorma + Raita, total Rs 880, plain radios and checkboxes', () => {
    const html = builder(ready);
    expect(html).toContain('Rs 880');
    expect(html).toMatch(/<input[^>]*type="radio"[^>]*name="dish"[^>]*checked/);
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked/);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(6);
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(6);
    expect(html).toContain('Delivery to your door');
  });

  it('Customize: the order button carries the prefilled message with the total', () => {
    const html = builder(ready);
    expect(html).toContain(
      'href="https://wa.me/923001234567?text=HI%20Tiffin%20Box%2C%20I%20want%20Chicken%20qorma%20with%20Raita.%20Total%20Rs%20880."',
    );
  });

  it('Customize: with a placeholder number the button opens the note, not a broken link', () => {
    const html = builder(placeholder);
    expect(html).toContain('href="#wa-note"');
    expect(html).not.toContain('wa.me');
  });

  it("Who's eating?: starts on Just me with the weekly price and the order message", () => {
    const html = who(ready);
    expect(html).toContain('Rs 10,850');
    expect(html).toContain('14 meals × Rs 775');
    expect(html).toContain('From Rs 550');
    expect(html).toContain('HI%20Tiffin%20Box%2C%20Student%20plan%20for%201%20person.');
    expect(html).toMatch(/class="t-step" hidden/);
    expect(who(placeholder)).toContain('href="#wa-note"');
  });
});
