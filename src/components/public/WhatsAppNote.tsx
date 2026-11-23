'use client';

import { useEffect, useRef, useState } from 'react';
import { WHATSAPP_NOTE_ID } from '@/lib/whatsapp';

/**
 * Placeholder state for the WhatsApp buttons while the number has not been supplied.
 * With JavaScript, a click on any button that points at the note opens it in place (no address change, so the section
 * on screen stays); Escape and Close shut it and focus returns to the button. Without JavaScript the same buttons
 * link to #wa-note and the CSS :target rule opens it. Rendered only when there is no usable number.
 */
export function WhatsAppNote({ placeholder }: { placeholder: string }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLAnchorElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        `a[href="#${WHATSAPP_NOTE_ID}"]`,
      );
      if (!link) return;
      event.preventDefault();
      openerRef.current = link;
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div
      className={open ? 'modal open' : 'modal'}
      id={WHATSAPP_NOTE_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-note-h"
    >
      <div className="dialog">
        <h2 id="wa-note-h">WhatsApp number not set yet</h2>
        <p>
          On the live site this button opens a WhatsApp chat with the message &quot;HI&quot; already
          typed. The number has not been supplied yet: <b>{placeholder}</b>.
        </p>
        <div className="actions">
          <a
            ref={closeRef}
            className="btn btn-primary"
            href="#close"
            onClick={(event) => {
              event.preventDefault();
              setOpen(false);
              openerRef.current?.focus();
            }}
          >
            Close
          </a>
        </div>
      </div>
    </div>
  );
}
