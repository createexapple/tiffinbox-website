import type { Plan } from '@/content';
import { formatRs, formatRsRange } from '@/lib/format';

/**
 * One plan (FR-07, CR-004). Everything shown comes from the plan record: the tag badge, the price per meal (a range
 * when the plan has one), a delivery line and the total for the period ("a week" unless the plan says otherwise).
 * The tag is words (plus a star for the most popular plan), not colour alone.
 */
export function PlanCard({ plan, deliveryIncluded }: { plan: Plan; deliveryIncluded: boolean }) {
  const headingId = `plan-${plan.id}`;
  return (
    <article className={plan.mostPopular ? 'plan popular' : 'plan'} aria-labelledby={headingId}>
      {plan.tag !== '' ? (
        <span className="badge-pop">
          {plan.mostPopular ? <>&#9733; </> : null}
          {plan.tag}
        </span>
      ) : null}
      <h3 id={headingId}>{plan.name}</h3>
      <p className="for">{plan.audience}</p>
      <p className="price">
        {formatRsRange(plan.price.from, plan.price.to)} <small>per {plan.priceUnit}</small>
      </p>
      {deliveryIncluded ? <p className="incl">Delivery included</p> : null}
      <ul>
        {plan.includes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="weekly">
        {formatRs(plan.weeklyPrice)} {plan.periodLabel !== '' ? plan.periodLabel : 'a week'}
      </p>
    </article>
  );
}
