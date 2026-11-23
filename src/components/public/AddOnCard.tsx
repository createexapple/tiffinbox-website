import type { AddOnCard as AddOnCardData } from '@/content';
import { MoonIcon } from './icons';

/** One card in the Plans page add-on strip. The late-night card is dark with a moon icon (words carry the meaning, not the icon). */
export function AddOnCard({ card }: { card: AddOnCardData }) {
  return (
    <div className={card.dark ? 'addon-card dark' : 'addon-card'}>
      <h3>
        {card.key === 'late-night' ? <MoonIcon className="ico moon" /> : null}
        {card.title}
      </h3>
      <p>{card.text}</p>
    </div>
  );
}
