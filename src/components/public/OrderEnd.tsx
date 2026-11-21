import type { WhatsAppLink } from '@/lib/whatsapp';
import { WhatsAppButton } from './WhatsAppButton';

interface Props {
  link: WhatsAppLink;
  headline: string;
  line: string;
}

/** The green "Order on WhatsApp" block: last content above the footer on every page (FR-03). */
export function OrderEnd({ link, headline, line }: Props) {
  return (
    <section className="order-end" aria-labelledby="order-h">
      <div className="wrap">
        <h2 id="order-h">{headline}</h2>
        <p className="muted">{line}</p>
        <WhatsAppButton link={link} variant="order">
          Order on WhatsApp
        </WhatsAppButton>
      </div>
    </section>
  );
}
