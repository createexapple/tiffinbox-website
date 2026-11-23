import { AddOnCard } from '@/components/public/AddOnCard';
import { WhoEating } from '@/components/public/WhoEating';
import { PlanCard } from '@/components/public/PlanCard';
import {
  getCustomDishes,
  getPageCopy,
  getPlans,
  getPricingRules,
  getSiteSettings,
} from '@/content';
import { whoEatingInput, whoNote } from '@/content/orders';
import { planMessage } from '@/lib/order-math';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export async function PlansSection() {
  const [plans, rules, copy, dishes, settings] = await Promise.all([
    getPlans(),
    getPricingRules(),
    getPageCopy(),
    getCustomDishes(),
    getSiteSettings(),
  ]);
  const who = whoEatingInput(plans, dishes, rules.deliveryCharge);

  return (
    <div className="t-band">
      <div className="t-wrap">
        <span className="t-kick">Plans &amp; pricing</span>
        <h1>Apna plan chunein.</h1>
        <p className="t-lead">{copy.plansLede}</p>

        {plans.length === 0 ? (
          <div className="t-card" style={{ marginTop: 26 }}>
            <p>
              Plans are being updated. Message us on WhatsApp and we will tell you what is
              available.
            </p>
          </div>
        ) : (
          <div className="t-grid">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                deliveryIncluded={rules.deliveryCharge > 0}
                chooseLink={buildWhatsAppLink(settings.whatsappNumber, planMessage(plan.name))}
              />
            ))}
          </div>
        )}

        <div className="t-grid">
          {copy.planAddOns.map((card) => (
            <AddOnCard key={card.key} card={card} />
          ))}
        </div>

        {who ? (
          <>
            <h2 style={{ marginTop: 56 }}>Who&apos;s eating?</h2>
            <WhoEating input={who} note={whoNote(who)} />
          </>
        ) : (
          <p className="t-note">{copy.priceDisclaimer}</p>
        )}
      </div>
    </div>
  );
}
