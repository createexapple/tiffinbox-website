import type { FaqItem } from '@/content';

/** FR-11 FAQ. Native details/summary: keyboard operable (Enter/Space) with no JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="t-faq">
      {items.map((item) => (
        <details key={item.id}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
