/*
 * Geocoding, behind one interface.
 *
 * Three things the address form needs: suggest a place from what someone typed, turn a typed
 * address into a point, and turn a point back into an address. Everything above this file asks for
 * those three and does not care who answers.
 *
 * It lives on the server, not in the browser, for two reasons. A credential shipped to the client
 * either has to be domain/referer-restricted (useless for a server call, which carries no Referer)
 * or it's a secret sitting in view-source — neither works here. And the public Nominatim instance
 * forbids the autocomplete traffic a checkout generates and blocks by IP when it sees it. One
 * server-side caller is also one place to cache, throttle and swap providers.
 *
 * Ola Maps is the primary provider, authenticated via OAuth2 client_credentials (OLA_CLIENT_ID +
 * OLA_CLIENT_SECRET), not a static API key. Ola offers both, but the static key is secured by a
 * domain/IP allowlist — a browser-facing mechanism that a Railway server call can't satisfy, since
 * there's no Referer to match. client_credentials authenticates by possession of the secret instead,
 * which is the same shape every other server-side credential in this codebase already uses
 * (Razorpay's key_id:key_secret, Message Central's token exchange) and needs no allowlist at all.
 *
 * Nominatim is the fallback for whenever OLA_CLIENT_ID/SECRET aren't set, which is what keeps
 * staging and local development working without needing real credentials.
 */

const OLA_CLIENT_ID = (process.env.OLA_CLIENT_ID || '').trim();
const OLA_CLIENT_SECRET = (process.env.OLA_CLIENT_SECRET || '').trim();

const NOMINATIM = 'https://nominatim.openstreetmap.org';
/* Nominatim asks every caller to identify itself and will block anonymous traffic. This is the
 * courtesy the browser could never extend, because a browser cannot set User-Agent. */
const UA = 'ADoughCookie/1.0 (+https://www.adoughcookie.com; orders@adoughcookie.com)';

export const olaConfigured = () => !!(OLA_CLIENT_ID && OLA_CLIENT_SECRET);
export function geoProvider() { return olaConfigured() ? 'olamaps' : 'nominatim'; }

const digits = (s) => String(s ?? '').replace(/\D/g, '');

async function getJson(url: string, opts: any = {}, ms = 7000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
    if (!r.ok) return null;
    return await r.json() as any;
  } catch { return null; } finally { clearTimeout(timer); }
}

/* ------------------------------------------------------------------ */
/* Ola Maps                                                            */
/* ------------------------------------------------------------------ */

/* One token, reused until it's about to expire. A fresh client_credentials exchange on every
   geocode call would work, but there's no reason to pay for a network round trip we don't need. */
let olaToken = { value: null, exp: 0 };

function decodeJwtExp(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));
    return Number.isFinite(payload.exp) ? payload.exp : null;
  } catch { return null; }
}

async function getOlaToken() {
  const now = Math.floor(Date.now() / 1000);
  if (olaToken.value && olaToken.exp - 60 > now) return olaToken.value;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'openid',
    client_id: OLA_CLIENT_ID,
    client_secret: OLA_CLIENT_SECRET,
  });
  const r = await getJson('https://api.olamaps.io/auth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const token = r?.access_token;
  if (!token) return null;

  olaToken = { value: token, exp: decodeJwtExp(token) || now + 3300 };
  return token;
}

async function olaGet(url) {
  const token = await getOlaToken();
  if (!token) return null;
  return getJson(url, { headers: { Authorization: `Bearer ${token}` } });
}

const addressComponent = (components, type) => {
  const c = (components || []).find((c) => c.types?.includes(type));
  return c?.long_name || c?.short_name || null;
};

