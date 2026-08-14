/*
 * Petpooja (POS / billing) client.
 *
 * Petpooja is the restaurant's till. We are the "aggregator": their menu flows DOWN to us and we
 * relay orders UP, so the bill and KOT print at the store. Two consequences shape this file:
 *
 *   1. Every order line must carry THEIR item id, which only exists in their menu. Hence the
 *      sync/mapping half below — without a mapping, an order cannot be relayed at all.
 *   2. Prices on the ORDER are ours (that's what Razorpay actually charged), so the bill always
 *      reconciles with the settlement even if their menu drifts. Their menu is an id source only.
 *
 * Quirks confirmed against the live sandbox, not assumed:
 *   • Business failures still return HTTP 200 — success lives in the body.
 *   • `success` is the STRING "1"/"0", never a boolean.
 *   • Fetch Menu answers "unable to fetch Object from s3 bucket" until the merchant has hit
 *     Menu Trigger at least once; that is an empty menu, not an auth or id error.
 *
 *   PETPOOJA_BASE_URL     defaults to the host in Petpooja's PDF guide. Their Apiary reference
 *                         lists a different host for save_order; both answer identically today,
 *                         so this is an env var rather than a constant.
 *   PETPOOJA_APP_KEY / _APP_SECRET / _ACCESS_TOKEN   from the dashboard's Configuration tab
 *   PETPOOJA_REST_ID      menu-sharing / mapping code
 */
import { ProxyAgent } from 'undici';
import { getAll, getOne, query, nowIso } from './db.js';
import { logApiCall } from './apiLogger.js';
import { storeRelaysToPos } from './stores.js';

