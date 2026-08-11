/*
 * The site's navigation links — one fact, three renderings.
 *
 * The same link ("the franchise page is called X and lives at /franchise") was previously typed out
 * in SiteNav's NAV_DESKTOP, MenuDrawer's NAV_LINKS and OrderingApp's OrderNavItem row. Renaming it
 * meant remembering all three, and the first attempt missed the drawer — which is exactly the bug
 * this file exists to prevent.
 *
 * What lives here is only the fact: key, label, href. What does NOT live here is anything
 * presentational or surface-specific, because those genuinely differ per surface and have every
 * right to:
 *   - the drawer's icons (a lucide element per link)
 *   - which links a given surface shows, and in what order
 *   - the dropdown CONTENTS (products, store list, corporate/franchise) — different data per surface
 *
 * Deliberately NOT sharing: the /franchise page's own eyebrow copy and its SEO <title>. They read
 * similarly today but are different concerns — marketing copy and a search-engine title — and a
 * copywriter should be able to change either without touching the navbar.
 */

export type NavKey = 'home' | 'cookies' | 'tins' | 'locations' | 'franchise' | 'about' | 'contact' | 'orders';

export interface NavLinkDef {
  key: NavKey;
  label: string;
  href: string;
}

export const NAV_LINKS: NavLinkDef[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'cookies', label: 'Buy Cookies', href: '/order?cat=cookies' },
  { key: 'tins', label: 'Cookie Tins', href: '/order?cat=tins' },
  { key: 'locations', label: 'Locations', href: '/locations' },
  { key: 'franchise', label: 'Franchise', href: '/franchise' },
  { key: 'about', label: 'About Us', href: '/about' },
  { key: 'contact', label: 'Contact', href: '/contact' },
  // #orders so it lands on the orders section rather than the top of the account page.
  { key: 'orders', label: 'Orders', href: '/account#orders' },
];

/** The links a surface shows, in canonical order. Each surface decides its own subset. */
export const navLinksFor = (keys: readonly NavKey[]): NavLinkDef[] =>
  NAV_LINKS.filter((l) => keys.includes(l.key));
