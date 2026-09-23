import { getOne, query, nowIso } from '../db/index.js';

/*
 * A signed-in customer's basket, kept on our side so it follows them between devices and so a
 * basket they walked away from can be reminded about. See saved_carts in initSchema for why this
 * is not the older cart / cart_items pair.
 *
 * The storefront owns the shape. A line is keyed the way the storefront keys it (a pack's key has
 * its picks baked in) and carries what the storefront needs to redraw it. We check only what we
 * read ourselves (a name and a quantity, for the reminder) and bound the size, and hand the rest
 * back untouched.
 */

const MAX_LINES = 40;
const MAX_BYTES = 32_000;

export type SavedLines = Record<string, Record<string, unknown>>;

/** A line's name, safe for a WhatsApp variable: one line, no runs of spaces, bounded. */
export function lineName(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/*
 * The basket as sent, minus anything that is not a line. Lines that do not parse are dropped
 * rather than failing the save: the basket is the customer's, and one odd line must not stop the
 * rest following them to their phone.
 */
export function cleanLines(input: unknown): SavedLines {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: SavedLines = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_LINES) break;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || key.length > 300) continue;
    const line = raw as Record<string, unknown>;
    const qty = Number(line.qty);
    const price = Number(line.price);
    if (!lineName(line.name) || !Number.isInteger(qty) || qty < 1 || qty > 99) continue;
    if (!Number.isFinite(price) || price < 0 || price > 100_000) continue;
    out[key] = line;
  }
  return out;
}

/** Store the basket, or forget it when it is empty. Returns false when it is too large to keep. */
export async function saveCart(userId: number, input: unknown): Promise<boolean> {
  const lines = cleanLines(input);
  const count = Object.values(lines).reduce((s, l) => s + Number(l.qty), 0);
  if (!count) {
    await query('DELETE FROM saved_carts WHERE user_id = $1', [userId]);
    return true;
  }
  const json = JSON.stringify(lines);
  if (json.length > MAX_BYTES) return false;
  /*
   * updated_at always moves: it means "last seen with this basket", and nobody should be reminded
   * about a basket they were looking at a minute ago. The reminder count resets only when the
   * contents actually change, so opening the site again does not restart the same basket's
   * reminders.
   */
  await query(
    `INSERT INTO saved_carts (user_id, lines, item_count, updated_at, reminded_at)
     VALUES ($1, $2::jsonb, $3, $4, NULL)
     ON CONFLICT (user_id) DO UPDATE SET
       lines = EXCLUDED.lines,
       item_count = EXCLUDED.item_count,
       updated_at = EXCLUDED.updated_at,
       reminded_at = CASE WHEN saved_carts.lines = EXCLUDED.lines THEN saved_carts.reminded_at ELSE NULL END,
       reminder_count = CASE WHEN saved_carts.lines = EXCLUDED.lines THEN saved_carts.reminder_count ELSE 0 END`,
    [userId, json, count, nowIso()],
  );
  return true;
}

export async function loadCart(userId: number): Promise<{ lines: SavedLines; updatedAt: string | null }> {
  const row = await getOne('SELECT lines, updated_at FROM saved_carts WHERE user_id = $1', [userId]);
  return { lines: (row?.lines as SavedLines) || {}, updatedAt: row?.updated_at ?? null };
}

/*
 * A paid order empties the basket, the same as the success screen does in the browser. Done here
 * as well because a payment that finishes by redirect, or in a tab that was then closed, never
 * reaches that screen, and a basket left behind would come back on the customer's other device
 * with things in it they have already bought. Never throws: the money is already taken.
 */
export async function clearCartAfterPayment(userId: number | null | undefined): Promise<void> {
  if (!userId) return;
  await query('DELETE FROM saved_carts WHERE user_id = $1', [userId])
    .catch((err) => console.log(`[CART] clear after payment | user=${userId} | ✗ ${err.message}`));
}
