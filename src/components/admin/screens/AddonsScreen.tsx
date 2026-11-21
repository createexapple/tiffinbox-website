'use client';

import { formatRs } from '@/lib/format';
import { ListManager } from '../ListManager';
import { AddonForm } from '../RowForms';

/** A-06 (FR-18). */
export function AddonsScreen() {
  return (
    <ListManager
      title="Add-ons"
      sub="Drafts only until you publish. Use the arrows to reorder (works with keyboard and phone)."
      noun="add-on"
      addLabel="Add add-on"
      emptyTitle="No add-ons yet"
      emptyText="Add small extras such as raita or extra roti. They appear on Customize after you publish."
      collection={(repo) => repo.addons}
      columns={[
        { header: 'Add-on', cell: (a) => a.name },
        { header: 'Price', cell: (a) => formatRs(a.price), className: 'num' },
      ]}
      rowName={(a) => a.name}
      Form={AddonForm}
      deleteTitle="Delete this add-on?"
      deleteBody={(a) => (
        <p>
          “{a.name}” will be removed from the Customize page after you publish. This cannot be
          undone, but you can add it again. To keep it but not show it, use Hidden instead.
        </p>
      )}
    />
  );
}
