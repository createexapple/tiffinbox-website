import type { WhatsAppLink } from '@/lib/whatsapp';
import { WhatsAppButton } from './WhatsAppButton';

interface Props {
  link: WhatsAppLink;
  headline: string;
  line: string;
}

/** The green call-to-action band with a gold "Order on WhatsApp" button: last content above the footer on every page (FR-03). */
export function OrderEnd({ link, headline, line }: Props) {
  return (
    <section className="t-band t-cta" aria-labelledby="order-h">
      <div className="t-wrap">
        <div>
          <h2 id="order-h">{headline}</h2>
          <p>{line}</p>
        </div>
        <WhatsAppButton link={link} variant="order">
          Order on WhatsApp
        </WhatsAppButton>
      </div>
    </section>
  );
}
