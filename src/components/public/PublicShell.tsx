import type { ReactNode } from 'react';
import {
  ContentShapeError,
  ContentUnavailableError,
  getContentInfo,
  getPageCopy,
  getPageImages,
  getSiteSettings,
} from '@/content';
import { publicMediaUrl } from '@/lib/media-url';
import { buildWhatsAppLink, isPlaceholder } from '@/lib/whatsapp';
import { ContentUnavailable } from './ContentUnavailable';
import { MockBanner } from './MockBanner';
import { PreviewBanner } from './PreviewBanner';
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
export async function PublicShell({
  children,
  keepChildrenWhenUnavailable = false,
}: {
  children: ReactNode;
  /** The 404 page does not need content, so it keeps its own message even when the backend is down. */
  keepChildrenWhenUnavailable?: boolean;
}) {
  let loaded;
  try {
    loaded = await Promise.all([
      getSiteSettings(),
      getPageCopy(),
      getContentInfo(),
      getPageImages(),
    ]);
  } catch (error) {
    // NFR-08: no content and no last-good copy. Show the designed error state (server-rendered, so it is in
    // the HTML) inside minimal chrome; never a blank page or a crash.
    if (error instanceof ContentUnavailableError || error instanceof ContentShapeError) {
      return (
        <UnavailableChrome>
          {keepChildrenWhenUnavailable ? children : <ContentUnavailable />}
        </UnavailableChrome>
      );
    }
    throw error;
  }
  const [settings, copy, info, pageImages] = loaded;
  const logoUrl = pageImages.logo ? publicMediaUrl(pageImages.logo.path) : null;
  const link = buildWhatsAppLink(settings.whatsappNumber);

  return (
    <WhatsAppProvider link={link}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <MockBanner info={info} />
      <PreviewBanner info={info} />
      <SiteHeader businessName={settings.businessName} logoUrl={logoUrl} />
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

/** Minimal chrome when the content backend and the last-good copy are both unavailable. */
function UnavailableChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <SiteHeader businessName="Tiffin Box" />
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="wrap">
          <p>Tiffin Box</p>
        </div>
      </footer>
    </>
  );
}
