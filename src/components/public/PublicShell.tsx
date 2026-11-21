import type { ReactNode } from 'react';
import { getContentInfo, getPageCopy, getSiteSettings } from '@/content';
import { buildWhatsAppLink, isPlaceholder } from '@/lib/whatsapp';
import { MockBanner } from './MockBanner';
import { OrderEnd } from './OrderEnd';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { WhatsAppButton } from './WhatsAppButton';
import { WhatsAppNote } from './WhatsAppNote';
import { WhatsAppProvider } from './whatsapp-context';

/**
 * Chrome shared by every public screen S-01..S-07 (FR-01..04): skip link, header and nav, content,
 * end-of-page order block, footer, persistent WhatsApp button. Also used by the 404 page.
 */
export async function PublicShell({ children }: { children: ReactNode }) {
  const [settings, copy, info] = await Promise.all([
    getSiteSettings(),
    getPageCopy(),
    getContentInfo(),
  ]);
  const link = buildWhatsAppLink(settings.whatsappNumber);

  return (
    <WhatsAppProvider link={link}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <MockBanner info={info} />
      <SiteHeader businessName={settings.businessName} />
      <main id="main">{children}</main>
      <OrderEnd link={link} headline={copy.home.orderHeadline} line={copy.home.orderLine} />
      <SiteFooter settings={settings} />
      <WhatsAppButton link={link} variant="fab" ariaLabel="WhatsApp: start an order">
        WhatsApp
      </WhatsAppButton>
      {link.ready ? null : (
        <WhatsAppNote
          placeholder={
            isPlaceholder(settings.whatsappNumber) ? settings.whatsappNumber : '[WhatsApp number]'
          }
        />
      )}
    </WhatsAppProvider>
  );
}
