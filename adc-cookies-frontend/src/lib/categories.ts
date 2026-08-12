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
 * of what's already in the basket. Someone holding a cookie wants something to drink with it long
 * before they want a second cookie; someone who has both is a candidate for a dessert; tins and
 * cakes come last because they're the take-home purchase, not the impulse one.
 *
 * Separate from the array above on purpose: that one is the order the MENU reads in, this is the
 * order a suggestion is worth making in, and they are not the same question.
 */
export const UPSELL_LADDER: readonly ProductCategory[] = [
  'COOKIES', 'SHAKES', 'COLD_COFFEE', 'HOT_DRINKS',
  'HUG_IN_A_DIP', 'SKILLET', 'SUNDAE', 'COMBOS', 'TINS', 'CAKES',
];
