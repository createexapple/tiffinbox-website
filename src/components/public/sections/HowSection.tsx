import { Steps } from '@/components/public/Steps';
import { getPageCopy } from '@/content';

export async function HowSection() {
  const { howItWorks: how } = await getPageCopy();
  const blocks = [
    { title: 'Skip a meal', text: how.skip },
    { title: 'Pause your plan', text: how.pause },
    { title: 'Packaging', text: how.packaging },
    { title: 'Payment', text: how.payment },
  ];

  return (
    <div className="t-band">
      <div className="t-wrap">
        <span className="t-kick">How it works</span>
        <h1>{how.headline}</h1>
        <Steps items={how.steps} />
        <h2 style={{ margin: '48px 0 18px' }}>Delivery times and charges</h2>
        <table className="t-table">
          <caption className="sr-only">
            Delivery time, skip cut-off and delivery charge for each kind of order
          </caption>
          <thead>
            <tr>
              <th scope="col">Meal</th>
              <th scope="col">Delivered by</th>
              <th scope="col">Skip before</th>
              <th scope="col">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {how.deliveryRows.map((row) => (
              <tr key={row.key}>
                <th scope="row" data-l="Meal">
                  {row.meal}
                </th>
                <td data-l="Delivered by">{row.deliveredBy}</td>
                <td data-l="Skip before">{row.skipBefore}</td>
                <td data-l="Delivery">{row.charge}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="t-grid">
          {blocks.map((block) => (
            <div className="t-card" key={block.title}>
              <h3>{block.title}</h3>
              <p>{block.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
