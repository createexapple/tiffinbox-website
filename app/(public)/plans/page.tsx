import type { Metadata } from 'next';
import Link from 'next/link';
import { NoteBox } from '@/components/public/NoteBox';
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

        {plans.length === 0 ? (
          <div className="note-box mt-6">
            <p style={{ margin: 0 }}>
              Plans are being updated. Message us on WhatsApp and we will tell you what is
              available.
            </p>
          </div>
        ) : (
          <div className="grid c4 mt-6">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}

        <div className="grid c3 mt-6">
          <NoteBox title={`Monthly saves ${rules.monthlySavingPercent}%`}>
            Pay monthly, before the month starts, and save {rules.monthlySavingPercent}% compared
            with paying weekly.
          </NoteBox>
          <NoteBox title="Office team deal">
            Offices with {rules.teamDeal.minPeople} or more people get {rules.teamDeal.text}.
          </NoteBox>
          <NoteBox title="Add breakfast">
            Breakfast can be added to any plan for {formatRs(rules.breakfastAddOnPerDay)} a day.
          </NoteBox>
        </div>
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
