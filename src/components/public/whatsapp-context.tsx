'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { WHATSAPP_NOTE_ID, type WhatsAppLink } from '@/lib/whatsapp';

const WhatsAppContext = createContext<WhatsAppLink>({ ready: false, href: `#${WHATSAPP_NOTE_ID}` });

/**
 * Hands the settings-derived WhatsApp link from the server layout to client components that cannot
 * read content themselves (the error boundary). Carries only the link, nothing else.
 */
export function WhatsAppProvider({ link, children }: { link: WhatsAppLink; children: ReactNode }) {
  return <WhatsAppContext.Provider value={link}>{children}</WhatsAppContext.Provider>;
}

export function useWhatsAppLink(): WhatsAppLink {
  return useContext(WhatsAppContext);
}
