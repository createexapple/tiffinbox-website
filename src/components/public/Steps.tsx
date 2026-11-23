import type { Step } from '@/content';

/** The three "how it works" steps (FR-05, FR-09). Ordered list; the numbered circles are decorative. */
export function Steps({ items }: { items: Step[] }) {
  return (
    <ol className="t-grid" data-steps style={{ listStyle: 'none', padding: 0 }}>
      {items.map((step, index) => (
        <li className="t-card" key={step.title}>
          <span className="t-num" aria-hidden="true">
            {index + 1}
          </span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
