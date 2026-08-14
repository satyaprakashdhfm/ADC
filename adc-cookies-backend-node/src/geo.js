/*
 * Geocoding, behind one interface.
 *
 * Three things the address form needs: suggest a place from what someone typed, turn a typed
 * address into a point, and turn a point back into an address. Everything above this file asks for
 * those three and does not care who answers.
 *
 * It lives on the server, not in the browser, for two reasons. The Mappls credential must not ship
 * to a client — a referer whitelist is not a secret — and the public Nominatim instance forbids the
 * autocomplete traffic a checkout generates and blocks by IP when it sees it. One server-side
 * caller is also one place to cache, throttle and swap providers.
 *
 * MAPPLS, AS OF NOW, ONLY DRAWS MAPS.
 *
 * Probed live against the credential on Railway (MAPPLE_INDIA). It is a valid Web Maps SDK static
 * key — sdk.mappls.com returns real SDK JavaScript for it — but only when the request carries a
 * whitelisted domain: without a Referer it answers "Required String parameter 'domain' is not
 * present". The REST APIs (Autosuggest, Geocode, Reverse Geocode) reject the same key outright with
 * invalid_token, because they are separate products that have to be enabled on the account.
 *
 * Two consequences shape this file. A domain-locked key can only be used from a browser on that
 * domain, so it can never serve a server-side call from Railway, and it will not work on Vercel
 * previews or localhost. And with the REST products disabled there is nothing here for Mappls to
 * answer yet regardless.
 *
 * So the Mappls path below is written to their post-August-2025 static-key scheme (access_token as
 * a query parameter, not the retired OAuth flow) and switches on the moment a REST-enabled key
 * exists in MAPPLS_REST_KEY. Until then every request falls through to Nominatim, which is what
 * keeps staging and local development working and is why the fallback is not a nicety.
 */

/* A key entitled to the REST products, whitelisted by IP so the server can use it. Deliberately
   NOT MAPPLE_INDIA: that one is the browser's map key, domain-locked, and asking it these
   questions returns invalid_token. Keeping them as separate variables is what stops someone
   "fixing" the outage by pasting the map key here and getting silent 401s under a fallback. */
const MAPPLS_REST_KEY = (process.env.MAPPLS_REST_KEY || '').trim();

const NOMINATIM = 'https://nominatim.openstreetmap.org';
/* Nominatim asks every caller to identify itself and will block anonymous traffic. This is the
 * courtesy the browser could never extend, because a browser cannot set User-Agent. */
const UA = 'ADoughCookie/1.0 (+https://www.adoughcookie.com; orders@adoughcookie.com)';

export const mapplsConfigured = () => !!MAPPLS_REST_KEY;
export function geoProvider() { return mapplsConfigured() ? 'mappls' : 'nominatim'; }

const digits = (s) => String(s ?? '').replace(/\D/g, '');

async function getJson(url, opts = {}, ms = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(timer); }
}

/* ------------------------------------------------------------------ */
/* Mappls                                                              */
/* ------------------------------------------------------------------ */

/* Post-August-2025 auth: the static key IS the token, passed as access_token. The old
   client_id/client_secret exchange against outpost.mappls.com is retired. */
const withKey = (u) => `${u}${u.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(MAPPLS_REST_KEY)}`;

async function mapplsSuggest(q, near) {
  const p = new URLSearchParams({ query: q, region: 'IND' });
  if (near) p.set('location', `${near.lat},${near.lng}`);
  const r = await getJson(withKey(`https://atlas.mappls.com/api/places/search/json?${p}`));
  const list = r?.suggestedLocations;
  if (!Array.isArray(list)) return null;
  return list.map((s) => ({
    label: s.placeName || s.placeAddress || '',
    detail: s.placeAddress || '',
    latitude: Number(s.latitude ?? s.lat),
    longitude: Number(s.longitude ?? s.lng ?? s.lon),
    id: s.eLoc || null,
  })).filter((s) => s.label && Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
}

async function mapplsReverse(lat, lng) {
  const r = await getJson(withKey(`https://apis.mappls.com/advancedmaps/v1/rev_geocode?lat=${lat}&lng=${lng}`));
  const a = r?.results?.[0];
  if (!a) return null;
  return {
    street: [a.street || a.subSubLocality, a.subLocality || a.locality].filter(Boolean).join(', '),
    area: a.locality || a.subLocality || a.village || null,
    city: a.city || a.district || null,
    state: a.state || null,
    postcode: digits(a.pincode) || null,
    formatted: a.formatted_address || null,
  };
}

async function mapplsForward(address) {
  const r = await getJson(withKey(`https://atlas.mappls.com/api/places/geocode?address=${encodeURIComponent(address)}&region=IND`));
  const c = r?.copResults;
  const lat = Number(c?.latitude), lng = Number(c?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng, postcode: digits(c.pincode) || null, city: c.city || null, state: c.state || null };
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
  if (mapplsConfigured()) {
    const r = await mapplsSuggest(q, near);
    if (r?.length) return r;
    // A provider that answers nothing is not a reason to answer nothing.
    console.log('[GEO] mappls suggest empty → nominatim');
  }
  return osmSuggest(q, near);
}

export async function geoReverse(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  if (mapplsConfigured()) {
    const r = await mapplsReverse(lat, lng);
    if (r) return r;
    console.log('[GEO] mappls reverse empty → nominatim');
  }
  return osmReverse(lat, lng);
}

export async function geoForward(address, pincode) {
  if (mapplsConfigured()) {
    const r = await mapplsForward([address, pincode].filter(Boolean).join(' '));
    if (r) return r;
    console.log('[GEO] mappls forward empty → nominatim');
  }
  return osmForward(address, pincode);
}

/** Does this point sit in the pincode the customer typed? Answered from the point, which is the
 *  authority — the pincode is the thing being checked, never the thing being trusted. */
export async function pincodeAt(lat, lng) {
  const r = await geoReverse(lat, lng);
  return r?.postcode || null;
}
