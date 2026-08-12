/**
 * The menu's category list — the single place the storefront, the admin editor and the checkout
 * upsell agree on what categories exist, what they're called, and what order they come in.
 *
 * Before this, "the menu" was two hard-coded sections (Cookies, Cookie Tins) written straight into
 * HomeProducts, a two-value union in api.ts, and a two-option dropdown in the admin. Adding a
 * category meant editing all three and hoping nothing was missed — a product saved under a
 * category the storefront didn't know about simply never appeared, with nothing anywhere to say so.
 *
 * Deliberately data only, no React: this file is imported by lib and by components, and the icon
 * for each section is chosen where the section is drawn.
 */

export const PRODUCT_CATEGORIES = [
  { code: 'COOKIES', label: 'Cookies', anchor: 'products' },
  { code: 'HUG_IN_A_DIP', label: 'Hug in a Dip', anchor: 'hug-in-a-dip-section' },
  { code: 'SKILLET', label: 'Skillet Cookie with Ice Cream', anchor: 'skillet-section' },
  { code: 'TINS', label: 'Cookie Tins', anchor: 'tins-section' },
  { code: 'SUNDAE', label: 'Cookie Sundae', anchor: 'sundae-section' },
  { code: 'SHAKES', label: 'Cookie Shakes', anchor: 'shakes-section' },
  { code: 'HOT_DRINKS', label: 'Hot Drinks', anchor: 'hot-drinks-section' },
  { code: 'COLD_COFFEE', label: 'Cold Coffee', anchor: 'cold-coffee-section' },
  { code: 'CAKES', label: 'Cookie Cake', anchor: 'cakes-section' },
  { code: 'COMBOS', label: 'Combos', anchor: 'combos-section' },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]['code'];

export const CATEGORY_CODES = PRODUCT_CATEGORIES.map(c => c.code) as readonly ProductCategory[];

/** Display name for a category code — falls back to the raw code so an unknown one is visible
 *  rather than silently blank. */
export function categoryLabel(code: string): string {
  return PRODUCT_CATEGORIES.find(c => c.code === code)?.label ?? code;
}

/**
 * The order checkout's "Goes great with" offers things in — the next thing up the ladder, not more
 * of what's already in the basket.
 *
 * Tins lead, then the mini-cookie tub, then skillets: someone already holding a cookie has proved
 * they want the cookie, and the useful next question is whether they want a boxful to take home or
 * a plated version of it. Drinks follow, then everything else. A drink is an easy yes but a small
 * one, so it earns its place after the things worth more.
 *
 * Separate from the array above on purpose: that one is the order the MENU reads in, this is the
 * order a suggestion is worth making in, and they are not the same question.
 */
export const UPSELL_LADDER: readonly ProductCategory[] = [
  'TINS', 'HUG_IN_A_DIP', 'SKILLET',
  'COOKIES', 'SUNDAE', 'SHAKES', 'COLD_COFFEE', 'HOT_DRINKS', 'COMBOS', 'CAKES',
];

/**
 * The order products appear in on the menu, best-sellers first.
 *
 * Without this the menu ran in database id order — the order things happened to be created in,
 * which is not a merchandising decision, just an accident of history that put the plainest cookie
 * at the top and the newest arrival at the bottom.
 *
 * Matched loosely on the name so it survives the renames the menu keeps going through ("Red Velvet
 * Filled Cookie" and "Red Velvet with Cheese" are the same rung). Anything not listed keeps its
 * existing position after the named ones, so a new product appears rather than disappearing — the
 * failure mode of a strict allow-list.
 */
const MENU_ORDER = ['nutella', 'biscoff', 'red velvet', 'adc special', 'chocolate chip', 'double choc', 'matcha'];
const LAST = ['ragi', 'raagi'];   // gluten-free, the one people go looking for rather than browse into

export function menuRank(name: string): number {
  const n = name.toLowerCase();
  if (LAST.some(k => n.includes(k))) return 900;
  const i = MENU_ORDER.findIndex(k => n.includes(k));
  return i === -1 ? 500 : i;      // unlisted sits between the named ones and the deliberate last
}
