'use client';

import { useState } from 'react';
import { formatRs } from '@/lib/format';
import { builderMessage, builderResult } from '@/lib/order-math';
import { withWhatsAppMessage } from '@/lib/whatsapp';
import { useWhatsAppLink } from './whatsapp-context';

interface Item {
  id: string;
  name: string;
  price: number;
  comesWith?: string;
}

/**
 * Customize builder (design): radio options for the dish, toggle chips for add-ons, and a green "Your meal" panel with
 * the total and an Order this on WhatsApp button. The lists are the form: they are plain labelled radios and
 * checkboxes, readable without JavaScript, and the server renders the default selection and its total.
 * Money comes from the props (content data); the sums and the message are in src/lib/order-math.ts.
 */
export function MealBuilder({
  dishes,
  addOns,
  delivery,
  defaultDishId,
  defaultAddOnIds,
}: {
  dishes: Item[];
  addOns: Item[];
  delivery: number;
  defaultDishId: string | null;
  defaultAddOnIds: string[];
}) {
  const [dishId, setDishId] = useState(defaultDishId);
  const [selected, setSelected] = useState<string[]>(defaultAddOnIds);
  const link = useWhatsAppLink();

  const result = builderResult(dishes, addOns, dishId, selected, delivery);
  const order = withWhatsAppMessage(link, builderMessage(result));
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <div className="t-two">
      <div>
        <h2 className="t-sub" id="dish-h">
          Choose your dish
        </h2>
        <fieldset className="t-opts" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Dish</legend>
          {dishes.map((dish) => (
            <label data-price-row className="t-opt" key={dish.id}>
              <input
                type="radio"
                name="dish"
                value={dish.id}
                checked={dishId === dish.id}
                onChange={() => setDishId(dish.id)}
              />
              <span>
                <b>{dish.name}</b>
                {dish.comesWith ? <small>{dish.comesWith}</small> : null}
              </span>
              <b className="t-p">{formatRs(dish.price)}</b>
            </label>
          ))}
        </fieldset>
        {addOns.length > 0 ? (
          <>
            <h2 className="t-sub" id="addon-h">
              Add-ons
            </h2>
            <fieldset className="t-chips" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="sr-only">Add-ons</legend>
              {addOns.map((addOn) => (
                <label data-price-row className="t-chipbtn" key={addOn.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(addOn.id)}
                    onChange={() => toggle(addOn.id)}
                  />
                  <span>{addOn.name}</span>
                  <small>+ {formatRs(addOn.price)}</small>
                </label>
              ))}
            </fieldset>
          </>
        ) : null}
      </div>
      <div className="t-total">
        <div className="t-live" aria-live="polite" aria-atomic="true">
          <span>Your meal</span>
          <span className="t-big" data-testid="meal-total">
            {formatRs(result.total)}
          </span>
          <div className="t-lines" data-testid="meal-lines">
            {result.lines.map((line) => (
              <span className="t-ln" key={line.label}>
                <span>{line.label}</span>
                <span>{formatRs(line.amount)}</span>
              </span>
            ))}
          </div>
        </div>
        <a
          className="t-btn t-gold"
          href={order.href}
          {...(order.ready ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          Order this on WhatsApp
        </a>
      </div>
    </div>
  );
}
