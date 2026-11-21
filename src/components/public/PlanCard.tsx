import type { Plan } from '@/content';
import { formatRs, formatRsRange } from '@/lib/format';

/** One plan (FR-07). Everything shown comes from the plan record; "Most popular" is words + star, not colour alone. */
export function PlanCard({ plan }: { plan: Plan }) {
  const headingId = `plan-${plan.id}`;
  return (
    <article className={plan.mostPopular ? 'plan popular' : 'plan'} aria-labelledby={headingId}>
      {plan.mostPopular ? <span className="badge-pop">&#9733; Most popular</span> : null}
      <h3 id={headingId}>{plan.name}</h3>
      <p className="for">{plan.audience}</p>
      <p className="price">
        {formatRsRange(plan.price.from, plan.price.to)} <small>per {plan.priceUnit}</small>
      </p>
      {plan.priceUnresolved ? (
        <p>
          <span className="tag">one confirmed price needed before launch (Q-08)</span>
        </p>
      ) : null}
      <ul>
        {plan.includes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="weekly">{formatRs(plan.weeklyPrice)} a week</p>
    </article>
  );
}
