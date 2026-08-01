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
import { logApiCall } from './apiLogger.js';

const BASE = (process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in/v1/external').replace(/\/+$/, '');
const EMAIL = (process.env.SHIPROCKET_EMAIL || '').trim();
const PASSWORD = (process.env.SHIPROCKET_PASSWORD || process.env.SHIPROCKET_API || '').trim();
export const SHIPROCKET_PICKUP = (process.env.SHIPROCKET_PICKUP_LOCATION || 'Begur').trim();

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

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

// Their category_name is a closed list; anything else is rejected. Cookies are Food.
const CATEGORY = 'Food';

/**
 * Create a hyperlocal order. Returns { shipment_id, order_id } — no rider yet; that needs the AWB
 * assignment below. Two steps rather than one, so a serviceable-but-unassignable lane fails at a
 * point where we still know what happened.
 */
export async function createHyperlocalOrder({ order, items, customer, address, pickupLocation = SHIPROCKET_PICKUP, dims }) {
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
      category_name: CATEGORY,
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
  const awb = d?.awb_code ?? d?.awb;
  log('assign-awb', `✓ shipment=${shipmentId} | awb=${awb} | courier=${d?.courier_name || '?'}`);
  return { ok: true, awb, courierName: d?.courier_name, data: d };
}

/** Rider name/phone once assigned, for the order page. */
export async function getRiderData(awb) {
  const r = await srRequest('GET', '/courier/hyperlocal/get_rider_data', { query: { awb: String(awb) } });
  if (!r.ok) return r;
  const d = r.data?.data ?? r.data;
  log('rider-data', `awb=${awb} | rider=${d?.rider_name || d?.name || 'unassigned'}`);
  return { ok: true, rider: d };
}

/** Track by AWB. Webhooks are the primary signal; this is for on-demand refresh. */
export async function trackShiprocket(awb) {
  const r = await srRequest('GET', `/courier/track/awb/${encodeURIComponent(awb)}`);
  if (!r.ok) return r;
  const td = r.data?.tracking_data ?? r.data?.[0]?.tracking_data ?? r.data;
  return { ok: true, status: td?.shipment_track?.[0]?.current_status || td?.track_status || null,
    scans: td?.shipment_track_activities || [], data: td };
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
