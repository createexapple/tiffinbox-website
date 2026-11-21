/** Inline icons from the approved prototype (generic chat glyph, not the WhatsApp trademark). Decorative: always aria-hidden. */

interface IconProps {
  className?: string;
}

export function ChatIcon({ className = 'ico' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H10l-5 4v-4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm3 6v2h8V9H8zm0 3.5v2h5v-2H8z" />
    </svg>
  );
}

export function InstagramIcon({ className = 'ico' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm5-3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
    </svg>
  );
}

export function WarnIcon({ className = 'ico' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2 1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z" />
    </svg>
  );
}
