import type { Plan } from '@/content';
import { formatRs, formatRsRange } from '@/lib/format';
import type { WhatsAppLink } from '@/lib/whatsapp';

/**
 * One plan card (design): tag chip, name, audience, what is included, the per-meal (or per-day) price with
 * "delivery included", the total for the period ("/ week" unless the plan says otherwise) and a "Choose <plan>"
 * button that opens WhatsApp with the plan named. The most popular plan is the filled green card with a gold price.
 * Everything comes from the plan record.
 */
export function PlanCard({
  plan,
  deliveryIncluded,
  chooseLink,
}: {
  plan: Plan;
  deliveryIncluded: boolean;
  chooseLink: WhatsAppLink;
}) {
  const headingId = `plan-${plan.id}`;
  const period = plan.periodLabel !== '' ? plan.periodLabel.replace(/^for\s+/i, '') : 'week';
  const external = chooseLink.ready ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <article
      className={plan.mostPopular ? 't-card t-plan t-pop' : 't-card t-plan'}
      aria-labelledby={headingId}
    >
      {plan.tag !== '' ? <span className="t-chip">{plan.tag}</span> : null}
      <h3 id={headingId}>{plan.name}</h3>
      <p>{plan.audience}</p>
      <p>{plan.includes.join(', ')}</p>
      <span className="t-per">
        {formatRsRange(plan.price.from, plan.price.to).replace('–', ' to ')} a {plan.priceUnit}
        {deliveryIncluded ? ', delivery included' : ''}
      </span>
      <span className="t-price">
        {formatRs(plan.weeklyPrice)} <small>/ {period}</small>
      </span>
      <a
        className={plan.mostPopular ? 't-btn t-gold' : 't-btn t-line'}
        href={chooseLink.href}
        {...external}
      >
        Choose {plan.name}
        {chooseLink.ready ? <span className="sr-only"> (opens in a new tab)</span> : null}
      </a>
    </article>
  );
}
