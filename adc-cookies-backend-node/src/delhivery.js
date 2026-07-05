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

// Log which config is active at startup so Railway logs show it immediately.
console.log(`[DELHIVERY] config | base=${BASE_URL} | token=${TOKEN ? TOKEN.slice(0, 6) + '…' : 'MISSING'}`);

function log(label, extra = '') {
  console.log(`[DELHIVERY] ${label}${extra ? ' | ' + extra : ''}`);
}

function authHeaders(extra = {}) {
  return { Authorization: `Token ${TOKEN}`, Accept: 'application/json', ...extra };
}

async function dhRequest(path, { method = 'GET', query, body, headers = {}, timeoutMs = 15_000 } = {}) {
  const url = new URL(BASE_URL + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, String(v));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method, headers: authHeaders(headers), body, signal: ctrl.signal });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const ms = Date.now() - t0;
    if (!res.ok) {
      log(`${method} ${path} ERROR`, `status=${res.status} | body=${text.slice(0, 200)} | ${ms}ms`);
    } else {
      log(`${method} ${path}`, `status=${res.status} | ${ms}ms`);
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    log(`${method} ${path} TIMEOUT/NET`, `err=${err.message} | ${Date.now() - t0}ms`);
    throw err;
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
  if (!/^\d{6}$/.test(pin)) {
    log('serviceability | SKIP', `pin=${pin} | ✗ invalid_pincode`);
    return { serviceable: false, reason: 'invalid_pincode' };
  }
  try {
    const { ok, status, data } = await dhRequest('/c/api/pin-codes/json/', { query: { filter_codes: pin } });
    if (!ok) {
      log('serviceability', `pin=${pin} | ✗ api_error_${status}`);
      return { serviceable: false, reason: `api_error_${status}` };
    }
    const codes = data?.delivery_codes || [];
    if (!codes.length) {
      log('serviceability', `pin=${pin} | ✗ non_serviceable (no codes returned)`);
      return { serviceable: false, reason: 'non_serviceable', pincode: pin };
    }
    const raw = codes[0]?.postal_code;
    const pc = Array.isArray(raw) ? (raw[0] || {}) : (raw || {});
    const remark = pc.remarks ?? pc.remark ?? '';
    const result = {
      serviceable: remark === '',
      embargo: remark === 'Embargo',
      reason: remark === '' ? 'serviceable' : (remark === 'Embargo' ? 'embargo' : remark || 'non_serviceable'),
      cod: pc.cod === 'Y' || pc.cod === true,
      prepaid: pc.pre_paid === 'Y' || pc.pre_paid === true,
      pincode: pin,
    };
    log('serviceability', `pin=${pin} | ${result.serviceable ? '✓ serviceable' : `✗ ${result.reason}`} | cod=${result.cod}`);
    return result;
  } catch (err) {
    log('serviceability', `pin=${pin} | ✗ network_error: ${err.message}`);
    return { serviceable: false, reason: 'network_error', pincode: pin };
  }
}

