import type { Step } from '@/content';

/** The three "how it works" steps (FR-05, FR-09). Ordered list; numbers are decorative. */
export function Steps({ items }: { items: Step[] }) {
  return (
    <ol className="steps row">
      {items.map((step, index) => (
        <li className="card" key={step.title}>
          <span className="num" aria-hidden="true">
            {index + 1}
          </span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
