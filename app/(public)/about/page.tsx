import type { Metadata } from 'next';
import { FaqList } from '@/components/public/FaqList';
import { NoteBox } from '@/components/public/NoteBox';
import { PhotoPlaceholder } from '@/components/public/PhotoPlaceholder';
import { WhatsAppButton } from '@/components/public/WhatsAppButton';
import { InstagramIcon } from '@/components/public/icons';
import { getFaq, getPageCopy, getSiteSettings } from '@/content';
import { pageMetadata } from '@/lib/seo';
import { buildWhatsAppLink, instagramUrl, isPlaceholder } from '@/lib/whatsapp';

export const metadata: Metadata = pageMetadata({
  title: 'About & Contact',
  description:
    'About Tiffin Box, where we deliver in Lahore, frequently asked questions, WhatsApp and Instagram contact.',
  path: '/about',
});

export default async function AboutPage() {
  const [settings, faq, copy] = await Promise.all([getSiteSettings(), getFaq(), getPageCopy()]);
  const link = buildWhatsAppLink(settings.whatsappNumber);
  const { about } = copy;

  return (
    <>
      <section className="section">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">About us</p>
            <h1 className="h1-page">{about.headline}</h1>
            <p className="lede">{about.mission}</p>
            <div className="dnote">
              <b>Our story:</b> {about.story}. The paragraph above is the brief’s mission statement,
              not the story.
            </div>
          </div>
          <PhotoPlaceholder description="the kitchen / hands serving food (about)" />
        </div>
      </section>

      <section className="section alt">
        <div className="wrap grid c2" style={{ alignItems: 'start' }}>
          <div>
            <h2>Where we deliver</h2>
            <p>{settings.areaServedDetail}</p>
            {isPlaceholder(settings.deliveryBoundary) ? (
              <p className="small muted">Exact boundary: {settings.deliveryBoundary}</p>
            ) : (
              <p className="small muted">{settings.deliveryBoundary}</p>
            )}
            <h2 className="mt-8" id="contact">
              Contact
            </h2>
            <ul className="contact-list">
              <li>
                <b>WhatsApp (orders)</b>
                <span>
                  {settings.whatsappNumber}
                  {isPlaceholder(settings.whatsappNumber) ? (
                    <>
                      {' '}
                      <span className="tag">Q-04</span>
                    </>
                  ) : null}
                </span>
              </li>
              <li>
                <b>Instagram</b>
                <a
                  href={instagramUrl(settings.instagramHandle)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <InstagramIcon />
                  &nbsp;@{settings.instagramHandle}
                  <span className="sr-only"> on Instagram (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <b>Order hours</b>
                <span>
                  {settings.orderHours}
                  {isPlaceholder(settings.orderHours) ? (
                    <>
                      {' '}
                      <span className="tag">Q-06</span>
                    </>
                  ) : null}
                </span>
              </li>
              <li>
                <b>Area</b>
                <span>{settings.areaServed}</span>
              </li>
            </ul>
            <div className="cta-row">
              <WhatsAppButton link={link} variant="inline">
                Message us on WhatsApp
              </WhatsAppButton>
            </div>
          </div>
          <div>
            <h2 id="faq-h">Frequently asked questions</h2>
            {faq.length === 0 ? (
              <NoteBox>Questions? Message us on WhatsApp and we will reply.</NoteBox>
            ) : (
              <FaqList items={faq} />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
