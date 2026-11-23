'use client';

import { useState } from 'react';
import { formatRs } from '@/lib/format';
import {
  DEFAULT_GROUP_PEOPLE,
  MAX_GROUP_PEOPLE,
  MIN_GROUP_PEOPLE,
  clampGroupPeople,
  guestsFrom,
  whoResult,
  type WhoInput,
  type WhoMode,
} from '@/lib/order-math';
import { withWhatsAppMessage } from '@/lib/whatsapp';
import { useWhatsAppLink } from './whatsapp-context';

/**
 * "Who's eating?" (design): Just me, Family or group (with a People stepper) or Guests coming, and a green total
 * panel with an Order on WhatsApp button. All figures come from `input`, which is built from plan, pricing and dish
 * data (src/content/orders.ts); the math is in src/lib/order-math.ts. Server-rendered with "Just me" selected, so the
 * page is useful without JavaScript.
 */
export function WhoEating({ input, note }: { input: WhoInput; note: string }) {
  const [mode, setMode] = useState<WhoMode>('me');
  const [people, setPeople] = useState(DEFAULT_GROUP_PEOPLE);
  const link = useWhatsAppLink();

  const from = guestsFrom(input);
  const options: { mode: WhoMode; title: string; sub: string; side: string }[] = [
    {
      mode: 'me',
      title: 'Just me',
      sub: 'One meal, one delivery',
      side: `${formatRs(input.mealPrice)} a meal`,
    },
    {
      mode: 'family',
      title: 'Family or group',
      sub:
        input.delivery > 0
          ? `Same address, one ${formatRs(input.delivery)} delivery for everyone`
          : 'Same address, one order for everyone',
      side: 'Shared delivery',
    },
  ];
  if (input.guestDish) {
    options.push({
      mode: 'guests',
      title: 'Guests coming',
      sub: 'One-time order, each guest picks a dish, order 1 day ahead',
      side: from === null ? '' : `From ${formatRs(from)}`,
    });
  }

  const active = whoResult(input, mode, people) ?? whoResult(input, 'me', people)!;
  const order = withWhatsAppMessage(link, active.message);

  return (
    <div className="t-two">
      <fieldset className="t-opts" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Who is eating</legend>
        {options.map((option) => (
          <div key={option.mode} style={{ display: 'contents' }}>
            <label className="t-opt">
              <input
                type="radio"
                name="who"
                value={option.mode}
                checked={mode === option.mode}
                onChange={() => setMode(option.mode)}
              />
              <span>
                <b>{option.title}</b>
                <small>{option.sub}</small>
              </span>
              <b className="t-p">{option.side}</b>
            </label>
            {option.mode === 'family' ? (
              <div className="t-step" hidden={mode !== 'family'}>
                <span id="people-label">People</span>
                <button
                  type="button"
                  aria-label="One person fewer"
                  aria-describedby="people-label"
                  disabled={people <= MIN_GROUP_PEOPLE}
                  onClick={() => setPeople(clampGroupPeople(people - 1))}
                >
                  −
                </button>
                <output aria-labelledby="people-label">{people}</output>
                <button
                  type="button"
                  aria-label="One person more"
                  aria-describedby="people-label"
                  disabled={people >= MAX_GROUP_PEOPLE}
                  onClick={() => setPeople(clampGroupPeople(people + 1))}
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </fieldset>
      <div className="t-total">
        <div className="t-live" aria-live="polite" aria-atomic="true">
          <span>{active.label}</span>
          <span className="t-big" data-testid="who-value">
            {active.value}
          </span>
          {active.note ? <span className="t-sum-note">{active.note}</span> : null}
        </div>
        <a
          className="t-btn t-gold"
          href={order.href}
          {...(order.ready ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          Order on WhatsApp
        </a>
      </div>
      <p className="t-note" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
        {note}
      </p>
    </div>
  );
}
