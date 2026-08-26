import { getAll } from './db.js';
import { ApiError } from './middleware.js';

/*
 * Build-your-own packs: a product that is really N slots the customer fills with other products.
 *
 * The 8 Pack is three FILLED cookies and five from the rest of the range. That is one product on
 * the menu at one price, and eight product ids underneath it — so the pack line carries its picks
 * rather than being exploded into eight order lines. One line is what the customer bought, what
 * Razorpay charged for, and what the kitchen assembles; eight lines would be none of those.
 *
 * WHY THE GROUPS ARE RULES, NOT IDS
 *
 * Product ids differ between environments — 8 Pack Cookies is id 39 in production and does not
 * exist at all in the local development database. A config listing ids would be right in exactly
 * one place and silently wrong everywhere else, and "silently" is the problem: a wrong id does not
 * error, it just quietly drops a cookie from the picker. The groups are therefore predicates
 * resolved against whatever catalogue is actually in front of us.
 *
 * `menu_group` carries most of it. The exception is Red Velvet Filled Cookie, which is a filled
 * cookie by every measure except the group it is filed under (Premium Cookies) — hence
 * `alsoFilled`. That is a deliberate, named exception rather than a rename of the menu group,
 * because the group is what the storefront's menu headings are built from and moving it would
 * move the cookie on the menu.
 */

/** Cookies that count as FILLED for pack purposes. */
const isFilled = (p) =>
  String(p.menu_group || '').trim().toLowerCase() === 'filled cookies' ||
  /red\s*velvet\s*filled/i.test(String(p.name || ''));

/** Cookies that count as the plain half of a pack. Deliberately excludes anything filled. */
const isPlain = (p) =>
  ['classic cookies', 'premium cookies'].includes(String(p.menu_group || '').trim().toLowerCase()) &&
  !isFilled(p);

/*
 * Every pack we sell, keyed by how to recognise the product.
 *
 * `slots` are ordered; their `count` values are what the picker enforces and what the server
 * re-checks on the way in. Adding a second pack later is a new entry here, not new code.
 */
export const PACK_DEFINITIONS = [
  {
    key: 'cookies-8',
    matches: (p) => String(p.category || '').toUpperCase() === 'COMBOS' && /\b8\s*pack\b/i.test(String(p.name || '')),
    slots: [
      { key: 'filled', label: 'Filled cookies', count: 3, eligible: isFilled,
        hint: 'Molten centres. Pick any three — repeats are fine.' },
      { key: 'plain', label: 'Classic & premium cookies', count: 5, eligible: isPlain,
        hint: 'Pick any five, in any combination.' },
    ],
  },
];

/** The definition for a product, or null when it is an ordinary product. */
export function packFor(product) {
  if (!product) return null;
  return PACK_DEFINITIONS.find((d) => d.matches(product)) || null;
}

export const isPackProduct = (product) => !!packFor(product);

/** How many cookies a pack holds in total — used for the "8 of 8 chosen" line. */
export const packSize = (def) => def.slots.reduce((n, s) => n + s.count, 0);

/*
 * The pack as the picker needs it: each slot with the real, currently-available products that may
 * go in it, resolved against this environment's catalogue.
 *
 * Availability is applied here so a cookie the kitchen has turned off cannot be picked. A slot that
 * ends up with no choices at all is reported rather than rendered as an empty list the customer
 * cannot satisfy — that is a catalogue problem and it should read like one.
 */
export async function resolvePackOptions(product) {
  const def = packFor(product);
  if (!def) return null;

  const cookies = await getAll(
    `SELECT id, name, price, menu_group, images
       FROM products
      WHERE is_available = TRUE AND category = 'COOKIES'
      ORDER BY menu_group, id`
  );

  const slots = def.slots.map((s) => ({
    key: s.key,
    label: s.label,
    count: s.count,
    hint: s.hint,
    choices: cookies.filter(s.eligible).map((c) => ({
      productId: c.id, name: c.name, price: Number(c.price) || 0, images: c.images,
    })),
  }));

  return {
    packKey: def.key,
    productId: product.id,
    name: product.name,
    // The pack price is the product's own price and nothing is derived from the picks: this is a
    // fixed-price combo, so an expensive mix is a better deal rather than a bigger bill.
    price: Number(product.price) || 0,
    size: packSize(def),
    slots,
    unavailableSlots: slots.filter((s) => s.choices.length === 0).map((s) => s.label),
  };
}

/*
 * Check what the customer sent, against the catalogue, at order time.
 *
 * The picker enforces all of this already; this exists because the picker runs on their machine.
 * Without it the pack is an open invitation: eight Biscoff at the price of a mixed box is a single
 * edited request away, and it would look like an ordinary order for the rest of its life.
 *
 * Returns { picks, addOns, summary } on success and throws ApiError with a sentence the customer
 * can act on otherwise.
 */
export async function validatePackPicks(product, rawPicks) {
  const def = packFor(product);
  if (!def) return null;

  const picks = Array.isArray(rawPicks) ? rawPicks : [];
  if (!picks.length) {
    throw new ApiError(`Choose the ${packSize(def)} cookies for your ${product.name} before adding it.`);
  }

  const ids = [...new Set(picks.map((p) => Number(p.productId)).filter(Number.isFinite))];
  const rows = ids.length
    ? await getAll(`SELECT id, name, price, menu_group, category, is_available FROM products WHERE id = ANY($1::int[])`, [ids])
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const out = [];
  for (const slot of def.slots) {
    const forSlot = picks.filter((p) => p.slot === slot.key);
    const total = forSlot.reduce((n, p) => n + (Number(p.quantity) || 0), 0);
    if (total !== slot.count) {
      throw new ApiError(`Your ${product.name} needs exactly ${slot.count} ${slot.label.toLowerCase()} — you chose ${total}.`);
    }
    for (const p of forSlot) {
      const row = byId.get(Number(p.productId));
      const qty = Number(p.quantity) || 0;
      if (!row) throw new ApiError('One of the cookies in your pack is no longer on the menu. Please choose again.');
      if (!row.is_available) throw new ApiError(`${row.name} has just sold out. Please choose a different cookie for your ${product.name}.`);
      if (!slot.eligible(row)) throw new ApiError(`${row.name} cannot go in the ${slot.label.toLowerCase()} part of your ${product.name}.`);
      if (qty < 1) throw new ApiError('One of the cookies in your pack has no quantity. Please choose again.');
      out.push({ slot: slot.key, productId: row.id, name: row.name, quantity: qty });
    }
  }

  return { picks: out, addOns: describePicks(out), summary: summarisePicks(out) };
}

/*
 * The picks as lines a person reads.
 *
 * They go into selected_options.addOns because that is the field every screen that shows an order
 * already renders — the customer's account page, the admin's order detail, the store tablet. Adding
 * a bespoke field would mean teaching four screens about packs; this way they all show it already.
 */
export const describePicks = (picks) =>
  (picks || []).map((p) => `${p.quantity}× ${p.name}`);

/** One line, for the places that have room for a sentence and not a list — a KOT among them. */
export const summarisePicks = (picks) => describePicks(picks).join(', ');
