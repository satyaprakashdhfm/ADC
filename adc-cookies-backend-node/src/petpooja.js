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
import { getAll, getOne, query, nowIso } from './db.js';
import { logApiCall } from './apiLogger.js';

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
async function ppRequest(path, body, { timeoutMs = 20_000 } = {}) {
  const url = `${BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
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
  // Their restaurant id has appeared under several spellings across doc versions, and the push
  // body may carry it where a fetch does not. Try each, then fall back to config.
  const rid = String(
    r0.restaurantid ?? r0.restID ?? r0.res_id ?? r0.id ??
    payload?.restID ?? payload?.restaurantid ?? restId ?? ''
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

export async function saveOrder(payload) {
  if (!petpoojaConfigured()) return { ok: false, reason: 'not_configured' };
  log('save-order', `orderID=${payload?.OrderInfo?.Order?.orderID || '?'} | relaying…`);
  const r = await ppRequest('/save_order', { ...creds(), ...payload });
  log('save-order', r.ok ? `✓ ${JSON.stringify(r.data).slice(0, 160)}` : `✗ ${r.reason}`);
  return r;
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
