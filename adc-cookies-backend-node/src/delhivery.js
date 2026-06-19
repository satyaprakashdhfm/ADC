/*
 * Delhivery B2C client — the single place every Delhivery call goes through.
 *
 * Base URL comes from ONE env var (DELHIVERY_BASE_URL) so flipping staging→production is a
 * one-line change. Auth is `Authorization: Token <token>` (NOT Bearer) for every endpoint here.
 *
 *   DELHIVERY_BASE_URL   staging: https://staging-express.delhivery.com
 *                        prod:    https://track.delhivery.com
 *   DELIVERY_API_TOKEN   account API token (from One Panel → Settings → API Setup)
 *
 * NOTE: staging and production use DIFFERENT tokens. Our current token is production-only.
 * Set DELIVERY_API_TOKEN to the staging token when DELHIVERY_BASE_URL points to staging.
 *
 * All exported functions return structured results and never throw — callers check `.ok` /
 * `.serviceable`. Field names are copied verbatim from the Delhivery spec (fidelity matters).
 */

const BASE_URL = (process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com').replace(/\/$/, '');
const TOKEN = process.env.DELIVERY_API_TOKEN || process.env.DELHIVERY_API_TOKEN || '';

export const delhiveryConfigured = () => !!TOKEN;
export const delhiveryBaseUrl = () => BASE_URL;

function authHeaders(extra = {}) {
  return { Authorization: `Token ${TOKEN}`, Accept: 'application/json', ...extra };
}

async function dhRequest(path, { method = 'GET', query, body, headers = {}, timeoutMs = 15_000 } = {}) {
  const url = new URL(BASE_URL + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, String(v));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers: authHeaders(headers), body, signal: ctrl.signal });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* 3 — Pincode Serviceability                                           */
