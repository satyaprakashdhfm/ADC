/*
 * How heavy a parcel is, worked out from what is in it. The one place carriers get a weight from.
 *
 * Every carrier call used to send a hard-coded 0.5. Shiprocket reads kilograms, so that was half a
 * kilo; Delhivery reads GRAMS, so every Delhivery parcel was declared at half a gram. Their hub
 * weighed one at 4123 g, called it a mismatch and charged ₹769 on top. Units are now explicit in
 * the names (grams / kg), and each carrier is handed the one it expects.
 *
 * Weights are the packed figures the bakery gave: a cookie about 55 g, a gift tin about 450 g.
 * PACKING_G covers the outer box and padding.
 */

export const COOKIE_G = 55;
export const TIN_G = 450;
export const PACKING_G = 100;

/* Loose on purpose: these come straight from database rows. */
export interface ParcelItem {
  quantity?: unknown;
  product_name?: unknown;
  category?: unknown;
}

/** Grams for one unit of a line: a tin by category or name, everything else as a cookie. */
export function unitGrams(item: ParcelItem): number {
  const cat = String(item.category || '').toUpperCase();
  if (cat === 'TINS' || /\btin\b/i.test(String(item.product_name || ''))) return TIN_G;
  return COOKIE_G;
}

/** The packed parcel's weight in grams, never below one cookie plus packing. */
export function parcelGrams(items: ParcelItem[]): number {
  const contents = items.reduce((g, i) => g + unitGrams(i) * Math.max(0, Number(i.quantity) || 0), 0);
  return Math.round(Math.max(contents, COOKIE_G) + PACKING_G);
}

/** The same weight in kilograms, for carriers that take kg (Shiprocket). */
export const parcelKg = (items: ParcelItem[]) => Math.round(parcelGrams(items)) / 1000;

/** Order lines with their product category, which the weight needs. */
export const ITEMS_WITH_CATEGORY_SQL =
  `SELECT oi.*, p.category FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`;
