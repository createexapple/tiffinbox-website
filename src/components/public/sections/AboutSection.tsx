import { FaqList } from '@/components/public/FaqList';
import { PagePhoto } from '@/components/public/PagePhoto';
import { WhatsAppButton } from '@/components/public/WhatsAppButton';
import { getFaq, getPageCopy, getPageImages, getSiteSettings } from '@/content';
import { stripQuestionCodes } from '@/lib/format';
import { buildWhatsAppLink, instagramUrl, isPlaceholder } from '@/lib/whatsapp';

export async function AboutSection() {
  const [settings, faq, copy, pageImages] = await Promise.all([
    getSiteSettings(),
    getFaq(),
    getPageCopy(),
    getPageImages(),
  ]);
  const link = buildWhatsAppLink(settings.whatsappNumber);
  const { about } = copy;
  const hours = `Order hours: ${stripQuestionCodes(settings.orderHours)}${
    about.contactLateNight ? `; ${about.contactLateNight}` : ''
  }.`;

  return (
    <div className="t-band">
      <div className="t-wrap" id="contact">
        <span className="t-kick">About &amp; contact</span>
        <h1>{about.headline}</h1>
        <p className="t-lead">{about.mission}</p>
        <PagePhoto image={pageImages.aboutMain} className="mt-8" />
        <div className="t-grid">
          <div className="t-card">
            <h3>Where we deliver</h3>
            <p>{about.whereWeDeliver}</p>
            {isPlaceholder(settings.deliveryBoundary) ? null : <p>{settings.deliveryBoundary}</p>}
          </div>
          <div className="t-card">
            <h3>WhatsApp orders</h3>
            <p>{stripQuestionCodes(settings.whatsappNumber)}</p>
            <div style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <WhatsAppButton link={link} variant="inline">
                Message us
              </WhatsAppButton>
            </div>
          </div>
          <div className="t-card">
            <h3>Instagram</h3>
            <p>
              <a
                href={instagramUrl(settings.instagramHandle)}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{settings.instagramHandle}
                <span className="sr-only"> on Instagram (opens in a new tab)</span>
              </a>
            </p>
            <p>{hours}</p>
          </div>
        </div>
        <h2 id="faq-h" style={{ margin: '48px 0 8px' }}>
          Questions
        </h2>
        {faq.length === 0 ? (
          <p className="t-lead">Questions? Message us on WhatsApp and we will reply.</p>
        ) : (
          <FaqList items={faq} />
        )}
      </div>
    </div>
  );
}
