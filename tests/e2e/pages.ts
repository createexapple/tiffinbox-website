export const PAGES = [
  { path: '/', name: 'Home', nav: 'Home' },
  { path: '/menu', name: 'Menu', nav: 'Menu' },
  { path: '/plans', name: 'Plans & Pricing', nav: 'Plans & Pricing' },
  { path: '/customize', name: 'Customize', nav: 'Customize' },
  { path: '/how-it-works', name: 'How it works', nav: 'How it works' },
  { path: '/about', name: 'About & Contact', nav: 'About & Contact' },
] as const;

export const NOT_FOUND_PATH = '/this-page-does-not-exist';
