import { MealBuilder } from '@/components/public/MealBuilder';
import { getAddOns, getCustomDishes, getPageCopy, getPricingRules } from '@/content';
import { builderDefaults } from '@/content/orders';

export async function CustomizeSection() {
  const [dishes, addOns, copy, rules] = await Promise.all([
    getCustomDishes(),
    getAddOns(),
    getPageCopy(),
    getPricingRules(),
  ]);
  const defaults = builderDefaults(dishes, addOns);

  return (
    <div className="t-band">
      <div className="t-wrap">
        <span className="t-kick">Customize</span>
        <h1>Apni pasand ka khana.</h1>
        <p className="t-lead">{copy.customizeIntro}</p>

        {dishes.length === 0 ? (
          <div className="t-card" style={{ marginTop: 26 }}>
            <p>Dishes and add-ons are being updated. Ask us on WhatsApp what is available today.</p>
          </div>
        ) : (
          <MealBuilder
            dishes={dishes}
            addOns={addOns}
            delivery={rules.deliveryCharge}
            defaultDishId={defaults.dishId}
            defaultAddOnIds={defaults.addOnIds}
          />
        )}
        {copy.customizeLateNight ? <p className="t-note">{copy.customizeLateNight}</p> : null}
      </div>
    </div>
  );
}
