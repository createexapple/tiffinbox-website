/** The six sections of the single public page. `path` is the address that shows the section (the hash routes). */
export const PAGES = [
  { path: '/', id: 'home', name: 'Home', nav: 'Home' },
  { path: '/#menu', id: 'menu', name: 'Menu', nav: 'Menu' },
  { path: '/#plans', id: 'plans', name: 'Plans & Pricing', nav: 'Plans & Pricing' },
  { path: '/#customize', id: 'customize', name: 'Customize', nav: 'Customize' },
  { path: '/#how', id: 'how', name: 'How it works', nav: 'How it works' },
  { path: '/#about', id: 'about', name: 'About & Contact', nav: 'About & Contact' },
] as const;

export const NOT_FOUND_PATH = '/this-page-does-not-exist';
