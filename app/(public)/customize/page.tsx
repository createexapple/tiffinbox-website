import type { Metadata } from 'next';
import Link from 'next/link';
import { NoteBox } from '@/components/public/NoteBox';
import { PriceRow } from '@/components/public/PriceRow';
import { getAddOns, getCustomDishes, getPageCopy } from '@/content';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Customize your meal',
  description:
    'Swap any meal for another dish and add extras like raita, salad and shami kebab. See custom dish and add-on prices.',
  path: '/customize',
});

export default async function CustomizePage() {
  const [dishes, addOns, copy] = await Promise.all([getCustomDishes(), getAddOns(), getPageCopy()]);
  const updating = 'Add-ons are being updated. Ask us on WhatsApp what extras are available today.';

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Customize</p>
        <h1 className="h1-page">Apni pasand ka khana.</h1>
        <p className="lede">{copy.customizeIntro}</p>

        {dishes.length === 0 && addOns.length === 0 ? (
          <div className="mt-6">
            <NoteBox>
              Dishes and add-ons are being updated. Ask us on WhatsApp what is available today.
            </NoteBox>
          </div>
        ) : (
          <div className="grid c2 mt-6" style={{ alignItems: 'start' }}>
            <div>
              <h2 className="h2-sub">Custom dishes</h2>
              {dishes.length === 0 ? (
                <NoteBox>
                  Custom dishes are being updated. Ask us on WhatsApp what is available today.
                </NoteBox>
              ) : (
                <ul className="list-plain">
                  {dishes.map((dish) => (
                    <PriceRow
                      key={dish.id}
                      name={dish.name}
                      comesWith={dish.comesWith}
                      price={dish.price}
                    />
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="h2-sub">Add-ons</h2>
              {addOns.length === 0 ? (
                <NoteBox>{updating}</NoteBox>
              ) : (
                <ul className="list-plain chips">
                  {addOns.map((addOn) => (
                    <PriceRow key={addOn.id} name={addOn.name} price={addOn.price} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="cta-row">
          <Link className="btn btn-secondary btn-lg" href="/menu">
            Back to this week’s menu
          </Link>
          <Link className="btn btn-secondary btn-lg" href="/plans">
            Plans &amp; pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
