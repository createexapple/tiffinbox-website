'use client';

import { formatRs } from '@/lib/format';
import { ListManager } from '../ListManager';
import { DishForm } from '../RowForms';

/** A-05 (FR-17, FR-21). */
export function DishesScreen() {
  return (
    <ListManager
      title="Custom dishes"
      sub="Drafts only until you publish. Use the arrows to reorder (works with keyboard and phone)."
      noun="dish"
      addLabel="Add dish"
      emptyTitle="No custom dishes yet"
      emptyText="Add the dishes customers can swap into their plan. They appear on Customize after you publish."
      collection={(repo) => repo.dishes}
      columns={[
        { header: 'Dish', cell: (d) => d.name },
        { header: 'Comes with', cell: (d) => d.comesWith || '–' },
        { header: 'Price', cell: (d) => formatRs(d.price), className: 'num' },
      ]}
      rowName={(d) => d.name}
      Form={DishForm}
      deleteTitle="Delete this dish?"
      deleteBody={(d) => (
        <p>
          “{d.name}” will be removed from the Customize page after you publish. This cannot be
          undone, but you can add it again. To keep it but not show it, use Hidden instead.
        </p>
      )}
    />
  );
}
