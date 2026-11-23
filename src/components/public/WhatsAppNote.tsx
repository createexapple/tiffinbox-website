'use client';

import { useEffect, useRef } from 'react';
import { WHATSAPP_NOTE_ID } from '@/lib/whatsapp';

/**
 * Placeholder state for the WhatsApp buttons while the number has not been supplied  * Opens through the URL hash (CSS :target) as in the prototype; this adds focus and Escape handling.
 * Rendered only when there is no usable number; disappears once a real number is in settings.
 */
export function WhatsAppNote({ placeholder }: { placeholder: string }) {
  const closeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const hash = `#${WHATSAPP_NOTE_ID}`;
    const focusIfOpen = () => {
      if (window.location.hash === hash) requestAnimationFrame(() => closeRef.current?.focus());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.location.hash === hash) window.location.hash = 'close';
    };
    window.addEventListener('hashchange', focusIfOpen);
    window.addEventListener('keydown', onKeyDown);
    focusIfOpen();
    return () => {
      window.removeEventListener('hashchange', focusIfOpen);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      className="modal"
      id={WHATSAPP_NOTE_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-note-h"
    >
      <div className="dialog">
        <h2 id="wa-note-h">WhatsApp number not set yet</h2>
        <p>
          On the live site this button opens a WhatsApp chat with the message “HI” already typed.
          The number has not been supplied yet: <b>{placeholder}</b>.
        </p>
        <div className="actions">
          <a ref={closeRef} className="btn btn-primary" href="#close">
            Close
          </a>
        </div>
      </div>
    </div>
  );
}
