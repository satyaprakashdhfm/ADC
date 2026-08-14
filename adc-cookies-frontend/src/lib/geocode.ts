'use client';

/**
 * Turning a typed address into coordinates we are willing to send a rider to.
 *
 * This exists because of a real order. An address typed as "9th Main Rd, 2nd Block, Jaya Nagar
 * East, Bengaluru, 560011" was stored at 12.9126, 77.7231 — Varthur, twelve kilometres east. The
 * street-level geocode had quietly failed, and the save fell back to the coordinates GPS had
 * captured earlier, from wherever the person happened to be standing when they first opened the
 * form. Checkout then dispatched from Electronic City and quoted its distance, and every screen
 * involved showed the correct Jayanagar address the whole way through.
 *
 * The carrier delivers to the coordinates, not to the text. So a wrong point is not a cosmetic
 * problem — it is a rider at the wrong house, with nothing anywhere saying so.
 *
 * The rule here is therefore: a point is only used if it AGREES with the pincode that was typed,
 * and if nothing agrees we return no point at all. No coordinates means no same-day quote, which is
 * a visible, recoverable failure. Confidently wrong coordinates are neither.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const TIMEOUT_MS = 7000;

export type PointSource = 'street' | 'postcode' | 'gps' | 'pin';

export interface ResolvedPoint {
  latitude: number;
  longitude: number;
  /** How precise this is, best first: a dropped pin and a street match are house-level; a postcode
   *  is the middle of the PIN area, good to a kilometre or two — enough to route from the right
   *  store, not enough to knock on a door. */
  source: PointSource;
  /** The postcode the point itself resolves to. Kept so the caller can say why it was rejected. */
  postcode: string | null;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** What postcode does this point actually sit in? */
export async function reverseGeocode(lat: number, lng: number): Promise<{ postcode: string | null; city: string | null; state: string | null }> {
  const j = await getJson(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`) as
    { address?: Record<string, string> } | null;
  const a = j?.address ?? {};
  return {
    postcode: digits(a.postcode) || null,
    city: a.city || a.town || a.municipality || a.village || a.county || null,
    state: a.state || null,
  };
}

interface AddressLike {
  addressLine1?: string; addressLine2?: string;
  city?: string; state?: string; pincode?: string;
}

/**
 * Two geocode attempts, deliberately in this order.
 *
 * The street query is the one worth having and the one that usually fails: Indian addresses are
 * full of blocks, cross roads and main roads that OSM does not carry, so "9th Main Rd, 2nd Block"
 * finds nothing far more often than it finds the right thing. The postcode query almost always
 * succeeds, because a PIN area is a shape OSM does know.
 *
 * Falling back from one to the other is fine. Falling back from either to "wherever the phone was"
 * is not, which is the fallback this replaces.
 */
async function geocodeTyped(a: AddressLike): Promise<ResolvedPoint | null> {
  const pin = digits(a.pincode);
  const street = [a.addressLine1, a.addressLine2].filter(Boolean).join(', ').trim();
  const base = { format: 'jsonv2', limit: '1', addressdetails: '1', country: 'India' };

  if (street && (pin || a.city)) {
    const p = new URLSearchParams({ ...base, street });
    if (pin) p.set('postalcode', pin);
    if (a.city?.trim()) p.set('city', a.city.trim());
    if (a.state?.trim()) p.set('state', a.state.trim());
    const arr = await getJson(`${NOMINATIM}/search?${p}`) as Array<{ lat: string; lon: string; address?: Record<string, string> }> | null;
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (hit?.lat && hit?.lon) {
      return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon), source: 'street', postcode: digits(hit.address?.postcode) || null };
    }
  }

  if (pin) {
    const p = new URLSearchParams({ ...base, postalcode: pin });
    const arr = await getJson(`${NOMINATIM}/search?${p}`) as Array<{ lat: string; lon: string; address?: Record<string, string> }> | null;
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (hit?.lat && hit?.lon) {
      return { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon), source: 'postcode', postcode: digits(hit.address?.postcode) || pin };
    }
  }

  return null;
}

export interface PlaceSuggestion {
  label: string;
  /** Street + locality on its own, ready to drop straight into the Area field. */
  street: string;
  postcode: string | null;
  latitude: number;
  longitude: number;
}

/**
 * Landmark search, scoped to the pincode the customer already typed.
 *
 * Typing a full Indian address into a geocoder rarely works — but typing a landmark usually does,
 * because apartment complexes, tech parks, temples and hospitals are exactly what OSM has good
 * coverage of. Scoping to the PIN area does the rest: "green fields" alone matches half the
 * country, "green fields" inside 560011 does not.
 */
export async function searchNearby(query: string, within: { pincode?: string; city?: string }): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const p = new URLSearchParams({ format: 'jsonv2', limit: '8', addressdetails: '1', countrycodes: 'in' });
  const area = [within.pincode, within.city].filter(Boolean).join(' ');
  p.set('q', area ? `${q}, ${area}` : q);
  const arr = await getJson(`${NOMINATIM}/search?${p}`) as Array<{
    lat: string; lon: string; display_name?: string; name?: string; address?: Record<string, string>;
  }> | null;
  if (!Array.isArray(arr)) return [];

  const seen = new Set<string>();
  return arr
    .filter(r => r.lat && r.lon)
    .map(r => {
      const a = r.address ?? {};
      /* Build the label out of the street and the locality rather than slicing the display_name.
         Nominatim's chain runs house → road → suburb → city → district → state → postcode, and the
         first three parts of it are often "Shop 4, , Bengaluru" — the useful pair is always the
         road and whatever locality contains it. */
      const street = r.name || a.road || a.pedestrian || a.residential || '';
      const locality = a.neighbourhood || a.suburb || a.quarter || a.village || a.town || '';
      const label = [street, locality].filter(Boolean).join(', ')
        || (r.display_name || '').split(',').slice(0, 2).join(',').trim();
      return {
        label,
        street: [street, locality].filter(Boolean).join(', '),
        postcode: digits(a.postcode) || null,
        latitude: parseFloat(r.lat),
        longitude: parseFloat(r.lon),
      };
    })
    .filter(r => {
      if (!r.label || seen.has(r.label)) return false;   // the same road comes back once per segment
      seen.add(r.label);
      return true;
    });
}

/** The street a point sits on — so dragging the pin can fill the address in, not just consume it. */
export async function streetAt(lat: number, lng: number): Promise<{ street: string; postcode: string | null; city: string | null }> {
  const j = await getJson(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=17&lat=${lat}&lon=${lng}`) as
    { address?: Record<string, string> } | null;
  const a = j?.address ?? {};
  const street = [a.road || a.pedestrian || a.residential, a.neighbourhood || a.suburb || a.quarter]
    .filter(Boolean).join(', ');
  return { street, postcode: digits(a.postcode) || null, city: a.city || a.town || a.village || null };
}

