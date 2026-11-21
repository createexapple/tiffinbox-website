import type { FaqItem } from '@/content';

/** FR-11 FAQ. Native details/summary: keyboard operable (Enter/Space) with no JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.id}>
          <summary>{item.question}</summary>
          <div className="ans">
            <p style={{ margin: 0 }}>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