const BASE = (process.env.PETPOOJA_BASE_URL || 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1').replace(/\/+$/, '');
// Two accepted spellings: the descriptive ones matching Petpooja's own field names, and the
// shorter PETPOOJA_API* set already present in .env. Same values either way.
const APP_KEY = process.env.PETPOOJA_APP_KEY || process.env.PETPOOJA_API || '';
const APP_SECRET = process.env.PETPOOJA_APP_SECRET || process.env.PETPOOJA_API_SECRET || '';
const ACCESS_TOKEN = process.env.PETPOOJA_ACCESS_TOKEN || process.env.PETPOOJA_API_TOKEN || '';
export const REST_ID = process.env.PETPOOJA_REST_ID || '';

export const petpoojaConfigured = () => !!(APP_KEY && APP_SECRET && ACCESS_TOKEN && REST_ID);

console.log(`[PETPOOJA] config | base=${BASE} | restID=${REST_ID || 'MISSING'} | keys=${APP_KEY && APP_SECRET && ACCESS_TOKEN ? 'set' : 'MISSING'}`);

const log = (op, msg) => console.log(`[PETPOOJA] ${op} | ${msg}`);
const creds = () => ({ app_key: APP_KEY, app_secret: APP_SECRET, access_token: ACCESS_TOKEN });

/** POST JSON and normalise their "HTTP 200 + success:'0'" convention into a plain result. */
/*
 * Petpooja is the ONE integration that has to leave from a fixed IP — they allowlist ours — so it,
 * and only it, goes through the egress proxy.
 *
 * This used to be arranged the other way round, with NODE_USE_ENV_PROXY sending EVERY outbound
 * request through the proxy and a NO_PROXY list naming the dozen hosts that should not. That list
 * can only ever contain hosts somebody thought of in advance, and the failures it produced were
 * silent and far from their cause: phone OTP died because messagecentral.com was missing from it,
 * and Delhivery labels died because the PDF arrives on a pre-signed link at a host nobody can
 * enumerate. Each one looked like a broken integration rather than a networking rule.
 *
 * Proxying the exception instead of the rule makes the blast radius exactly one file. Nothing else
 * in the app can be affected by the proxy being wrong, unreachable, or absent.
 *
 * With no proxy configured this is undefined and fetch behaves normally, which is what staging
 * wants — it has no Petpooja credentials and needs the static IP for nothing.
 */
const PROXY_URL = process.env.PETPOOJA_PROXY_URL || process.env.HTTPS_PROXY || '';
let proxyAgent;
if (PROXY_URL) {
  try {
    proxyAgent = new ProxyAgent(PROXY_URL);
    console.log(`[PETPOOJA] outbound via proxy ${PROXY_URL.replace(/(:\/\/)[^@]*@/, '$1***@')}`);
  } catch (e) {
    // A malformed proxy URL must not take the POS integration down with it — go direct and say so.
    console.warn(`[PETPOOJA] proxy url unusable (${e.message}) — calling Petpooja directly`);
  }
}

async function ppRequest(path, body, { timeoutMs = 20_000 } = {}) {
  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      // Scoped to this call — see PROXY_URL above. undefined means a normal direct request.
      dispatcher: proxyAgent,
      // Their docs show credentials two ways: as snake_case fields in the body (Save Order) and as
      // hyphenated HEADERS (Fetch Menu). Send both — each endpoint reads whichever it expects, and
      // the unused form is ignored. Verified to make no difference where the body form suffices.
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'app-key': APP_KEY,
        'app-secret': APP_SECRET,
        'access-token': ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const durationMs = Date.now() - t0;
    // success is the string "1"; anything else (including a missing key) is a failure.
    const ok = res.ok && String(data?.success ?? '') === '1';
    logApiCall({ service: 'petpooja', method: 'POST', endpoint: path, request: body, response: data, status: res.status, ok, durationMs });
    return { ok, status: res.status, data, reason: ok ? null : (data?.message || `http_${res.status}`) };
  } catch (err) {
    logApiCall({ service: 'petpooja', method: 'POST', endpoint: path, request: body, ok: false, durationMs: Date.now() - t0, error: err.message });
    return { ok: false, status: 0, data: null, reason: `network_error: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Menu sync                                                           */
/* ------------------------------------------------------------------ */

/**
 * Flatten a menu payload into our tables. Written defensively: Petpooja's key names vary a little
 * across their docs and versions (itemid/id, itemname/name, …), and unknown keys are preserved in
 * `raw` so nothing is lost. Returns counts so the caller can report what actually landed.
 *
 * Existing product_id links are deliberately NOT overwritten — a re-sync must never silently
 * unmap items an operator has already linked by hand.
 */
export async function ingestMenu(payload, { restId = REST_ID, source = 'push' } = {}) {
  const ts = nowIso();
  const r0 = payload?.restaurants?.[0] ?? {};
  /*
   * Key on the MENU-SHARING CODE, not restaurantid.
   *
   * A real payload carries both: restaurantid "4922" (their internal row id) and
   * details.menusharingcode "m9nw6rhvxi". Orders are relayed with restID = the menu-sharing code,
   * so filing the catalogue under restaurantid meant every mapping lookup searched one id while
   * the rows sat under another — silently finding nothing, and looking for all the world like
   * "mapping is broken" rather than "the two ids differ".
   *
   * restaurantid stays as a last resort: better a consistent wrong-looking key than no rows at all.
   */
  const rid = String(
    r0.details?.menusharingcode ?? r0.menusharingcode ??
    payload?.restID ?? restId ??
    r0.restaurantid ?? r0.restID ?? r0.res_id ?? r0.id ?? ''
  ).trim();

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const taxes = Array.isArray(payload?.taxes) ? payload.taxes : [];
  const groups = Array.isArray(payload?.addongroups) ? payload.addongroups : [];

  // Store the payload BEFORE anything can reject it. An earlier version resolved rest_id first and
  // bailed out, so a push whose id sat under an unexpected key vanished without trace and surfaced
  // only as "Menu trigger failed" in their dashboard. Whatever arrives is now always inspectable.
  await query(
    `INSERT INTO petpooja_menu_snapshots (rest_id, source, payload, item_count, received_at) VALUES ($1,$2,$3,$4,$5)`,
    [rid || 'unknown', source, JSON.stringify(payload ?? {}), items.length, ts]
  );

  if (!rid) {
    log('menu-sync', `✗ no rest_id in payload | top-level keys: ${Object.keys(payload ?? {}).join(',') || 'none'}`);
    return { ok: false, reason: 'no_rest_id', keys: Object.keys(payload ?? {}) };
  }

  const taxRows = taxes
    .filter(t => String(t.taxid ?? t.id ?? '').trim())
    .map(t => [rid, String(t.taxid ?? t.id).trim(), String(t.taxname ?? t.name ?? ''),
      Number(t.tax ?? t.percentage ?? 0) || 0, String(t.taxtype ?? ''), JSON.stringify(t), ts]);
  await upsertMany('petpooja_taxes',
    ['rest_id', 'tax_id', 'name', 'percentage', 'tax_type', 'raw', 'updated_at'],
    ['rest_id', 'tax_id'], ['name', 'percentage', 'tax_type', 'raw', 'updated_at'], taxRows);

  const addonRows = [];
  for (const g of groups) {
    const groupId = String(g.addongroupid ?? g.id ?? '').trim();
    const groupName = String(g.addongroup_name ?? g.name ?? '');
    for (const a of (Array.isArray(g.addongroupitems) ? g.addongroupitems : [])) {
      const addonId = String(a.addonitemid ?? a.id ?? '').trim();
      if (!addonId) continue;
      addonRows.push([rid, addonId, groupId, groupName, String(a.addonitem_name ?? a.name ?? ''),
        Number(a.addonitem_price ?? a.price ?? 0) || 0, isInStock(a.active ?? a.in_stock), JSON.stringify(a), ts]);
    }
  }
  await upsertMany('petpooja_addons',
    ['rest_id', 'addon_id', 'group_id', 'group_name', 'name', 'price', 'in_stock', 'raw', 'updated_at'],
    ['rest_id', 'addon_id'], ['group_id', 'group_name', 'name', 'price', 'in_stock', 'raw', 'updated_at'], addonRows);

  const itemRows = [];
  for (const it of items) {
    const itemId = String(it.itemid ?? it.id ?? '').trim();
    if (!itemId) continue;
    const name = String(it.itemname ?? it.name ?? '');
    const categoryId = String(it.item_categoryid ?? it.categoryid ?? '');
    const taxIds = String(it.item_tax ?? '');
    const stock = isInStock(it.in_stock ?? it.active);
    // Their `variation` child replaces the deprecated top-level `variations` object. One row per
    // variation, because an order line needs item id AND variation id together.
    const variations = Array.isArray(it.variation) ? it.variation : [];
    if (variations.length === 0) {
      itemRows.push([rid, itemId, '', name, null, Number(it.price ?? 0) || 0, categoryId, taxIds, stock, JSON.stringify(it), ts]);
    } else {
      for (const v of variations) {
        itemRows.push([rid, itemId, String(v.variationid ?? v.id ?? '').trim(), name, String(v.name ?? ''),
          Number(v.price ?? 0) || 0, categoryId, taxIds, stock, JSON.stringify({ ...it, _variation: v }), ts]);
      }
    }
  }
  // product_id is deliberately absent from the update list: a re-sync must never unmap items an
  // operator has already linked by hand.
  await upsertMany('petpooja_items',
    ['rest_id', 'item_id', 'variation_id', 'name', 'variation_name', 'price', 'category_id', 'tax_ids', 'in_stock', 'raw', 'created_at', 'updated_at'],
    ['rest_id', 'item_id', 'variation_id'],
    ['name', 'variation_name', 'price', 'category_id', 'tax_ids', 'in_stock', 'raw', 'updated_at'],
    itemRows.map(r => [...r, r[r.length - 1]]));   // created_at and updated_at share the timestamp

  log('menu-sync', `restID=${rid} | source=${source} | items=${itemRows.length} taxes=${taxRows.length} addons=${addonRows.length}`);
  return { ok: true, restId: rid, items: itemRows.length, taxes: taxRows.length, addons: addonRows.length };
}

/**
 * Multi-row upsert in chunks.
 *
 * The obvious version — one INSERT per row — costs a network round-trip each time: measured at
 * ~60ms/item against Supabase, so an 800-item menu took ~48s and blew Petpooja's push timeout
 * (their dashboard just says "Menu trigger failed"). Batching turns that into a handful of
 * statements. Chunked because Postgres caps a statement at 65535 bound parameters.
 */
async function upsertMany(table, cols, conflictCols, updateCols, rows, chunkSize = 200) {
  if (!rows.length) return;
  const colList = cols.join(', ');
  const setList = updateCols.map(c => `${c}=EXCLUDED.${c}`).join(', ');
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params = [];
    const tuples = chunk.map(r => {
      const ph = r.map(v => { params.push(v); return `$${params.length}`; });
      return `(${ph.join(',')})`;
    });
    await query(
      `INSERT INTO ${table} (${colList}) VALUES ${tuples.join(',')}
       ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${setList}`,
      params
    );
  }
}

/*
 * Only an explicit negative means out of stock.
 *
 * An earlier version also treated "2" as out of stock, which was wrong and dangerous: Petpooja's
 * own sample menu carries `in_stock:"2"` on every item alongside `active:"1"`, so a real menu would
 * have marked the whole catalogue unavailable — and because the stock webhook mirrors this onto
 * products.is_available, that would have taken our storefront down with it. When their flag is
 * ambiguous, stay available and let the explicit Item Off webhook do the disabling.
 */
function isInStock(v) {
  if (v === undefined || v === null || v === '') return true;
  const s = String(v).toLowerCase();
  return !(s === '0' || s === 'false' || s === 'no');
}

/** Pull the menu on demand (no app credentials needed — restID only). */
export async function fetchMenu(restId = REST_ID) {
  if (!restId) return { ok: false, reason: 'no_rest_id' };
  log('menu-fetch', `restID=${restId} | fetching…`);
  const r = await ppRequest('/mapped_restaurant_menus', { restID: restId });
  if (!r.ok) {
    // The commonest cause by far, and it looks like an auth error if you don't know better.
    const hint = /s3 bucket/i.test(r.reason || '')
      ? ' (no menu generated yet — hit Menu Trigger in the Petpooja dashboard)'
      : '';
    log('menu-fetch', `restID=${restId} | ✗ ${r.reason}${hint}`);
    return { ok: false, reason: r.reason, hint: hint.trim() || undefined };
  }
  const ingest = await ingestMenu(r.data, { restId, source: 'fetch' });
  return { ok: true, ...ingest };
}

/* ------------------------------------------------------------------ */
/* Order relay                                                         */
/* ------------------------------------------------------------------ */

/** Look up our mapping for a product. Returns null when unmapped (caller must not relay blind). */
export async function mappedItem(productId, restId = REST_ID) {
  if (!productId) return null;
  return getOne(
    `SELECT item_id, variation_id, name, tax_ids, price FROM petpooja_items
      WHERE rest_id = $1 AND product_id = $2 ORDER BY variation_id LIMIT 1`,
    [restId, productId]
  );
}

/** Every product still lacking a Petpooja id — the admin mapping screen's to-do list. */
export function unmappedProducts(restId = REST_ID) {
  return getAll(
    `SELECT p.id, p.name, p.price FROM products p
      WHERE p.is_available = TRUE
        AND NOT EXISTS (SELECT 1 FROM petpooja_items i WHERE i.rest_id = $1 AND i.product_id = p.id)
      ORDER BY p.id`,
    [restId]
  );
}

/*
 * Relay a paid order.
 *
 * The nesting here is not decorative and not what their PDF's field tables imply. Petpooja wants
 *   orderinfo -> OrderInfo -> Restaurant|Customer|Order|OrderItem|Tax|Discount -> details
 * with restID inside Restaurant.details and udid/device_type beside OrderInfo. A flatter shape —
 * which is what the field tables read like — is refused with "Invalid order relay payload ", the
 * SAME message an empty {} gets, because the body is never inspected. That cost a day; the shape
 * below is the one verified to return {"success":"1","message":"Your order is saved."}.
 */
export async function saveOrder(payload) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  const orderID = payload?.orderinfo?.OrderInfo?.Order?.details?.orderID || '?';
  log('save-order', `orderID=${orderID} | relaying…`);
  const r = await ppRequest('/save_order', { ...creds(), ...payload });
  log('save-order', r.ok ? `✓ ${JSON.stringify(r.data).slice(0, 160)}` : `✗ ${r.reason}`);
  return r;
}

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

/** Public origin Petpooja should call back on. Railway sets RAILWAY_PUBLIC_DOMAIN for us. */
function callbackBase() {
  const explicit = (process.env.PETPOOJA_CALLBACK_BASE || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (railway) return `https://${railway.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  return 'https://adc-backend-copy-production.up.railway.app';
}

/**
 * Build the Save Order body from one of our orders.
 *
 * Prices are OURS, not the POS menu's — that is what Razorpay actually charged, so the bill always
 * reconciles with the settlement even if their menu drifts. Their menu is an id source only.
 *
 * Tax handling follows Petpooja's own annotated payload (reviewed by them 2026-08-01):
 *
 *   "tax_inclusive … item tax is cal only when this is false"
 *
 * Our prices already contain 5% GST, so every line is tax_inclusive TRUE and item_tax is therefore
 * EMPTY — sending both an inclusive flag and a per-item tax breakdown double-counts, which is what
 * their review flagged. The tax still reaches the bill through the order-level Tax block, where
 * restaurant_liable_amt carries it because gst_liability is 'restaurant' (we remit it).
 *
 * price and final_price are PER UNIT — their note: multiple quantities are reflected in the order
 * `total`, not by multiplying the line price. final_price = price - item_discount.
 *
 * Delivery is a third-party courier (enable_delivery 0) and the fee is fixed and untaxed, hence
 * dc_/pc_tax_percentage 0 and gst_details that are zero on both sides.
 */
export function buildOrderPayload({ order, items, customer, address, taxIds = [] }) {
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;

  // 5% GST inside the price: base = total / 1.05, tax = total - base, split evenly CGST/SGST.
  const gross = items.reduce((s, i) => s + (Number(i.total_price) || 0), 0);
  const taxTotal = gross - gross / 1.05;
  const halfTax = taxTotal / 2;
  const [cgstId, sgstId] = [taxIds[0] || '', taxIds[1] || ''];

  const orderItems = items.map((i) => {
    const unit = Number(i.unit_price) || 0;
    const itemDiscount = Number(i.item_discount) || 0;
    return {
      id: String(i.petpooja_item_id),
      name: i.product_name,
      tax_inclusive: true,
      gst_liability: 'restaurant',
      // Empty BY DESIGN — see the note above. With tax_inclusive true they do not compute item tax,
      // and supplying a breakdown here on top of the inclusive price double-counts it.
      item_tax: [],
      item_discount: itemDiscount ? money(itemDiscount) : '',
      price: money(unit),
      final_price: money(unit - itemDiscount),
      quantity: String(i.quantity),
      description: i.special_notes || '',
      variation_name: i.petpooja_variation_name || '',
      variation_id: i.petpooja_variation_id || '',
      AddonItem: { details: (i.addons || []).map((a) => ({
        id: String(a.id), name: a.name, group_name: a.group_name,
        price: money(a.price),
        group_id: Number(a.group_id),   // an INT here, not a string — per their annotation
        quantity: String(a.quantity || 1),
      })) },
    };
  });

  return {
    orderinfo: {
      OrderInfo: {
        Restaurant: { details: {
          res_name: process.env.PETPOOJA_RES_NAME || 'A Dough Cookie - Begur',
          address: process.env.PETPOOJA_RES_ADDRESS || '167/3 First floor, Chickbegur Village, Singasandra Post, Begur, Bengaluru 560114',
          contact_information: process.env.PETPOOJA_RES_CONTACT || '9381502998',
          restID: REST_ID,
        } },
        Customer: { details: {
          email: customer?.email || '',
          name: customer?.name || 'Customer',
          address: address || '',
          phone: String(customer?.phone || '').replace(/\D/g, '').slice(-10),
          latitude: customer?.latitude != null ? String(customer.latitude) : '',
          longitude: customer?.longitude != null ? String(customer.longitude) : '',
        } },
        Order: { details: {
          orderID: order.order_number,
          preorder_date: date, preorder_time: time,
          service_charge: '0', sc_tax_amount: '0',
          // The courier fee is known by now — the relay runs after the shipment is created. It is a
          // flat pass-through and untaxed, so the percentages are 0 and neither party is liable.
          delivery_charges: money(order.delivery_fee), dc_tax_percentage: '0', dc_tax_amount: '0',
          dc_gst_details: [{ gst_liable: 'vendor', amount: '0' }, { gst_liable: 'restaurant', amount: '0' }],
          packing_charges: '0', pc_tax_amount: '0', pc_tax_percentage: '0',
          pc_gst_details: [{ gst_liable: 'vendor', amount: '0' }, { gst_liable: 'restaurant', amount: '0' }],
          order_type: 'H', advanced_order: 'N', payment_type: 'ONLINE',
          table_no: '', no_of_persons: '0',
          discount_total: money(order.discount_amount), discount_type: 'F',
          tax_total: money(taxTotal), total: money(order.total_amount),
          description: order.coupon_code ? `Coupon ${order.coupon_code}` : '',
          created_on: `${date} ${time}`,
          enable_delivery: 0, min_prep_time: 20,
          // Sent per order — there is no dashboard field for it. Railway injects
          // RAILWAY_PUBLIC_DOMAIN, so this is correct on deploy without extra configuration;
          // PETPOOJA_CALLBACK_BASE overrides it for local tunnels or a custom domain.
          callback_url: `${callbackBase()}/api/petpooja/callback`,
          collect_cash: '', otp: '',
        } },
        OrderItem: { details: orderItems },
        /*
         * Order-level tax, aggregated per tax id across every line. Because the items are
         * tax_inclusive with empty item_tax, THIS is where the GST reaches the bill, and
         * restaurant_liable_amt carries the full amount since we remit it (gst_liability
         * 'restaurant').
         */
        Tax: { details: cgstId ? [
          { id: cgstId, title: 'CGST', type: 'P', price: '2.5', tax: money(halfTax), restaurant_liable_amt: money(halfTax) },
          { id: sgstId, title: 'SGST', type: 'P', price: '2.5', tax: money(halfTax), restaurant_liable_amt: money(halfTax) },
        ] : [] },
        // No Discount object: their guide says to omit it, and their own annotated reference payload
        // has none. Order-level discount travels as discount_total + discount_type on Order, and
        // per-item discount as item_discount on the line.
      },
      udid: '',
      device_type: 'Web',
    },
  };
}

/**
 * Relay one of our orders, recording the attempt either way.
 *
 * NEVER throws. The customer has already paid and the parcel is already booked by the time this
 * runs — a POS hiccup must not surface as a failed order, so every outcome is written to
 * petpooja_orders for the admin to see and retry rather than propagated to the caller.
 *
 * Unmapped products are the one thing worth refusing outright: relaying an order with a missing or
 * guessed item id would print a wrong KOT, which is worse than not printing one at all.
 */
export async function relayOrder(orderId, { force = false } = {}) {
  const ts = nowIso();
  const fail = async (reason, request = null) => {
    await query(
      `INSERT INTO petpooja_orders (order_id, rest_id, relay_ok, attempts, request, last_error, created_at, updated_at)
       VALUES ($1,$2,FALSE,1,$3,$4,$5,$5)
       ON CONFLICT (order_id) DO UPDATE SET attempts = petpooja_orders.attempts + 1,
         request = COALESCE(EXCLUDED.request, petpooja_orders.request),
         last_error = EXCLUDED.last_error, updated_at = EXCLUDED.updated_at`,
      [orderId, REST_ID, request ? JSON.stringify(request) : null, reason, ts]
    );
    log('relay', `order=${orderId} | ✗ ${reason}`);
    return { ok: false, reason };
  };

  try {
    if (!petpoojaConfigured()) return await fail('not_configured');

    const order = await getOne('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) return await fail('order_not_found');

    // A ticket on the POS means the kitchen starts baking, so it must never be raised for an order
    // we have not actually been paid for, nor for one already cancelled. The normal caller
    // (finalizePaidOrder) can only reach here on a paid order, but the admin retry endpoint calls
    // relayOrder directly — this is what stops a mis-click from putting an unpaid order in the
    // kitchen. `force` exists for the genuine case of a manually reconciled payment.
    if (!force && order.payment_status !== 'PAID') return await fail(`not_paid (payment_status=${order.payment_status})`);
    if (!force && order.order_status === 'CANCELLED') return await fail('order_cancelled');

    /*
     * Only the warehouse relays over the API.
     *
     * Petpooja has configured exactly one outlet for us, and REST_ID names it. Every ticket we send
     * lands there whatever store is actually baking, so relaying a Jayanagar order would bill it to
     * Begur — the wrong kitchen gets a KOT it will not make, and the right one gets nothing and is
     * billed nowhere. Those orders are keyed in at the store's own terminal instead, and the store
     * portal is where staff see them and type the bill number back.
     *
     * This is NOT a failure and must not be recorded as one: `fail()` would put the order in the
     * admin's "paid but never reached the kitchen" list, where it would sit forever because there
     * is nothing to retry. It is logged on the timeline so the routing decision is still visible.
     */
    if (!force && !storeRelaysToPos(order.store_code)) {
      await query('INSERT INTO order_tracking (order_id, status, remarks, created_at) VALUES ($1,$2,$3,$4)',
        [orderId, 'POS_MANUAL', `Ships from ${order.store_code || 'an unassigned store'} — its staff bill this on their own Petpooja terminal`, ts]).catch(() => {});
      log('relay', `order=${order.order_number} | skip=manual_pos (store=${order.store_code || 'none'})`);
      return { ok: true, skipped: true, reason: 'store_bills_manually' };
    }

    const done = await getOne('SELECT relay_ok FROM petpooja_orders WHERE order_id = $1', [orderId]);
    if (done?.relay_ok) { log('relay', `order=${order.order_number} | skip=already_relayed`); return { ok: true, skipped: true }; }

    // Join our line items to their catalogue. A LEFT JOIN so we can name what is missing.
    const items = await getAll(
      `SELECT oi.product_name, oi.quantity, oi.unit_price, oi.total_price, oi.special_notes,
              pi.item_id AS petpooja_item_id, pi.variation_id AS petpooja_variation_id,
              pi.variation_name AS petpooja_variation_name
         FROM order_items oi
         LEFT JOIN petpooja_items pi ON pi.product_id = oi.product_id AND pi.rest_id = $2
        WHERE oi.order_id = $1`,
      [orderId, REST_ID]
    );
    if (!items.length) return await fail('no_items');
    const unmapped = items.filter((i) => !i.petpooja_item_id).map((i) => i.product_name);
    if (unmapped.length) return await fail(`unmapped_products: ${unmapped.join(', ')}`);

    // The delivery address holds the RECIPIENT's name, phone and coordinates, which is who the
    // rider actually calls — prefer it, and fall back to the account holder only when absent.
    const account = await getOne('SELECT name, email, phone FROM users WHERE id = $1', [order.user_id]);
    const addr = order.address_id
      ? await getOne(`SELECT full_name, phone, address_line1, address_line2, city, state, pincode,
                             latitude, longitude FROM addresses WHERE id = $1`, [order.address_id])
      : null;
    const customer = {
      name: addr?.full_name || account?.name || 'Customer',
      phone: addr?.phone || account?.phone || '',
      email: account?.email || '',
      latitude: addr?.latitude, longitude: addr?.longitude,
    };
    const address = addr
      ? [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
      : 'Address not provided';

    const taxRows = await getAll(
      `SELECT tax_id, name FROM petpooja_taxes WHERE rest_id = $1 ORDER BY tax_id`, [REST_ID]);
    const taxIds = taxRows.map((t) => t.tax_id);

    const payload = buildOrderPayload({ order, items, customer, address, taxIds });
    const r = await saveOrder(payload);

    await query(
      `INSERT INTO petpooja_orders (order_id, rest_id, relay_ok, petpooja_order_id, attempts, request, response, last_error, created_at, updated_at)
       VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8,$8)
       ON CONFLICT (order_id) DO UPDATE SET
         relay_ok = EXCLUDED.relay_ok, petpooja_order_id = EXCLUDED.petpooja_order_id,
         attempts = petpooja_orders.attempts + 1, request = EXCLUDED.request,
         response = EXCLUDED.response, last_error = EXCLUDED.last_error, updated_at = EXCLUDED.updated_at`,
      [orderId, REST_ID, !!r.ok, r.data?.orderID || null, JSON.stringify(payload),
       JSON.stringify(r.data ?? {}), r.ok ? null : r.reason, ts]
    );
    log('relay', `order=${order.order_number} | ${r.ok ? '✓ saved' : `✗ ${r.reason}`}`);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  } catch (err) {
    return await fail(`exception: ${err.message}`);
  }
}

/** Their Update Order Status only accepts cancel (-1); there is no other transition. */
export async function cancelOrder(clientOrderId, cancelReason = 'Cancelled by customer', restId = REST_ID) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  log('cancel-order', `clientorderID=${clientOrderId} | cancelling…`);
  const r = await ppRequest('/update_order_status', {
    ...creds(), restID: restId, orderID: '', clientorderID: String(clientOrderId),
    cancelReason, status: '-1',
  });
  log('cancel-order', r.ok ? `✓ cancelled` : `✗ ${r.reason}`);
  return r;
}

/**
 * Tell the POS the parcel moved, so the merchant sees delivery progress without polling.
 * status: rider-assigned | rider-arrived | pickedup | delivered
 */
export async function riderStatus(clientOrderId, status, riderData = {}) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  const r = await ppRequest('/rider_status_update', {
    ...creds(), status, order_id: String(clientOrderId), external_order_id: '', rider_data: riderData,
  });
  log('rider-status', `order=${clientOrderId} | ${status} | ${r.ok ? '✓' : `✗ ${r.reason}`}`);
  return r;
}

/* ------------------------------------------------------------------ */
/* Store open/closed                                                   */
/* ------------------------------------------------------------------ */

export async function getStoreOpen(restId = REST_ID) {
  const row = await getOne('SELECT store_status FROM petpooja_stores WHERE rest_id = $1', [restId]);
  return row ? !!row.store_status : true;   // unknown store = open, so a missing row never blocks sales
}

export async function setStoreOpen(restId, open, { turnOnTime = null, reason = null } = {}) {
  const ts = nowIso();
  await query(
    `INSERT INTO petpooja_stores (rest_id, store_status, turn_on_time, reason, updated_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (rest_id) DO UPDATE SET
       store_status=EXCLUDED.store_status, turn_on_time=EXCLUDED.turn_on_time,
       reason=EXCLUDED.reason, updated_at=EXCLUDED.updated_at`,
    [restId, !!open, turnOnTime, reason, ts]
  );
  log('store-status', `restID=${restId} | ${open ? 'OPEN' : `CLOSED${reason ? ` (${reason})` : ''}`}`);
}
