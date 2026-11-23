'use client';

import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import type { MenuDay } from '@/content';

export interface MenuMealLabel {
  key: 'breakfast' | 'lunch' | 'dinner';
  /** "Breakfast · 8 AM": name and delivery time from settings. */
  label: string;
}

const subscribe = () => () => {};
/** False while rendering on the server and during hydration, true afterwards: the tabs are an enhancement. */
function useEnhanced(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * The week's menu, one day at a time (design: day tabs and three meal cards). Without JavaScript every day is
 * rendered, one after the other, under its day name; with JavaScript the page becomes a tab list (arrow keys, Home
 * and End move between days) that shows the selected day. `defaultIndex` is today's weekday for the current week.
 */
export function MenuDays({
  days,
  meals,
  defaultIndex,
}: {
  days: MenuDay[];
  meals: MenuMealLabel[];
  defaultIndex: number;
}) {
  const enhanced = useEnhanced();
  const [index, setIndex] = useState(Math.min(Math.max(defaultIndex, 0), days.length - 1));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const next = (to + days.length) % days.length;
    setIndex(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') move(index + 1);
    else if (event.key === 'ArrowLeft') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(days.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className={enhanced ? 't-days t-enhanced' : 't-days'}>
      {enhanced ? (
        <div className="t-tabs" role="tablist" aria-label="Day" onKeyDown={onKeyDown}>
          {days.map((day, i) => (
            <button
              key={day.day}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`menu-tab-${i}`}
              aria-selected={i === index}
              aria-controls={`menu-panel-${i}`}
              aria-label={day.day}
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
            >
              {day.day.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : null}
      {days.map((day, i) => (
        <div
          key={day.day}
          className="t-day"
          id={`menu-panel-${i}`}
          role={enhanced ? 'tabpanel' : undefined}
          aria-labelledby={enhanced ? `menu-tab-${i}` : undefined}
          hidden={enhanced && i !== index}
        >
          {enhanced ? null : <h2 className="t-day-name">{day.day}</h2>}
          <div className="t-grid">
            {meals.map((meal) => (
              <div className="t-card" key={meal.key}>
                <span className="t-kick" style={{ marginBottom: 0 }}>
                  {meal.label}
                </span>
                <h3>{day[meal.key] || '—'}</h3>
                <p>{day.day}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
