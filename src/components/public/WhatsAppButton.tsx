import type { WhatsAppLink } from '@/lib/whatsapp';
import { ChatIcon } from './icons';

interface Props {
  link: WhatsAppLink;
  /** "fab" = persistent corner button (FR-02), "order" = end-of-page button (FR-03), "inline" = in-content. */
  variant: 'fab' | 'order' | 'inline';
  children: string;
  ariaLabel?: string;
}

const CLASS_NAMES = {
  fab: 'wa-fab',
  order: 'btn btn-wa btn-lg',
  inline: 'btn btn-wa',
} as const;

/**
 * WhatsApp click-to-chat link. With a real number it goes to wa.me with "HI" prefilled.
 * While the number is a placeholder it points at the on-page note instead (never a broken wa.me link).
 */
export function WhatsAppButton({ link, variant, children, ariaLabel }: Props) {
  const external = link.ready ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a className={CLASS_NAMES[variant]} href={link.href} aria-label={ariaLabel} {...external}>
      <ChatIcon />
      {children}
      {link.ready && !ariaLabel ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </a>
  );
}
