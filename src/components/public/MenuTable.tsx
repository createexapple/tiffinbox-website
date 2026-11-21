import type { MealKey, MenuWeek, SiteSettings } from '@/content';
import { formatMenuWeekLabel, formatTime12h } from '@/lib/format';

const MEALS: MealKey[] = ['breakfast', 'lunch', 'dinner'];

/**
 * FR-06 menu: a real table from 768px; under 768px each day becomes a card (CSS data-label), no horizontal scroll.
 * Column headings and times come from settings.
 */
export function MenuTable({
  week,
  settings,
  captionPrefix = 'Menu for',
}: {
  week: MenuWeek;
  settings: SiteSettings;
  captionPrefix?: string;
}) {
  const label = formatMenuWeekLabel(week.weekStart, week.weekEnd);
  const heading = (meal: MealKey) =>
    `${settings.meals[meal].label} (${formatTime12h(settings.meals[meal].deliveredBy)})`;
  const dataLabel = (meal: MealKey) =>
    `${settings.meals[meal].label} ${formatTime12h(settings.meals[meal].deliveredBy)}`;

  return (
    <div className="menu-wrap">
      <table className="rt menu-table">
        <caption className="sr-only">
          {captionPrefix} {label}: breakfast, lunch and dinner for each day
        </caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {MEALS.map((meal) => (
              <th scope="col" key={meal}>
                {heading(meal)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.days.map((day) => (
            <tr key={day.day}>
              <th scope="row">{day.day}</th>
              {MEALS.map((meal) => (
                <td key={meal} data-label={dataLabel(meal)}>
                  {day[meal]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
