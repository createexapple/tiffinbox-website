import type { WhatsAppLink } from '@/lib/whatsapp';
import { ChatIcon } from './icons';

interface Props {
  link: WhatsAppLink;
  /** "fab" = persistent corner pill (FR-02), "order" = gold end-of-page button (FR-03), "inline" = green in-content button, "gold" = gold in-content button. */
  variant: 'fab' | 'order' | 'inline' | 'gold';
  children: string;
  ariaLabel?: string;
}

const CLASS_NAMES = {
  fab: 't-wa',
  order: 't-btn t-gold',
  inline: 't-btn t-fill',
  gold: 't-btn t-gold',
} as const;

/**
 * WhatsApp click-to-chat link. With a real number it goes to wa.me with the prefilled message.
 * While the number is a placeholder it points at the on-page note instead (never a broken wa.me link).
 */
export function WhatsAppButton({ link, variant, children, ariaLabel }: Props) {
  const external = link.ready ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a className={CLASS_NAMES[variant]} href={link.href} aria-label={ariaLabel} {...external}>
      {variant === 'fab' || variant === 'inline' ? <ChatIcon /> : null}
      {children}
      {link.ready && !ariaLabel ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </a>
  );
}
