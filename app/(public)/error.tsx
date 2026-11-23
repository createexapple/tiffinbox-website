'use client';

import { useEffect } from 'react';
import { WhatsAppButton } from '@/components/public/WhatsAppButton';
import { useWhatsAppLink } from '@/components/public/whatsapp-context';

/**
 * S-07 data-failure state (FR-12 AC 2): a readable fallback inside the normal page chrome, never a blank screen.
 * Next.js 16 passes `retry`, which re-fetches and re-renders the segment.
 */
export default function PublicError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const link = useWhatsAppLink();

  useEffect(() => {
    // Technical detail goes to the console only; nothing technical is shown to visitors.
    console.error(error);
  }, [error]);

  return (
    <div className="t-band t-notfound">
      <div className="t-wrap">
        <h1>Kuch masla ho gaya.</h1>
        <p className="t-lead" style={{ marginInline: 'auto' }}>
          We could not load this page right now. Please try again in a minute, or ask us on
          WhatsApp.
        </p>
        <div className="t-row" style={{ justifyContent: 'center', marginTop: 24 }}>
          <button type="button" className="t-btn t-fill" onClick={() => retry()}>
            Try again
          </button>
          {link.ready ? (
            <WhatsAppButton link={link} variant="inline">
              Ask on WhatsApp
            </WhatsAppButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
