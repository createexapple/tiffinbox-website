import type { Metadata } from 'next';
import Link from 'next/link';
import { NoteBox } from '@/components/public/NoteBox';
import { Steps } from '@/components/public/Steps';
import { getPageCopy } from '@/content';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'How it works',
  description:
    'Order in three steps. Delivery times, how to skip a meal, how to pause your plan, and how to pay.',
  path: '/how-it-works',
});

export default async function HowItWorksPage() {
  const copy = await getPageCopy();
  const { howItWorks: how, steps } = copy;

  return (
    <>
      <section className="section">
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h1 className="h1-page">{how.headline}</h1>
          <p className="lede">{how.lede}</p>
          <Steps items={steps.items} />
          <p className="muted mt-5">{how.weeklyMenuLine}</p>
        </div>
      </section>

      <section className="section alt">
        <div className="wrap narrow centered">
          <h2>Delivery times and charges</h2>
          <table className="rt delivery-table">
            <caption className="sr-only">
              Delivery time, skip cut-off and delivery charge for each kind of order
            </caption>
            <thead>
              <tr>
                <th scope="col">Meal</th>
                <th scope="col">Delivered by</th>
                <th scope="col">Skip before</th>
                <th scope="col">Delivery charge</th>
              </tr>
            </thead>
            <tbody>
              {how.deliveryRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.meal}</th>
                  <td data-label="Delivered by">{row.deliveredBy}</td>
                  <td data-label="Skip before">{row.skipBefore}</td>
                  <td data-label="Delivery charge">{row.charge}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="stack mt-5">
            <NoteBox title="Skip a meal">{how.skip}</NoteBox>
            <NoteBox title="Pause your plan">{how.pause}</NoteBox>
            <NoteBox title="Packaging">{how.packaging}</NoteBox>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap narrow centered">
          <h2>Payment</h2>
          <p>{how.paymentIntro}</p>
          <ul>
            {how.paymentPoints.map((point) => (
              <li key={point.label}>
                <b>{point.label}:</b> {point.text}
              </li>
            ))}
          </ul>
          <div className="cta-row">
            <Link className="btn btn-secondary btn-lg" href="/plans">
              Plans &amp; pricing
            </Link>
            <Link className="btn btn-secondary btn-lg" href="/about">
              More questions?
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