/* GET /c/api/pin-codes/json/?filter_codes=<pin>                       */
/* ------------------------------------------------------------------ */
export async function checkServiceability(pincode) {
  const pin = String(pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return { serviceable: false, reason: 'invalid_pincode' };
  try {
    const { ok, status, data } = await dhRequest('/c/api/pin-codes/json/', { query: { filter_codes: pin } });
    if (!ok) return { serviceable: false, reason: `api_error_${status}` };
    const codes = data?.delivery_codes || [];
    if (!codes.length) return { serviceable: false, reason: 'non_serviceable', pincode: pin };
    const raw = codes[0]?.postal_code;
    const pc = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
    const remark = pc.remarks ?? pc.remark ?? '';
    return {
      serviceable: remark === '',
      embargo: remark === 'Embargo',
      reason: remark === '' ? 'serviceable' : (remark === 'Embargo' ? 'embargo' : remark || 'non_serviceable'),
      cod: pc.cod === 'Y' || pc.cod === true,
      prepaid: pc.pre_paid === 'Y' || pc.pre_paid === true,
      pincode: pin,
    };
  } catch {
    return { serviceable: false, reason: 'network_error', pincode: pin };
  }
}

/* ------------------------------------------------------------------ */
/* 4 — TAT (Expected Delivery)                                          */
/* GET /api/dc/expected_tat                                            */
/* ------------------------------------------------------------------ */
export async function expectedTat({ originPin, destinationPin, mot = 'S', pdt = 'B2C', pickupDate } = {}) {
  const o = String(originPin || '').replace(/\D/g, '');
  const d = String(destinationPin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(o) || !/^\d{6}$/.test(d)) return { ok: false, reason: 'invalid_pincode' };
  try {
    const query = { origin_pin: o, destination_pin: d, mot, pdt };
    if (pickupDate) query.expected_pickup_date = pickupDate;
    const { ok, status, data } = await dhRequest('/api/dc/expected_tat', { query });
    if (ok && data?.success) {
      return { ok: true, tat: data.data?.tat ?? null, expectedDeliveryDate: data.data?.expected_delivery_date ?? null };
    }
    return { ok: false, reason: data?.msg || data?.detail || `api_error_${status}` };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 2 — Fetch Waybill (pre-assign a waybill number to an order)         */
/* GET /waybill/api/fetch/json/?count=1                                */
/* ------------------------------------------------------------------ */
export async function fetchWaybill(count = 1) {
  try {
    const { ok, status, data } = await dhRequest('/waybill/api/fetch/json/', { query: { count } });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    const waybills = Array.isArray(data?.waybill_response) ? data.waybill_response
      : Array.isArray(data) ? data : [data].filter(Boolean);
    return { ok: true, waybills };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 5 — Warehouse                                                        */
/* POST /api/backend/clientwarehouse/create/                           */
/* POST /api/backend/clientwarehouse/edit/                             */
/* GET  /api/backend/clientwarehouse/get/                              */
/* ------------------------------------------------------------------ */
export async function createWarehouseOnDelhivery(w) {
  try {
    const payload = {
      name: w.name,
      email: w.email || '',
      registered_name: w.registeredName || w.name,
      return_pincode: w.returnPincode || w.pincode,
      pickup_location: w.pickupLocation,
      address_line_1: w.addressLine1 || '',
      address_line_2: w.addressLine2 || '',
      city: w.city || '',
      country: 'India',
      pin_code: w.pincode,
      phone: w.phone || '',
      state: w.state || '',
    };
    const { ok, status, data } = await dhRequest('/api/backend/clientwarehouse/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

export async function updateWarehouseOnDelhivery(w) {
  try {
    const payload = {
      name: w.name,
      email: w.email || '',
      registered_name: w.registeredName || w.name,
      return_pincode: w.returnPincode || w.pincode,
      pickup_location: w.pickupLocation,
      address_line_1: w.addressLine1 || '',
      address_line_2: w.addressLine2 || '',
      city: w.city || '',
      country: 'India',
      pin_code: w.pincode,
      phone: w.phone || '',
      state: w.state || '',
    };
    const { ok, status, data } = await dhRequest('/api/backend/clientwarehouse/edit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 6 — Shipping Cost                                                    */
/* GET /api/kinko/v1/invoice/charges/.json                             */
/* ------------------------------------------------------------------ */
export async function getShippingCost({ originPin, destPin, weight = 0.5, cod = 0, mode = 'S' } = {}) {
  const o = String(originPin || '').replace(/\D/g, '');
  const d = String(destPin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(o) || !/^\d{6}$/.test(d)) return { ok: false, reason: 'invalid_pincode' };
  try {
    const { ok, status, data } = await dhRequest('/api/kinko/v1/invoice/charges/.json', {
      query: {
        md: mode,
        cgm: weight,
        o_pin: o,
        d_pin: d,
        ss: cod > 0 ? 'COD' : 'Delivered',
        c_flag: cod > 0 ? 'C' : 'P',
        cod,
      },
    });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 7 — Shipment Creation                                               */
/* POST /api/cmu/create.json  (form-encoded: format=json&data=<json>) */
/* ------------------------------------------------------------------ */
export async function createShipment(shipmentData, pickupLocation) {
  try {
    const payload = JSON.stringify({
      shipments: [shipmentData],
      pickup_location: { name: pickupLocation },
    });
    const body = `format=json&data=${encodeURIComponent(payload)}`;
    const { ok, status, data } = await dhRequest('/api/cmu/create.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    const pkg = data?.packages?.[0];
    if (!pkg) return { ok: false, reason: 'no_package_in_response', detail: data };
    if (pkg.status !== 'Success') return { ok: false, reason: pkg.remarks || pkg.status, detail: data };
    return { ok: true, waybill: pkg.waybill, sortCode: pkg.sort_code, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 7 — Shipment Update / Cancellation                                  */
/* POST /api/p/edit  (form-encoded: format=json&data=<json>)          */
/* Cancel = set cancellation:"true" in the shipment object            */
/* ------------------------------------------------------------------ */
export async function cancelShipment(waybill) {
  try {
    const payload = JSON.stringify({ shipments: [{ waybill, cancellation: 'true' }] });
    const body = `format=json&data=${encodeURIComponent(payload)}`;
    const { ok, status, data } = await dhRequest('/api/p/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 8 — Pickup Request (PUR)                                            */
/* POST /fm/request/new/                                               */
/* ------------------------------------------------------------------ */
export async function createPickupRequest({ pickupDate, pickupTime, pickupLocation, packageCount } = {}) {
  try {
    const { ok, status, data } = await dhRequest('/fm/request/new/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        pickup_location: pickupLocation,
        expected_package_count: packageCount || 1,
      }),
    });
    if (!ok) return { ok: false, reason: `api_error_${status}`, detail: data };
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 9 — Shipping Label URL                                              */
/* GET /api/p/packing_slip?wbns=<comma-sep waybills>                  */
/* Returns a PDF — we build the authenticated URL and proxy it.       */
/* ------------------------------------------------------------------ */
export function shippingLabelUrl(waybills) {
  const wbns = Array.isArray(waybills) ? waybills.join(',') : String(waybills);
  return {
    url: `${BASE_URL}/api/p/packing_slip?wbns=${encodeURIComponent(wbns)}`,
    headers: authHeaders(),
  };
}

/* ------------------------------------------------------------------ */
/* 10 — Track Shipment                                                 */
/* GET /api/v1/packages/json/?waybill=<wbn>                           */
/* ------------------------------------------------------------------ */
export async function trackShipment(waybill) {
  try {
    const { ok, status, data } = await dhRequest('/api/v1/packages/json/', { query: { waybill } });
    if (!ok) return { ok: false, reason: `api_error_${status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}