/* ------------------------------------------------------------------ */
/* 4 — TAT (Expected Delivery)                                          */
/* GET /api/dc/expected_tat                                            */
/* ------------------------------------------------------------------ */
export async function expectedTat({ originPin, destinationPin, mot = 'E', pdt = 'B2C', pickupDate } = {}) {
  const o = String(originPin || '').replace(/\D/g, '');
  const d = String(destinationPin || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(o) || !/^\d{6}$/.test(d)) {
    log('TAT | SKIP', `${o}→${d} | ✗ invalid_pincode`);
    return { ok: false, reason: 'invalid_pincode' };
  }
  try {
    const query = { origin_pin: o, destination_pin: d, mot, pdt };
    if (pickupDate) query.expected_pickup_date = pickupDate;
    const { ok, status, data } = await dhRequest('/api/dc/expected_tat', { query });
    if (ok && data?.success) {
      const tat = data.data?.tat ?? null;
      const edd = data.data?.expected_delivery_date ?? null;
      log('TAT', `${o}→${d} | ✓ tat=${tat} days | edd=${edd}`);
      return { ok: true, tat, expectedDeliveryDate: edd };
    }
    const reason = data?.msg || data?.detail || `api_error_${status}`;
    log('TAT', `${o}→${d} | ✗ ${reason}`);
    return { ok: false, reason };
  } catch (err) {
    log('TAT', `${o}→${d} | ✗ network_error: ${err.message}`);
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
    if (!ok) {
      log('waybill-fetch', `count=${count} | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    const waybills = Array.isArray(data?.waybill_response) ? data.waybill_response
      : Array.isArray(data) ? data : [data].filter(Boolean);
    log('waybill-fetch', `count=${count} | ✓ waybills=[${waybills.slice(0, 3).join(', ')}]`);
    return { ok: true, waybills };
  } catch (err) {
    log('waybill-fetch', `count=${count} | ✗ network_error: ${err.message}`);
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
    // Delhivery identifies a warehouse by `name`, and shipment creation references that same
    // `name` via pickup_location. We register under the pickup_location key so the two always
    // match — otherwise shipments fail with "ClientWarehouse matching query does not exist."
    // Field names are exactly what the API requires: address/pin/return_address/return_pin
    // (NOT address_line_1/pin_code/return_pincode — those are silently rejected).
    const address = [w.addressLine1, w.addressLine2].filter(Boolean).join(', ');
    const payload = {
      name: w.pickupLocation || w.name,
      registered_name: w.registeredName || w.name,
      email: w.email || '',
      phone: w.phone || '',
      address,
      city: w.city || '',
      country: 'India',
      pin: w.pincode,
      return_address: address,
      return_pin: w.returnPincode || w.pincode,
      return_city: w.city || '',
      return_state: w.state || '',
      return_country: 'India',
    };
    const { ok, status, data } = await dhRequest('/api/backend/clientwarehouse/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!ok) {
      log('warehouse-create', `"${w.name}" pin=${w.pincode} | ✗ api_error_${status} | ${JSON.stringify(data).slice(0, 120)}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    log('warehouse-create', `"${w.name}" pin=${w.pincode} | ✓`);
    return { ok: true, data };
  } catch (err) {
    log('warehouse-create', `"${w.name}" | ✗ network_error: ${err.message}`);
    return { ok: false, reason: 'network_error' };
  }
}

export async function updateWarehouseOnDelhivery(w) {
  try {
    // `name` is the immutable identifier Delhivery looks the warehouse up by; the rest are edits.
    const address = [w.addressLine1, w.addressLine2].filter(Boolean).join(', ');
    const payload = {
      name: w.pickupLocation || w.name,
      registered_name: w.registeredName || w.name,
      email: w.email || '',
      phone: w.phone || '',
      address,
      city: w.city || '',
      country: 'India',
      pin: w.pincode,
      return_address: address,
      return_pin: w.returnPincode || w.pincode,
      return_city: w.city || '',
      return_state: w.state || '',
      return_country: 'India',
    };
    const { ok, status, data } = await dhRequest('/api/backend/clientwarehouse/edit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!ok) {
      log('warehouse-update', `"${w.name}" pin=${w.pincode} | ✗ api_error_${status} | ${JSON.stringify(data).slice(0, 120)}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    log('warehouse-update', `"${w.name}" pin=${w.pincode} | ✓`);
    return { ok: true, data };
  } catch (err) {
    log('warehouse-update', `"${w.name}" | ✗ network_error: ${err.message}`);
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
  if (!/^\d{6}$/.test(o) || !/^\d{6}$/.test(d)) {
    log('shipping-cost | SKIP', `${o}→${d} | ✗ invalid_pincode`);
    return { ok: false, reason: 'invalid_pincode' };
  }
  try {
    const { ok, status, data } = await dhRequest('/api/kinko/v1/invoice/charges/.json', {
      query: { md: mode, cgm: weight, o_pin: o, d_pin: d, ss: cod > 0 ? 'COD' : 'Delivered', c_flag: cod > 0 ? 'C' : 'P', cod },
    });
    if (!ok) {
      log('shipping-cost', `${o}→${d} ${weight}kg | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    const row = Array.isArray(data) ? data[0] : data?.[0];
    log('shipping-cost', `${o}→${d} ${weight}kg | ✓ total=₹${row?.total_amount ?? '?'} zone=${row?.zone ?? '?'} charged=${row?.charged_weight ?? '?'}kg`);
    return { ok: true, data };
  } catch (err) {
    log('shipping-cost', `${o}→${d} ${weight}kg | ✗ network_error: ${err.message}`);
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 7 — Shipment Creation                                               */
/* POST /api/cmu/create.json  (form-encoded: format=json&data=<json>) */
/* ------------------------------------------------------------------ */
export async function createShipment(shipmentData, pickupLocation) {
  const wbn = shipmentData?.waybill || '?';
  const ref = shipmentData?.client_name || shipmentData?.order || '?';
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
    if (!ok) {
      log('shipment-create', `waybill=${wbn} ref=${ref} | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    // Delhivery returns HTTP 200 even on a rejected shipment — the real reason is in `rmk`
    // (e.g. "ClientWarehouse matching query does not exist." = pickup location not registered).
    if (data && (data.error === true || data.success === false) && !data?.packages?.length) {
      const reason = data.rmk || data.remarks || 'shipment_rejected';
      log('shipment-create', `waybill=${wbn} ref=${ref} | ✗ ${reason}`);
      return { ok: false, reason, detail: data };
    }
    const pkg = data?.packages?.[0];
    if (!pkg) {
      log('shipment-create', `waybill=${wbn} ref=${ref} | ✗ no_package_in_response`);
      return { ok: false, reason: data?.rmk || 'no_package_in_response', detail: data };
    }
    if (pkg.status !== 'Success') {
      log('shipment-create', `waybill=${wbn} ref=${ref} | ✗ ${pkg.remarks || pkg.status}`);
      return { ok: false, reason: pkg.remarks || pkg.status, detail: data };
    }
    log('shipment-create', `waybill=${pkg.waybill} ref=${ref} | ✓ sort=${pkg.sort_code}`);
    return { ok: true, waybill: pkg.waybill, sortCode: pkg.sort_code, data };
  } catch (err) {
    log('shipment-create', `waybill=${wbn} ref=${ref} | ✗ network_error: ${err.message}`);
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
    if (!ok) {
      log('shipment-cancel', `waybill=${waybill} | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    log('shipment-cancel', `waybill=${waybill} | ✓`);
    return { ok: true, data };
  } catch (err) {
    log('shipment-cancel', `waybill=${waybill} | ✗ network_error: ${err.message}`);
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
    if (!ok) {
      log('pickup-request', `${pickupDate} ${pickupTime} count=${packageCount || 1} | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    log('pickup-request', `${pickupDate} ${pickupTime} count=${packageCount || 1} | ✓`);
    return { ok: true, data };
  } catch (err) {
    log('pickup-request', `${pickupDate} ${pickupTime} | ✗ network_error: ${err.message}`);
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
    // pdf=true → Delhivery returns JSON with a pre-signed PDF link (the label carries your
    // uploaded logo). Some accounts return the PDF bytes directly — the route handles both.
    url: `${BASE_URL}/api/p/packing_slip?wbns=${encodeURIComponent(wbns)}&pdf=true`,
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
    if (!ok) {
      log('track', `waybill=${waybill} | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}` };
    }
    const pkg = data?.ShipmentData?.[0]?.Shipment;
    const status_str = pkg?.Status || pkg?.status || '?';
    log('track', `waybill=${waybill} | ✓ status=${status_str}`);
    return { ok: true, data };
  } catch (err) {
    log('track', `waybill=${waybill} | ✗ network_error: ${err.message}`);
    return { ok: false, reason: 'network_error' };
  }
}

/* ------------------------------------------------------------------ */
/* 11 — Download Document (B2C)                                         */
/* GET /api/rest/fetch/pkg/document/?doc_type=<type>&waybill=<wbn>      */
/* For documents NOT archived in Delhivery — proof of delivery, the    */
/* recipient's signature, return QC / seller-return images.            */
/* ------------------------------------------------------------------ */
export const DELHIVERY_DOC_TYPES = ['SIGNATURE_URL', 'RVP_QC_IMAGE', 'EPOD', 'SELLER_RETURN_IMAGE'];

export async function fetchDocument({ docType, waybill } = {}) {
  const type = String(docType || '').toUpperCase();
  const wbn = String(waybill || '').replace(/\s/g, '');
  if (!DELHIVERY_DOC_TYPES.includes(type)) return { ok: false, reason: 'invalid_doc_type' };
  if (!wbn) return { ok: false, reason: 'missing_waybill' };
  try {
    const { ok, status, data } = await dhRequest('/api/rest/fetch/pkg/document/', { query: { doc_type: type, waybill: wbn } });
    if (!ok) {
      log('document', `waybill=${wbn} | type=${type} | ✗ api_error_${status}`);
      return { ok: false, reason: `api_error_${status}`, detail: data };
    }
    log('document', `waybill=${wbn} | type=${type} | ✓`);
    return { ok: true, data };
  } catch (err) {
    log('document', `waybill=${wbn} | type=${type} | ✗ network_error: ${err.message}`);
    return { ok: false, reason: 'network_error' };
  }
}