/** Straight-line kilometres — used to sanity-check a point against the PIN area it claims to be in. */
export function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** How far a point may sit from its PIN centroid before we stop believing it belongs there. Indian
 *  PIN areas are big and irregular, especially at city edges, so this is generous on purpose —
 *  it is here to catch a point in the wrong part of the city, not to police a few streets. */
export const PIN_RADIUS_KM = 12;

export interface ResolveResult {
  point: ResolvedPoint | null;
  /** Set when we had a candidate and threw it away — shown to the user so the failure is visible. */
  rejected?: { source: PointSource; reason: string };
}

/**
 * The one entry point: given the typed address and whatever GPS gave us, produce a point we are
 * willing to route on — or nothing.
 *
 * A pin the user placed themselves outranks everything; they are looking at a map of their own
 * street. After that the typed address, then GPS — and GPS only when it lands in the same PIN area
 * the address claims, which is exactly the check that was missing.
 */
export async function resolveAddressPoint(
  a: AddressLike,
  gps?: { latitude: number | null; longitude: number | null; source?: PointSource } | null,
): Promise<ResolveResult> {
  // Already placed by hand on the map — nothing here can improve on that.
  if (gps?.source === 'pin' && gps.latitude != null && gps.longitude != null) {
    return { point: { latitude: gps.latitude, longitude: gps.longitude, source: 'pin', postcode: digits(a.pincode) || null } };
  }

  const pin = digits(a.pincode);
  const typed = await geocodeTyped(a);

  // A street match that lands in a different PIN area than the one typed is not this address.
  if (typed?.source === 'street' && pin && typed.postcode && typed.postcode !== pin) {
    const areaOnly = await geocodeTyped({ pincode: pin });
    return {
      point: areaOnly,
      rejected: { source: 'street', reason: `the street matched in ${typed.postcode}, not ${pin}` },
    };
  }
  if (typed?.source === 'street') return { point: typed };

  /* GPS is the most precise thing available — it is a real position, not an area — but only if it
     is a real position in THIS address's PIN area. Checked against the PIN centroid rather than by
     reverse-geocoding, so one lookup answers it and a rate-limited geocoder cannot turn a good
     address into a rejected one. */
  if (gps?.latitude != null && gps.longitude != null) {
    if (!typed) return { point: { latitude: gps.latitude, longitude: gps.longitude, source: 'gps', postcode: null } };
    const away = kmBetween(gps.latitude, gps.longitude, typed.latitude, typed.longitude);
    if (away <= PIN_RADIUS_KM) {
      return { point: { latitude: gps.latitude, longitude: gps.longitude, source: 'gps', postcode: pin || null } };
    }
    return {
      point: typed,
      rejected: { source: 'gps', reason: `your detected location is ${Math.round(away)} km from PIN ${pin}` },
    };
  }

  return { point: typed };
}
