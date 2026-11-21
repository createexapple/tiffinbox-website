import { formatRs } from '@/lib/format';

/** One name + price line used for custom dishes (with "comes with") and add-ons (FR-08). */
export function PriceRow({
  name,
  comesWith,
  price,
}: {
  name: string;
  comesWith?: string;
  price: number;
}) {
  return (
    <li className="price-row">
      <span className="nm">
        {name}
        {comesWith ? <span className="cm">Comes with: {comesWith}</span> : null}
      </span>
      <span className="pr">{formatRs(price)}</span>
    </li>
  );
}
