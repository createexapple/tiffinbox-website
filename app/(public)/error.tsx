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
    <section className="section notfound">
      <div className="wrap narrow centered">
        <h1 className="h1-page">Kuch masla ho gaya.</h1>
        <p className="lede">
          We could not load this page right now. Please try again in a minute, or ask us on
          WhatsApp.
        </p>
        <div className="cta-row center">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => retry()}>
            Try again
          </button>
          <WhatsAppButton link={link} variant="inline">
            Ask on WhatsApp
          </WhatsAppButton>
        </div>
      </div>
    </section>
  );
}
