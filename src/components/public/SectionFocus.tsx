'use client';

import { useEffect } from 'react';

/**
 * When the visitor moves to another section (nav link, button, back/forward) the section heading takes keyboard
 * focus, so keyboard and screen-reader users land at the top of the new section instead of being left on the link
 * they used. Not run on the first load, and scrolls to the top like the design.
 */
export function SectionFocus() {
  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      const section = id
        ? document.querySelector<HTMLElement>(`.t-sections > #${CSS.escape(id)}`)
        : null;
      const heading =
        section?.querySelector<HTMLElement>('h1') ??
        document.querySelector<HTMLElement>('.t-sections > #home h1');
      // As in the design: a section change always starts at the top of the page.
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return null;
}