async function olaSuggest(q, near) {
  const p = new URLSearchParams({ input: q });
  if (near) p.set('location', `${near.lat},${near.lng}`);
  const r = await olaGet(`https://api.olamaps.io/places/v1/autocomplete?${p}`);
  const list = r?.predictions;
  if (!Array.isArray(list)) return null;
  return list.map((s) => ({
    label: s.structured_formatting?.main_text || s.description || '',
    detail: s.structured_formatting?.secondary_text || '',
    latitude: Number(s.geometry?.location?.lat),
    longitude: Number(s.geometry?.location?.lng),
    id: s.place_id || null,
  })).filter((s) => s.label && Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
}

async function olaReverse(lat, lng) {
  const r = await olaGet(`https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}`);
  const a = r?.results?.[0];
  if (!a) return null;
  const c = a.address_components;
  return {
    street: [addressComponent(c, 'sublocality'), addressComponent(c, 'neighborhood')].filter(Boolean).join(', '),
    area: addressComponent(c, 'sublocality') || addressComponent(c, 'neighborhood') || null,
    city: addressComponent(c, 'locality') || addressComponent(c, 'administrative_area_level_2') || null,
    state: addressComponent(c, 'administrative_area_level_1') || null,
    postcode: digits(addressComponent(c, 'postal_code')) || null,
    formatted: a.formatted_address || null,
  };
}

async function olaForward(address) {
  const r = await olaGet(`https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(address)}`);
  const c = r?.geocodingResults?.[0];
  const lat = Number(c?.geometry?.location?.lat), lng = Number(c?.geometry?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const comps = c.address_components;
  return {
    latitude: lat,
    longitude: lng,
    postcode: digits(addressComponent(comps, 'postal_code')) || null,
    city: addressComponent(comps, 'locality') || null,
    state: addressComponent(comps, 'administrative_area_level_1') || null,
  };
}

/* ------------------------------------------------------------------ */
/* Nominatim — the fallback, and what staging and local development use */
/* ------------------------------------------------------------------ */

async function osmSuggest(q, near) {
  const p = new URLSearchParams({ format: 'jsonv2', limit: '8', addressdetails: '1', countrycodes: 'in', q });
  if (near) p.set('viewbox', `${near.lng - 0.4},${near.lat + 0.4},${near.lng + 0.4},${near.lat - 0.4}`);
  const arr = await getJson(`${NOMINATIM}/search?${p}`, { headers: { 'User-Agent': UA } });
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr.map((r) => {
    const a = r.address ?? {};
    const street = r.name || a.road || a.pedestrian || a.residential || '';
    const locality = a.neighbourhood || a.suburb || a.quarter || a.village || a.town || '';
    return {
      label: [street, locality].filter(Boolean).join(', ') || (r.display_name || '').split(',').slice(0, 2).join(',').trim(),
      detail: [a.city || a.town, a.state, digits(a.postcode)].filter(Boolean).join(', '),
      latitude: parseFloat(r.lat), longitude: parseFloat(r.lon), id: null,
    };
  }).filter((r) => r.label && !seen.has(r.label) && seen.add(r.label) !== undefined);
}

async function osmReverse(lat, lng) {
  const j = await getJson(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=17&lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': UA } });
  const a = j?.address;
  if (!a) return null;
  return {
    street: [a.road || a.pedestrian || a.residential, a.neighbourhood || a.suburb || a.quarter].filter(Boolean).join(', '),
    area: a.neighbourhood || a.suburb || a.village || null,
    city: a.city || a.town || a.municipality || a.village || a.county || null,
    state: a.state || null,
    postcode: digits(a.postcode) || null,
    formatted: j.display_name || null,
  };
}

async function osmForward(address, pincode) {
  const p = new URLSearchParams({ format: 'jsonv2', limit: '1', addressdetails: '1', country: 'India' });
  if (pincode) p.set('postalcode', pincode);
  if (address) p.set('q', address);
  const arr = await getJson(`${NOMINATIM}/search?${p}`, { headers: { 'User-Agent': UA } });
  const hit = Array.isArray(arr) ? arr[0] : null;
  if (!hit?.lat) return null;
  const a = hit.address ?? {};
  return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon), postcode: digits(a.postcode) || pincode || null, city: a.city || a.town || null, state: a.state || null };
}

/* ------------------------------------------------------------------ */
/* The interface everything else uses                                  */
/* ------------------------------------------------------------------ */

export async function geoSuggest(query, near) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  if (olaConfigured()) {
    const r = await olaSuggest(q, near);
    if (r?.length) return r;
    // A provider that answers nothing is not a reason to answer nothing.
    console.log('[GEO] olamaps suggest empty → nominatim');
  }
  return osmSuggest(q, near);
}

export async function geoReverse(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  if (olaConfigured()) {
    const r = await olaReverse(lat, lng);
    if (r) return r;
    console.log('[GEO] olamaps reverse empty → nominatim');
  }
  return osmReverse(lat, lng);
}

export async function geoForward(address, pincode) {
  if (olaConfigured()) {
    const r = await olaForward([address, pincode].filter(Boolean).join(' '));
    if (r) return r;
    console.log('[GEO] olamaps forward empty → nominatim');
  }
  return osmForward(address, pincode);
}

/** Does this point sit in the pincode the customer typed? Answered from the point, which is the
 *  authority — the pincode is the thing being checked, never the thing being trusted. */
export async function pincodeAt(lat, lng) {
  const r = await geoReverse(lat, lng);
  return r?.postcode || null;
}
