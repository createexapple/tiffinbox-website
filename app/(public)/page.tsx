import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/public/JsonLd';
import { PagePhoto } from '@/components/public/PagePhoto';
import { Steps } from '@/components/public/Steps';
import { getMealsFromPrice, getPageCopy, getPageImages, getSiteSettings } from '@/content';
import { formatRs } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';
import { getSiteUrl, isSiteUrlConfigured } from '@/lib/site-url';
import { buildFoodEstablishmentJsonLd } from '@/lib/structured-data';

export async function generateMetadata(): Promise<Metadata> {
  const mealsFrom = await getMealsFromPrice();
  return pageMetadata({
    title: 'Home',
    absoluteTitle: 'Tiffin Box | Ghar ka khana in Johar Town, Lahore',
    description: `Weekly home-style meal subscription for hostel students and offices in Johar Town, Lahore.${
      mealsFrom === null ? '' : ` Meals from ${formatRs(mealsFrom)}.`
    }`,
    path: '/',
  });
}

export default async function HomePage() {
  const [copy, settings, mealsFrom, pageImages] = await Promise.all([
    getPageCopy(),
    getSiteSettings(),
    getMealsFromPrice(),
    getPageImages(),
  ]);
  const { home, steps } = copy;

  return (
    <>
      <JsonLd
        data={buildFoodEstablishmentJsonLd(settings, isSiteUrlConfigured() ? getSiteUrl() : null)}
      />
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">{home.eyebrow}</p>
            <h1>{home.headline}</h1>
            <p className="tagline">{home.tagline}</p>
            <p className="lede">{home.lede}</p>
            {mealsFrom === null ? null : (
              <p>
                <span className="chip">Meals from {formatRs(mealsFrom)}</span>
              </p>
            )}
            <div className="cta-row">
              <Link className="btn btn-secondary btn-lg" href="/plans">
                See plans
              </Link>
              <Link className="btn btn-secondary btn-lg" href="/menu">
                This week’s menu
              </Link>
            </div>
          </div>
          <PagePhoto
            image={pageImages.homeHero}
            description="tiffin boxes with steaming food (hero)"
            priority
          />
        </div>
      </section>

      <section className="section alt" aria-labelledby="ben-h">
        <div className="wrap">
          <p className="eyebrow">{home.benefitsEyebrow}</p>
          <h2 id="ben-h">{home.benefitsHeadline}</h2>
          <div className="grid c3">
            {home.benefits.map((benefit) => (
              <div className="card" key={benefit.title}>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </div>
            ))}
          </div>
          {copy.draft ? (
            <p className="dnote">
              <b>Draft copy:</b> the brief does not spell out the 3 benefits (Q-14). This text is
              built from the brief and must be confirmed by the client.
            </p>
          ) : null}
        </div>
      </section>

      <section className="section" aria-labelledby="who-h">
        <div className="wrap">
          <p className="eyebrow">{home.audienceEyebrow}</p>
          <h2 id="who-h">{home.audienceHeadline}</h2>
          <div className="grid c3">
            {home.audiences.map((audience) => (
              <div className="card" key={audience.title}>
                <h3>{audience.title}</h3>
                <dl className="audience">
                  <dt>Their problem</dt>
                  <dd>{audience.problem}</dd>
                  <dt>What we offer</dt>
                  <dd>{audience.offer}</dd>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" aria-labelledby="how-h">
        <div className="wrap">
          <p className="eyebrow">{steps.eyebrow}</p>
          <h2 id="how-h">{steps.headline}</h2>
          <Steps items={steps.items} />
          <p className="mt-5">
            <Link href="/how-it-works">Delivery times, skipping and payment &rarr;</Link>
          </p>
        </div>
      </section>
    </>
  );
}
