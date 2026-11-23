import { HeroFigure } from '@/components/public/HeroFigure';
import { Steps } from '@/components/public/Steps';
import { getPageCopy } from '@/content';

export async function HomeSection() {
  const copy = await getPageCopy();
  const { home, steps } = copy;

  return (
    <>
      <div className="t-band">
        <div className="t-wrap t-hero">
          <div className="t-txt">
            <span className="t-kick">{home.eyebrow}</span>
            <h1>
              {home.headline} <span>{home.headlineAccent}</span>
            </h1>
            <p className="t-tagline">{home.tagline}</p>
            <p className="t-lead" style={{ marginTop: 0 }}>
              {home.lede}
            </p>
            {home.tags.length === 0 ? null : (
              <div className="t-row">
                {home.tags.map((tag, index) => (
                  <span className={index === 0 ? 't-tag' : 't-tag t-o'} key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="t-row" style={{ marginTop: 6 }}>
              <a className="t-btn t-fill" href="#plans">
                See plans
              </a>
              <a className="t-btn t-line" href="#menu">
                This week&apos;s menu
              </a>
            </div>
          </div>
          <HeroFigure />
        </div>
      </div>

      <section className="t-band t-alt" aria-labelledby="ben-h">
        <div className="t-wrap">
          <span className="t-kick">{home.benefitsEyebrow}</span>
          <h2 id="ben-h">{home.benefitsHeadline}</h2>
          <div className="t-grid">
            {home.benefits.map((benefit) => (
              <div className="t-card" key={benefit.title}>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="t-band" aria-labelledby="who-h">
        <div className="t-wrap">
          <span className="t-kick">{home.audienceEyebrow}</span>
          <h2 id="who-h">{home.audienceHeadline}</h2>
          <div className="t-grid" data-audiences>
            {home.audiences.map((audience) => (
              <div className={audience.dark ? 't-card t-dark' : 't-card'} key={audience.title}>
                <h3>{audience.title}</h3>
                <p>{audience.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="t-band t-alt" aria-labelledby="how-h">
        <div className="t-wrap">
          <span className="t-kick">{steps.eyebrow}</span>
          <h2 id="how-h">{steps.headline}</h2>
          <Steps items={steps.items} />
          <p style={{ marginTop: 18 }}>
            <a href="#how">{steps.linkText}</a>
          </p>
        </div>
      </section>
    </>
  );
}
