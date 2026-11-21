'use client';

import { ListManager } from '../ListManager';
import { FaqForm } from '../RowForms';

function excerpt(text: string): string {
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

/** A-07 (FR-19). */
export function FaqScreen() {
  return (
    <ListManager
      title="FAQ"
      sub="Drafts only until you publish. Use the arrows to reorder (works with keyboard and phone)."
      noun="question"
      addLabel="Add question"
      emptyTitle="No questions yet"
      emptyText="Add answers to what customers ask most. They appear on About & Contact after you publish."
      collection={(repo) => repo.faq}
      columns={[
        { header: 'Question', cell: (f) => f.question },
        { header: 'Answer', cell: (f) => excerpt(f.answer) },
      ]}
      rowName={(f) => f.question}
      Form={FaqForm}
      deleteTitle="Delete this question?"
      deleteBody={() => (
        <p>
          This question and its answer will be removed from About &amp; Contact after you publish.
        </p>
      )}
    />
  );
}
