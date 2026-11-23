import type { AddOnCard as AddOnCardData } from '@/content';
import { MoonIcon } from './icons';

/**
 * One card in the Plans page add-on strip. The late-night card is the full-width dark card with a moon icon and its
 * price line; the others are plain cards.
 */
export function AddOnCard({ card }: { card: AddOnCardData }) {
  if (card.dark) {
    return (
      <div className="t-card t-dark t-wide">
        <MoonIcon />
        <div className="t-wide-text">
          <h3>{card.title}</h3>
          <p>{card.text}</p>
        </div>
        {card.price ? (
          <div className="t-price" style={{ color: 'var(--tb-gold)', marginTop: 0 }}>
            {card.price.replace(/ a night$/, '')}
            {card.price.endsWith(' a night') ? (
              <small style={{ fontWeight: 500 }}> a night</small>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="t-card">
      <h3>{card.title}</h3>
      <p>{card.text}</p>
    </div>
  );
}
