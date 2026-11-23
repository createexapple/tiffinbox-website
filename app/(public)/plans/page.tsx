import type { Metadata } from 'next';
import Link from 'next/link';
import { AddOnCard } from '@/components/public/AddOnCard';
import { PlanCard } from '@/components/public/PlanCard';
import { getMealsFromPrice, getPageCopy, getPlans, getPricingRules } from '@/content';
import { formatRs } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [plans, rules, mealsFrom] = await Promise.all([
    getPlans(),
    getPricingRules(),
    getMealsFromPrice(),
  ]);
  const names = plans.map((plan) => plan.name);
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
      : names.join('');
  return pageMetadata({
    title: 'Plans & Pricing',
    description: `Tiffin Box plans: ${list}.${
      mealsFrom === null ? '' : ` Meals start at ${formatRs(mealsFrom)}.`
    } Monthly plans save ${rules.monthlySavingPercent}%.`,
    path: '/plans',
  });
}

export default async function PlansPage() {
  const [plans, rules, copy] = await Promise.all([getPlans(), getPricingRules(), getPageCopy()]);

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Plans &amp; pricing</p>
        <h1 className="h1-page">Apna plan chunein.</h1>
        <p className="lede">{copy.plansLede}</p>
        <p className="muted">{copy.plansSub}</p>

        {plans.length === 0 ? (
          <div className="note-box mt-6">
            <p style={{ margin: 0 }}>
              Plans are being updated. Message us on WhatsApp and we will tell you what is
              available.
            </p>
          </div>
        ) : (
          <div className="grid plans-grid mt-6">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} deliveryIncluded={rules.deliveryCharge > 0} />
            ))}
          </div>
        )}

        <div className="grid c2 mt-6">
          {copy.planAddOns.map((card) => (
            <AddOnCard key={card.key} card={card} />
          ))}
        </div>

        <section className="mt-8" aria-labelledby="serving-h">
          <p className="eyebrow">{copy.servingEyebrow}</p>
          <h2 id="serving-h">{copy.servingHeadline}</h2>
          <div className="grid c3 mt-4">
            {copy.servingOptions.map((option) => (
              <article className="note-box serve" key={option.title}>
                <h3>{option.title}</h3>
                <p>{option.how}</p>
                {option.example ? (
                  <p className="example">
                    <b>Example:</b> {option.example}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <p className="muted mt-5">{copy.priceDisclaimer}</p>
        <div className="cta-row">
          <Link className="btn btn-secondary btn-lg" href="/customize">
            Customize a meal
          </Link>
          <Link className="btn btn-secondary btn-lg" href="/how-it-works">
            How payment works
          </Link>
        </div>
      </div>
    </section>
  );
}
