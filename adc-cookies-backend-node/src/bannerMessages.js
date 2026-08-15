import { getOne, query } from './db.js';
import { ApiError } from './middleware.js';

/*
 * The rotating lines in the top ribbon.
 *
 * Stored as one JSON array under a single key rather than a row per message. The ribbon IS an
 * ordered list, and keeping the order in the data itself beats an ordering column that every
 * insert has to remember to set.
 *
 * There is deliberately no way to save an empty list. SiteNav offsets itself down by --ribbon-h
 * on the home page, so a ribbon that renders nothing would leave a 28px gap under the navbar —
 * the ribbon's height is part of the page's layout whether or not it has anything to say. One
 * message minimum keeps that contract true without the storefront needing to know about it.
 */

export const DEFAULT_BANNER_MESSAGES = [
  '100% Pure Veg · All our cookies are eggless',
  'Log in to save favourites & track your orders',
];

const MAX_MESSAGES = 12;
const MAX_LEN = 160;

/** Clean a caller-supplied list: trim, drop blanks, cap length and count. */
export function normaliseBannerMessages(list) {
  return (Array.isArray(list) ? list : [])
    .map((m) => String(m ?? '').trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_MESSAGES);
}

export async function readBannerMessages() {
  const row = await getOne("SELECT value FROM site_settings WHERE key = 'banner_messages'");
  if (row?.value) {
    try {
      const saved = normaliseBannerMessages(JSON.parse(row.value));
      if (saved.length) return saved;
    } catch {
      // Corrupt JSON should show the defaults, not take the ribbon down with it.
    }
  }
  /*
   * Nothing saved yet. The ribbon used to be two hardcoded lines plus one admin-set offer, so the
   * first read seeds the editable list with exactly what was already on screen — the offer first,
   * where it was — rather than dropping it the moment this panel replaces the old one.
   */
  const legacy = await getOne("SELECT value FROM site_settings WHERE key = 'header_offer'");
  const offer = legacy?.value ? String(legacy.value).trim() : '';
  return offer ? [offer, ...DEFAULT_BANNER_MESSAGES] : [...DEFAULT_BANNER_MESSAGES];
}

export async function writeBannerMessages(list) {
  const clean = normaliseBannerMessages(list);
  if (!clean.length) throw new ApiError('Keep at least one banner message — the ribbon is part of the page layout.');
  await query(
    `INSERT INTO site_settings (key, value) VALUES ('banner_messages', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(clean)]
  );
  // The seed above reads header_offer only until something is saved here. Once it is, that key is
  // stale data that would reappear if this row were ever deleted — so retire it on first save.
  await query("DELETE FROM site_settings WHERE key = 'header_offer'");
  return clean;
}
