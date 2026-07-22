/*
 * Shadowfax Unified API client — intracity last-mile (pickup + drop within the same city).
 * Used for orders delivering to a city where we have a store (Bengaluru, Chennai); everything
 * else goes via Delhivery. We use the "marketplace" order model (pickup = our store,
 * rts = same store) and are PREPAID ONLY (payment_mode 'Prepaid', cod_amount '0').
 *
 *   SHADOWFAX_URL   staging: https://dale.staging.shadowfax.in/api   prod: https://dale.shadowfax.in/api
 *   SHADOWFAX_API   account token — sent as  Authorization: Token <token>
 *
 * Every exported function returns a structured result and never throws — callers check `.ok`.
 */

import { logApiCall } from './apiLogger.js';

const BASE_URL = (process.env.SHADOWFAX_URL || '').trim().replace(/\/$/, '');
const TOKEN = (process.env.SHADOWFAX_API || '').trim();

export const shadowfaxConfigured = () => !!(BASE_URL && TOKEN);
export const shadowfaxBaseUrl = () => BASE_URL;

console.log(`[SHADOWFAX] config | base=${BASE_URL || 'MISSING'} | token=${TOKEN ? TOKEN.slice(0, 6) + '…' : 'MISSING'}`);

// Our stores that act as intracity Shadowfax pickup points. When a city has more than one store
// (Bengaluru), the order ships from the store whose pincode is NEAREST the delivery pincode.
export const SFX_STORES = [
  { name: 'A Dough Cookie — Jayanagar', contact: '9381502998', address_line_1: 'Jain University, 1314, 24th Main Rd, Jayanagar 9th Block', city: 'Bengaluru', state: 'Karnataka', pincode: 560041 },
  { name: 'A Dough Cookie — S.G. Palya', contact: '9381502998', address_line_1: 'No 10, 1st Main Rd, Venkateshwara Layout, S.G. Palya', city: 'Bengaluru', state: 'Karnataka', pincode: 560029 },
  { name: 'A Dough Cookie — Electronic City', contact: '9381502998', address_line_1: 'F3 Alley, GF, 1st Cross, Neeladri Rd, Electronic City Phase I', city: 'Bengaluru', state: 'Karnataka', pincode: 560100 },
  { name: 'A Dough Cookie — Besant Nagar', contact: '9381502998', address_line_1: '63, 6th Avenue, Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: 600090 },
];

// All our stores in the destination's city zone (pincode's first 3 digits), NEAREST FIRST.
// Shadowfax needs a serviceable PICKUP pincode too, so shipment creation tries these in order
// until one succeeds (some store pincodes aren't serviceable on the staging sandbox).
export function zoneStores(destPincode) {
  const pin = Number(String(destPincode).replace(/\D/g, ''));
  if (!pin) return [];
  const zone = String(pin).slice(0, 3);
  return SFX_STORES
    .filter((s) => String(s.pincode).slice(0, 3) === zone)
    .sort((a, b) => Math.abs(a.pincode - pin) - Math.abs(b.pincode - pin));
}

// Nearest single store — used for the checkout delivery estimate. Null if none in the zone.
export function nearestStore(destPincode) {
  return zoneStores(destPincode)[0] || null;
}

function log(label, extra = '') {
  console.log(`[SHADOWFAX] ${label}${extra ? ' | ' + extra : ''}`);
}

// Shadowfax's raw status codes → short, customer-friendly labels for our UI.
const SFX_STATUS_LABELS = {
  new: 'Order placed',
  assigned_for_seller_pickup: 'Pickup assigned',
  ofp: 'Out for pickup',
  seller_pickup_done: 'Picked up from store',
  pickup_done: 'Picked up from store',
  item_manifested: 'Packed',
  bag_in_transit: 'In transit',
  bag_received: 'At delivery hub',
  recd_at_rev_hub: 'At hub',
  ofd: 'Out for delivery',
  delivered: 'Delivered',
  rts_nd: 'Delivery attempted',
  rts: 'Returning to store',
  rts_d: 'Returned to store',
  rto: 'Returned to store',
  cancelled: 'Cancelled',
  cancelled_by_customer: 'Cancelled',
  lost: 'Lost in transit',
  on_hold: 'On hold',
};
export function sfxStatusLabel(status) {
  const key = String(status || '').toLowerCase().trim();
  if (!key) return null;
  return SFX_STATUS_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Forward-progression rank for Shadowfax statuses (higher = later in the lifecycle). Used to stop a
// live-tracking poll from DOWNGRADING a status a webhook already advanced — e.g. the staging API
// returning `new` must not wipe a webhook-delivered "Out for delivery"/"Delivered". Return/cancel/lost
// are terminal, so they rank high enough to stick once reached.
const SFX_STATUS_RANK = {
  new: 1,
  on_hold: 1,
  assigned_for_seller_pickup: 2,
  ofp: 3,
  seller_pickup_done: 4,
  pickup_done: 4,
  item_manifested: 5,
  bag_in_transit: 6,
  bag_received: 7,
  recd_at_rev_hub: 7,
  ofd: 8,
  rts_nd: 9,
  rts: 90,
  rts_d: 95,
  rto: 95,
  cancelled: 100,
  cancelled_by_customer: 100,
  lost: 100,
  delivered: 100,
};
// Rank a value that may be a raw status_id (from the poll) OR a stored human label (from the webhook).
// Unknown/empty → 0 so it can seed an unset status but never override a recognised one.
export function sfxStatusRank(value) {
  const key = String(value || '').toLowerCase().trim();
  if (!key) return 0;
  if (key in SFX_STATUS_RANK) return SFX_STATUS_RANK[key];
  for (const [id, label] of Object.entries(SFX_STATUS_LABELS)) {
    if (label.toLowerCase() === key) return SFX_STATUS_RANK[id] ?? 0;
  }
  return 0;
}

async function sfxRequest(path, { method = 'GET', query, body, timeoutMs = 15_000 } = {}) {
  const url = new URL(BASE_URL + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    logApiCall({ service: 'shadowfax', method, endpoint: path, request: { query, body }, response: data, status: res.status, ok: res.ok, durationMs: Date.now() - t0 });
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    logApiCall({ service: 'shadowfax', method, endpoint: path, request: { query, body }, ok: false, durationMs: Date.now() - t0, error: err.message });
    return { status: 0, ok: false, data: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// Is a destination pincode serviceable for customer delivery?
export async function sfxServiceability(pincode, service = 'customer_delivery') {
  if (!shadowfaxConfigured()) return { ok: false, serviceable: false, reason: 'not_configured' };
  const r = await sfxRequest('/v1/clients/serviceability/', { query: { service, pincodes: pincode, count: 5 } });
  if (!r.ok || !Array.isArray(r.data)) {
    log('serviceability', `pin=${pincode} | FAILED status=${r.status} | ${JSON.stringify(r.data ?? r.error ?? '').slice(0, 140)}`);
    return { ok: false, serviceable: false, reason: `status_${r.status}` };
  }
  const row = r.data.find((x) => String(x.code) === String(pincode));
  const serviceable = !!(row && Array.isArray(row.services) && row.services.length);
  log('serviceability', `pin=${pincode} | ${serviceable ? '✓ ' + row.services.join('/') : '✗ not serviceable'}`);
  return { ok: true, serviceable, services: row?.services || [] };
}

// Create a forward (marketplace) order. Returns { ok, awb?, reason?, detail }.
// `pickup` = our store in the customer's city; prepaid only.
export async function createShadowfaxOrder({ order, address, items = [], pickup }) {
  if (!shadowfaxConfigured()) return { ok: false, reason: 'not_configured' };
  const contact = String(address.phone || pickup.contact || '').replace(/\D/g, '').slice(-10);
  const destPin = Number(String(address.pincode).replace(/\D/g, ''));
  // The Shadowfax STAGING sandbox only services a handful of pickup/return pincodes (e.g. 560007,
  // 560068, 560077) — our real store pincodes (560029/560041/560100) aren't onboarded there. Set
  // SHADOWFAX_TEST_PICKUP_PIN to one of the accepted pins to test intracity end-to-end on staging.
  // Leave it UNSET in production so the real store pincode is used.
  const pickupPin = Number(process.env.SHADOWFAX_TEST_PICKUP_PIN || pickup.pincode);
  const payload = {
    order_type: 'marketplace',
    order_details: {
      client_order_id: order.order_number,
      actual_weight: 500,
      product_value: Number(order.subtotal ?? order.total_amount ?? 0),
      payment_mode: 'Prepaid',
      cod_amount: '0',
      total_amount: Number(order.total_amount ?? 0),
      order_service: 'regular',
    },
    customer_details: {
      name: address.full_name || 'Customer',
      contact,
      address_line_1: [address.address_line1, address.address_line2].filter(Boolean).join(', ') || address.city,
      city: address.city,
      state: address.state || '',
      pincode: destPin,
    },
    pickup_details: {
      name: pickup.name,
      contact: pickup.contact,
      address_line_1: pickup.address_line_1,
      city: pickup.city,
      state: pickup.state,
      pincode: pickupPin,
    },
    rts_details: {
      name: pickup.name,
      contact: pickup.contact,
      address_line_1: pickup.address_line_1,
      city: pickup.city,
      state: pickup.state,
      pincode: pickupPin,
    },
    product_details: (items.length ? items : [{ product_name: 'Cookies', unit_price: order.total_amount }]).map((i) => ({
      sku_name: i.product_name || 'Cookies',
      price: Number(i.unit_price ?? i.price ?? 0),
      category: 'Food',
    })),
  };

  const overrideNote = pickupPin !== pickup.pincode ? ` (SHADOWFAX_TEST_PICKUP_PIN override, real store pin=${pickup.pincode})` : '';
  log('create', `HIT /v3/clients/orders/ | order=${order.order_number} | pickup=${pickupPin}${overrideNote} | dest=${destPin} | creating…`);
  const r = await sfxRequest('/v3/clients/orders/', { method: 'POST', body: payload });
  // Shadowfax returns HTTP 200 for both success and business failures (message: Success/Failure).
  if (r.ok && r.data?.message === 'Success' && r.data?.data?.awb_number) {
    const awb = r.data.data.awb_number;
    log('create', `order=${order.order_number} | ✓ awb=${awb}`);
    return { ok: true, awb, detail: r.data.data };
  }
  const reason = r.data?.errors || r.data?.message || `status_${r.status}`;
  log('create', `order=${order.order_number} | ✗ ${JSON.stringify(reason).slice(0, 180)}`);
  return { ok: false, reason: String(reason).slice(0, 200), detail: r.data };
}

// Live tracking for an AWB. Returns { ok, status?, trackUrl?, data }.
export async function trackShadowfax(awb) {
  if (!shadowfaxConfigured()) return { ok: false, reason: 'not_configured' };
  const r = await sfxRequest(`/v4/clients/orders/${encodeURIComponent(awb)}/track/`);
  if (!r.ok || r.data?.message !== 'Success') {
    log('track', `awb=${awb} | FAILED status=${r.status}`);
    return { ok: false, reason: `status_${r.status}`, data: r.data };
  }
  return { ok: true, status: r.data?.order_details?.status, trackUrl: r.data?.order_details?.customer_track_url || null, data: r.data };
}

// Proof of Delivery — recipient's signature sheet (S3 PDF) + name. Only after the shipment is
// `delivered` / `rts_d`. Shadowfax has no printable shipping label (the rider collects from the
// store), so POD + the customer tracking URL are the documents we can surface. Returns
// { ok, recipient?, urls: string[], data }.
export async function getShadowfaxPod(awb) {
  if (!shadowfaxConfigured()) return { ok: false, reason: 'not_configured' };
  const r = await sfxRequest('/v1/clients/pod_details/', { method: 'POST', body: { awb_numbers: [awb] } });
  if (!r.ok || r.data?.message !== 'Success') {
    log('pod', `awb=${awb} | FAILED status=${r.status}`);
    return { ok: false, reason: `status_${r.status}`, data: r.data };
  }
  const row = r.data?.pod_details?.[awb] || null;
  // recipient_signature arrives as a Python-style stringified list: "['https://…report.pdf']".
  const urls = String(row?.recipient_signature || '').match(/https?:\/\/[^'"\]\s]+/g) || [];
  log('pod', `awb=${awb} | ✓ ${urls.length} doc(s)`);
  return { ok: true, recipient: row?.recipient_name || row?.recipient || null, urls, data: row };
}
