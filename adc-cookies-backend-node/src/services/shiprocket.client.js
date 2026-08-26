/*
 * Shiprocket Hyperlocal — intracity delivery.
 *
 * Replaces Shadowfax for same-city orders. Shadowfax never assigned a rider in any live test and
 * their support was unreachable, so intracity has been blocked at checkout; this is what unblocks it.
 *
 * Flow, in order — each step needs the one before it:
 *   1. login              -> bearer token, valid 10 days
 *   2. serviceability     -> is this lane covered, and at what rate
 *   3. create order       -> shipment_id
 *   4. assign AWB         -> awb + rider dispatched
 *   webhook               -> tracking events land on /api/shiprocket/webhook
 *
 * Two things about this API that are easy to get wrong:
 *   • Auth is an external API USER (email + password), not an API key. Create one at
 *     app.shiprocket.in/seller/settings/additional-settings/api-users. The token expires after
 *     10 days, so it is cached and re-fetched rather than kept in an env var.
 *   • Hyperlocal REQUIRES geo coordinates on both ends. A pincode alone returns no couriers, so a
 *     missing lat/long is a hard failure here rather than something to paper over.
 */
import { logApiCall } from '../utils/logger.js';

const BASE = (process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external').replace(/\/+$/, '');
const EMAIL = (process.env.SHIPROCKET_EMAIL || '').trim();
const PASSWORD = (process.env.SHIPROCKET_PASSWORD || process.env.SHIPROCKET_API || '').trim();
/*
 * The pickup NICKNAME registered in their panel — orders are collected from whatever address that
 * name points at, not from whichever ADC store happened to match the destination zone. So quoting
 * must use this same origin, or the rate we show is for a warehouse we do not dispatch from.
 */
export const SHIPROCKET_PICKUP = (process.env.SHIPROCKET_PICKUP_LOCATION || 'warehouse-1').trim();
export const SHIPROCKET_ORIGIN = {
  pin: (process.env.SHIPROCKET_PICKUP_PIN || '560035').trim(),
  lat: Number(process.env.SHIPROCKET_PICKUP_LAT || 12.9130),
  long: Number(process.env.SHIPROCKET_PICKUP_LONG || 77.7070),
};

export const shiprocketConfigured = () => !!(EMAIL && PASSWORD);

const log = (op, msg) => console.log(`[SHIPROCKET] ${op} | ${msg}`);

console.log(`[SHIPROCKET] config | base=${BASE} | email=${EMAIL ? 'set' : 'MISSING'} | password=${PASSWORD ? 'set' : 'MISSING'} | pickup=${SHIPROCKET_PICKUP}`);

/* ------------------------------------------------------------------ */
/* Auth — token cached until shortly before it expires                 */
/* ------------------------------------------------------------------ */

let cachedToken = null;
let tokenExpiry = 0;
let inFlight = null;          // collapses concurrent logins into one

/**
 * Their token lasts 10 days. We refresh a day early: a token that expires mid-checkout would fail
 * an order the customer has already paid for, and one wasted login a day is a trivial price.
 */
async function getToken(force = false) {
  if (!force && cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      const data = await res.json().catch(() => null);
      logApiCall({ service: 'shiprocket', method: 'POST', endpoint: '/auth/login',
        request: { email: EMAIL, password: '***' }, response: data ? { ...data, token: data.token ? '***' : undefined } : null,
        status: res.status, ok: !!data?.token, durationMs: Date.now() - t0 });
      if (!data?.token) { log('auth', `✗ ${res.status} ${JSON.stringify(data).slice(0, 160)}`); return null; }
      cachedToken = data.token;
      tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;   // 9 of their 10 days
      log('auth', `✓ token acquired | company_id=${data.company_id} | valid 9 days`);
      return cachedToken;
    } catch (err) {
      log('auth', `✗ ${err.message}`);
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Authenticated request. A 401 means the token died early, so retry once with a fresh one rather
 * than surfacing an auth error for something we can fix ourselves.
 */
async function srRequest(method, path, { query: qs, body, retry = true } = {}) {
  if (!shiprocketConfigured()) return { ok: false, reason: 'not_configured' };
  const token = await getToken();
  if (!token) return { ok: false, reason: 'auth_failed' };

  const url = `${BASE}${path}${qs ? `?${new URLSearchParams(qs)}` : ''}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (res.status === 401 && retry) {
      log(path, 'token rejected — refreshing and retrying once');
      await getToken(true);
      return srRequest(method, path, { query: qs, body, retry: false });
    }

    const ok = res.ok && data?.status !== false;
    logApiCall({ service: 'shiprocket', method, endpoint: path, request: body ?? qs, response: data,
      status: res.status, ok, durationMs: Date.now() - t0 });
    return { ok, status: res.status, data, reason: ok ? null : (data?.message || data?.errors || `http_${res.status}`) };
  } catch (err) {
    logApiCall({ service: 'shiprocket', method, endpoint: path, request: body ?? qs, ok: false,
      durationMs: Date.now() - t0, error: err.message });
    return { ok: false, status: 0, data: null, reason: `network_error: ${err.message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Serviceability                                                      */
/* ------------------------------------------------------------------ */

/**
 * Which hyperlocal couriers cover this lane, and at what rate.
 *
 * Coordinates are mandatory — `is_new_hyperlocal=1` with only pincodes returns nothing, so we fail
 * fast and say why instead of reporting the lane unserviceable.
 */
export async function checkServiceability({ pickupPin, deliveryPin, latFrom, longFrom, latTo, longTo, modeOfTransport }) {
  if (![latFrom, longFrom, latTo, longTo].every((v) => v != null && v !== '')) {
    return { ok: false, reason: 'missing_coordinates', serviceable: false };
  }
  const q = {
    pickup_postcode: String(pickupPin), delivery_postcode: String(deliveryPin),
    lat_from: String(latFrom), long_from: String(longFrom),
    lat_to: String(latTo), long_to: String(longTo),
    is_new_hyperlocal: '1',
  };
  if (modeOfTransport) q.mode_of_transport = String(modeOfTransport);

  const r = await srRequest('GET', '/courier/serviceability', { query: q });
  if (!r.ok) { log('serviceability', `✗ ${pickupPin}→${deliveryPin} | ${JSON.stringify(r.reason).slice(0, 120)}`); return { ...r, serviceable: false }; }

  const couriers = Array.isArray(r.data?.data) ? r.data.data
    : Array.isArray(r.data?.data?.available_courier_companies) ? r.data.data.available_courier_companies : [];
  if (!couriers.length) { log('serviceability', `✗ ${pickupPin}→${deliveryPin} | no couriers`); return { ok: true, serviceable: false, couriers: [] }; }

  const cheapest = couriers.reduce((a, b) => ((Number(b.rates ?? b.rate) || Infinity) < (Number(a.rates ?? a.rate) || Infinity) ? b : a));
  log('serviceability', `✓ ${pickupPin}→${deliveryPin} | ${couriers.length} courier(s) | cheapest=${cheapest.courier_name} ₹${cheapest.rates ?? cheapest.rate}`);
  return { ok: true, serviceable: true, couriers, cheapest,
    rate: Number(cheapest.rates ?? cheapest.rate) || null,
    etd: cheapest.etd || cheapest.estimated_delivery_days || null };
}

/**
 * First store that can actually serve this drop, trying nearest first.
 *
 * Nearest is not the same as serviceable. Measured live: a drop in Kadugodi is serviceable from
 * Begur at 18.69 km but NOT from S.G. Palya at 17.59 km — coverage is drawn by their zones and by
 * whether a pickup address is fully verified, not by distance alone. Picking the nearest store and
 * stopping there would fail orders that a slightly further store could have delivered.
 *
 * Returns { store, rate, distance } or null when no store covers the drop.
 */
/*
 * The pickup nicknames registered with Shiprocket.
 *
 * This deliberately does NOT filter on their `status` field. That was a wrong reading: `status` is
 * 2 only on the PRIMARY location and 1 on every other, while their panel's own Verification Status
 * column reads VERIFIED for all of them. Gating on status===2 therefore excluded four perfectly
 * usable stores — it took Chennai offline entirely and forced every Bengaluru order through Begur
 * at a longer distance and a higher fee.
 *
 * Proven on 2026-08-07: bookings from `jayanagar` and `besant`, both status=1, were ACCEPTED.
 *
 * What is still worth checking is that the nickname EXISTS on their side. Orders are collected from
 * whatever the nickname resolves to in their panel, so a store whose pickupName is missing or
 * misspelt cannot be dispatched from, and quoting it would sell a delivery we cannot make.
 *
 * Cached for 30 minutes: this sits in the checkout path and the list changes at human speed.
 */
let pickupCache = null;
let pickupExpiry = 0;

/**
 * Every pickup location as Shiprocket reports it, verified or not — for the admin screen, which
 * needs to show WHY a store cannot dispatch, not merely that it can't. Uncached: this is an
 * operator pressing refresh, and a stale answer is exactly what makes this screen useless.
 */
export async function listPickups() {
  const r = await srRequest('GET', '/settings/company/pickup');
  if (!r.ok) return { ok: false, reason: r.reason, pickups: [] };
  const list = r.data?.data?.shipping_address || r.data?.shipping_address || [];
  return {
    ok: true,
    pickups: list.map((p) => ({
      id: p.id,
      nickname: String(p.pickup_location || '').trim(),
      verified: Number(p.status) === 2,
      status: Number(p.status),
      isPrimary: !!Number(p.is_primary_location),
      phoneVerified: !!Number(p.phone_verified),
      city: p.city, pincode: p.pin_code, address: p.address,
      contact: [p.name, p.phone].filter(Boolean).join(' / '),
    })),
  };
}

export async function registeredPickups({ force = false } = {}) {
  if (!force && pickupCache && Date.now() < pickupExpiry) return pickupCache;
  const r = await srRequest('GET', '/settings/company/pickup');
  if (!r.ok) {
    // Do NOT treat an unreadable list as "nothing is verified" — that would take intracity offline
    // over a transient API blip. Keep the last known good set; only fail closed if we never had one.
    log('pickups', `✗ could not read pickup list (${JSON.stringify(r.reason).slice(0, 80)}) — keeping last known set`);
    return pickupCache || new Set();
  }
  const list = r.data?.data?.shipping_address || r.data?.shipping_address || [];
  pickupCache = new Set(list.map((p) => String(p.pickup_location).trim().toLowerCase()));
  pickupExpiry = Date.now() + 30 * 60_000;
  log('pickups', `${pickupCache.size} registered: ${[...pickupCache].join(', ')}`);
  return pickupCache;
}

export async function pickServiceableStore(stores, { pin, lat, lng }) {
  const registered = await registeredPickups();
  for (const s of stores) {
    if (s.latitude == null || s.longitude == null) continue;
    // Skip only a store whose pickup nickname does not exist on their side — see above.
    const nick = String(s.pickupName || '').trim().toLowerCase();
    if (!nick || !registered.has(nick)) {
      log('pick-store', `✗ ${s.name} skipped — pickup "${s.pickupName || 'none'}" is not registered with Shiprocket`);
      continue;
    }
    const q = await checkServiceability({
      pickupPin: String(s.pincode), deliveryPin: String(pin),
      latFrom: s.latitude, longFrom: s.longitude, latTo: lat, longTo: lng,
    });
    if (q.serviceable) {
      log('pick-store', `✓ ${s.name} | ₹${q.rate} | ${q.couriers?.[0]?.distance} km`);
      return { store: s, rate: q.rate, distance: q.couriers?.[0]?.distance ?? null, etdHours: q.couriers?.[0]?.etd_hours ?? null };
    }
    log('pick-store', `✗ ${s.name} cannot serve ${pin}`);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

// Their category_name is a CLOSED list — anything outside it is rejected outright.
const CATEGORIES = ['Electronics', 'Clothes', 'Medicines', 'Food', 'Documents', 'Groceries', 'Others'];
const CATEGORY = CATEGORIES.includes(process.env.SHIPROCKET_CATEGORY) ? process.env.SHIPROCKET_CATEGORY : 'Food';

/**
 * Create a hyperlocal order. Returns { shipment_id, order_id } — no rider yet; that needs the AWB
 * assignment below. Two steps rather than one, so a serviceable-but-unassignable lane fails at a
 * point where we still know what happened.
 */
export async function createHyperlocalOrder({ order, items, customer, address, pickupLocation = SHIPROCKET_PICKUP, dims, category = CATEGORY }) {
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const orderDate = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`;

  if (address?.latitude == null || address?.longitude == null) {
    log('create-order', `✗ order=${order.order_number} | delivery coordinates missing`);
    return { ok: false, reason: 'missing_delivery_coordinates' };
  }

  const nameParts = String(customer?.name || 'Customer').trim().split(/\s+/);
  const body = {
    order_id: order.order_number,
    order_date: orderDate,
    pickup_location: pickupLocation,
    billing_customer_name: nameParts[0],
    billing_last_name: nameParts.slice(1).join(' ') || '',
    billing_address: address.address_line1,
    billing_address_2: address.address_line2 || '',
    billing_city: address.city,
    billing_pincode: String(address.pincode),
    billing_state: address.state,
    billing_country: 'India',
    billing_email: customer?.email || '',
    billing_phone: String(customer?.phone || address.phone || '').replace(/\D/g, '').slice(-10),
    shipping_is_billing: true,
    // Delivery coordinates — mandatory for hyperlocal.
    latitude: String(address.latitude),
    longitude: String(address.longitude),
    order_items: items.map((i) => ({
      name: i.product_name,
      category_name: CATEGORIES.includes(category) ? category : CATEGORY,
      sku: `ADC-${i.product_id ?? 'X'}`,
      units: Number(i.quantity) || 1,
      selling_price: String(i.unit_price),
    })),
    payment_method: 'Prepaid',           // we only ship after Razorpay confirms
    sub_total: Number(order.subtotal) || Number(order.total_amount) || 0,
    collect_shipping_fees: false,        // the customer already paid us the delivery fee
    shipping_method: 'HL',               // hyperlocal
    length: dims?.length ?? 15,
    breadth: dims?.breadth ?? 15,
    height: dims?.height ?? 10,
    weight: dims?.weight ?? 0.5,
  };

  const r = await srRequest('POST', '/orders/create/adhoc', { body });
  if (!r.ok) { log('create-order', `✗ order=${order.order_number} | ${JSON.stringify(r.reason).slice(0, 160)}`); return r; }
  const shipmentId = r.data?.shipment_id ?? r.data?.data?.shipment_id;
  const srOrderId = r.data?.order_id ?? r.data?.data?.order_id;
  log('create-order', `✓ order=${order.order_number} | shipment_id=${shipmentId} | sr_order_id=${srOrderId}`);
  return { ok: true, shipmentId, srOrderId, data: r.data };
}

/**
 * Assign a courier and get the AWB. This is what actually dispatches a rider.
 * vehicleType 2 (default) / 3 / 4 wheeler.
 */
export async function assignAwb(shipmentId, { courierId, vehicleType, futurePickupScheduled } = {}) {
  const body = { shipment_id: String(shipmentId) };
  if (courierId) body.courier_id = String(courierId);
  if (vehicleType) body.vehicle_type = String(vehicleType);
  if (futurePickupScheduled) body.future_pickup_scheduled = futurePickupScheduled;

  const r = await srRequest('POST', '/courier/assign/awb', { body });
  if (!r.ok) { log('assign-awb', `✗ shipment=${shipmentId} | ${JSON.stringify(r.reason).slice(0, 160)}`); return r; }

  const d = r.data?.response?.data ?? r.data?.data ?? r.data;
  const awb = d?.awb_code ?? d?.awb ?? null;

  /*
   * Assignment is ASYNCHRONOUS for hyperlocal. A successful call answers
   *   {"success":true,"message":"We are processing your request"}
   * with NO awb — they then search for a rider and deliver the awb by webhook
   * (SEARCHING FOR RIDER -> RIDER ASSIGNED). Treating a missing awb as a failure would mark a
   * perfectly good dispatch as broken, so `pending` is a normal outcome here, not an error.
   */
  if (!awb) {
    log('assign-awb', `✓ shipment=${shipmentId} | accepted, searching for rider — awb will arrive by webhook`);
    return { ok: true, pending: true, awb: null, message: d?.message || r.data?.message, data: d };
  }
  log('assign-awb', `✓ shipment=${shipmentId} | awb=${awb} | courier=${d?.courier_name || '?'}`);
  return { ok: true, pending: false, awb, courierName: d?.courier_name, data: d };
}

/**
 * Shiprocket wallet balance, in rupees.
 *
 * Creating a hyperlocal order is free; ASSIGNING a rider is what draws on the wallet. That split is
 * why an empty wallet produced an order sitting at NEW with an unpaid "Ship Now" in their panel and
 * nothing wrong on our side — the booking genuinely succeeded, the dispatch never happened.
 *
 * Returns null rather than throwing on any failure. This is advisory: nothing should refuse to sell
 * a cookie because a balance lookup timed out.
 */
export async function getWalletBalance() {
  // Relative to BASE, which already ends in /v1/external — spelling the prefix out here again
  // produced .../v1/external/v1/external/... and a 404 that read exactly like "no such endpoint".
  const r = await srRequest('GET', '/account/details/wallet-balance');
  if (!r.ok) { log('wallet', `✗ ${JSON.stringify(r.reason).slice(0, 120)}`); return null; }
  const raw = r.data?.data?.balance_amount ?? r.data?.balance_amount;
  const balance = raw == null ? null : Number(raw);
  if (balance == null || Number.isNaN(balance)) { log('wallet', `✗ unexpected shape: ${JSON.stringify(r.data).slice(0, 120)}`); return null; }
  log('wallet', `balance=₹${balance}`);
  return balance;
}

/*
 * The same balance, but safe to ask for on a poll.
 *
 * The store tablet re-reads its order list every few seconds and the balance moves only when an
 * order is dispatched or someone tops up, so a fresh call per poll would be thousands of requests a
 * day to learn the same number. One minute is well inside the window that matters: nobody empties a
 * wallet and accepts an order in the same sixty seconds.
 */
const WALLET_TTL_MS = 60_000;
let walletCache = { at: 0, balance: null };

export async function getWalletBalanceCached() {
  if (Date.now() - walletCache.at < WALLET_TTL_MS) return walletCache.balance;
  const balance = await getWalletBalance().catch(() => null);
  // A failed lookup is cached too, briefly. Otherwise every poll retries a carrier that is down.
  walletCache = { at: Date.now(), balance };
  return balance;
}

/*
 * One shape for "can we still dispatch a rider", so the admin and the store tablet cannot disagree
 * about it. 300 is roughly two intracity delivery fees: enough runway to notice and top up, not so
 * little that the warning arrives after the first failure, not so much that it cries wolf all day.
 */
export const WALLET_LOW_WATERMARK = 300;

export async function walletStatus() {
  if (!shiprocketConfigured()) return { ok: false, reason: 'not_configured' };
  const balance = await getWalletBalanceCached();
  if (balance == null) return { ok: false, reason: 'lookup_failed' };
  return { ok: true, balance, low: balance < WALLET_LOW_WATERMARK, lowWatermark: WALLET_LOW_WATERMARK };
}

/** Rider name/phone once assigned, for the order page. */
/*
 * Track by AWB — and the only call that carries the rider.
 *
 * /courier/track/shipment/{id} answers about the booking; this one answers about the parcel, and
 * only this one returns `courier_agent_details`: the rider's name, their number, their live
 * latitude and longitude, and how far they are from the pickup. Same account, same auth, one
 * different path.
 *
 * We were asking /courier/hyperlocal/get_rider_data for exactly that and getting a flat 404 —
 * verified live on 2026-08-16 against a real in-flight AWB, while this call returned the rider's
 * coordinates in the same second. Because that lookup is best-effort and swallows its own errors
 * so it can never break a webhook, the 404 never surfaced: the rider simply never had a name.
 */
export async function trackByAwb(awb) {
  const r = await srRequest('GET', `/courier/track/awb/${encodeURIComponent(awb)}`);
  if (!r.ok) return r;
  const td = r.data?.tracking_data ?? r.data;
  const t = td?.shipment_track?.[0] ?? {};
  const a = t.courier_agent_details || {};
  const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const rider = (a.rider_name || a.rider_contact || a.rider_lat)
    ? {
        name: a.rider_name || null,
        contact: a.rider_contact || null,
        lat: num(a.rider_lat),
        lng: num(a.rider_long),
        distanceToPickupKm: num(a.distance_between_rider_and_pickup),
      }
    : null;
  if (rider) log('rider', `awb=${awb} | ${rider.name || 'unnamed'} | ${rider.lat ?? '?'},${rider.lng ?? '?'}`);
  return {
    ok: true,
    awb: t.awb_code || String(awb),
    status: t.current_status || null,
    courierName: t.courier_name || null,
    trackUrl: td?.track_url || `https://shiprocket.co/tracking/${awb}`,
    activities: td?.shipment_track_activities || [],
    rider,
    data: td,
  };
}

// Kept for the webhook's rider->POS relay. Now sourced from the call that actually answers.
export async function getRiderData(awb) {
  const r = await trackByAwb(awb);
  if (!r.ok) return r;
  if (!r.rider) return { ok: false, reason: 'no rider assigned yet' };
  return { ok: true, rider: { rider_name: r.rider.name, rider_contact: r.rider.contact, ...r.rider } };
}

/**
 * Track by SHIPMENT id.
 *
 * The hyperlocal document lists no tracking endpoint and presents webhooks as the only feed, which
 * is not true: /courier/track/shipment/{id} works and returns the awb, live status, courier and the
 * activity trail. That matters — it means an intracity order is not hostage to their webhook being
 * configured correctly, and the awb can be recovered even when no webhook ever arrives.
 *
 * The awb is NOT available at assignment time (that call is async), so this is also how we learn it.
 */
export async function trackShiprocket(shipmentId, srOrderId, awb = null) {
  /* Once an AWB exists, ask about the parcel rather than the booking: same status, plus the rider
     and their position. Before one exists there is nothing to ask about, so the booking and then
     the order answer instead — see the fallbacks below. */
  if (awb) {
    const byAwb = await trackByAwb(awb);
    if (byAwb.ok && byAwb.status) return { ...byAwb, statusFrom: 'awb' };
  }
  const r = await srRequest('GET', `/courier/track/shipment/${encodeURIComponent(shipmentId)}`);
  if (!r.ok) return r;
  const td = r.data?.tracking_data ?? r.data;
  const t = td?.shipment_track?.[0] ?? {};
  const out = {
    ok: true,
    awb: t.awb_code || null,
    status: t.current_status || null,
    courierName: t.courier_name || null,
    pickupDate: t.pickup_date || null,
    deliveredDate: t.delivered_date || null,
    trackUrl: td?.track_url || (t.awb_code ? `https://shiprocket.co/tracking/${t.awb_code}` : null),
    activities: td?.shipment_track_activities || [],
    data: td,
  };
  if (out.status || !srOrderId) return out;

  /*
   * Nothing from shipment tracking — so ask about the ORDER instead.
   *
   * Shipment tracking answers about an AWB, and an AWB only exists once a rider has been found. An
   * order still waiting for one therefore tracks as `status: null` with no activities, and stays
   * that way forever if it is cancelled before a rider is ever assigned. Verified live on
   * 2026-08-14: three orders cancelled in Shiprocket's own panel reported nothing at all here,
   * while /orders/show said CANCELED for every one of them.
   *
   * So we were asking the one endpoint that could not answer and ignoring the one that could. The
   * store portal sat on "Searching for a rider" for orders Shiprocket had already closed.
   */
  const o = await srRequest('GET', `/orders/show/${encodeURIComponent(srOrderId)}`);
  const status = (o.ok && (o.data?.data?.status ?? o.data?.status)) || null;
  if (status) log('track', `shipment ${shipmentId} silent → order ${srOrderId} says ${status}`);
  return { ...out, status, statusFrom: status ? 'order' : 'shipment' };
}

export async function cancelShiprocketOrder(srOrderIds) {
  const ids = (Array.isArray(srOrderIds) ? srOrderIds : [srOrderIds]).map(Number);
  const r = await srRequest('POST', '/orders/cancel', { body: { ids } });
  log('cancel', r.ok ? `✓ ${ids.join(',')}` : `✗ ${JSON.stringify(r.reason).slice(0, 120)}`);
  return r;
}

/**
 * Their webhook statuses mapped onto ours.
 *
 * Deliberately conservative on the early ones: "RIDER ASSIGNED" means a rider was allocated, not
 * that anything left the store, so it must not read as shipped to the customer.
 */
export function shiprocketStatusToOrderStatus(status) {
  const s = String(status || '').toUpperCase();
  if (/DELIVERED/.test(s)) return 'DELIVERED';
  if (/CANCELL?ED|RTO/.test(s)) return 'CANCELLED';
  if (/OUT FOR DELIVERY|IN TRANSIT|PICKED ?UP|DISPATCH/.test(s)) return 'OUT_FOR_DELIVERY';
  if (/RIDER ASSIGNED|PICKUP SCHEDULED|AWB ASSIGNED/.test(s)) return 'PACKED';
  return null;   // unknown status: leave the order alone rather than guess
}
