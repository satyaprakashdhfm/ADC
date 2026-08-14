/*
 * ADC's physical stores, and the routing helpers that decide which one an intracity order ships
 * from.
 *
 * This used to live in shadowfax.js, which made it look carrier-specific. It never was: the store
 * list and the proximity/zone maths are ours, and they now drive Shiprocket Hyperlocal. Shadowfax
 * has been deleted, and this data outlived it.
 *
 * Coordinates are REQUIRED — Shiprocket Hyperlocal returns no couriers for a pincode alone, so a
 * store without lat/long cannot be quoted or dispatched from.
 *
 * `pickupName` must match a pickup location registered in the Shiprocket panel. Orders are
 * collected from whatever that nickname resolves to on THEIR side, not from the address written
 * here — and only if that location is VERIFIED (status 2). An unverified one quotes perfectly and
 * then refuses the booking, which is why shiprocket.js checks verification before offering a store.
 *
 * Begur is the fulfilment warehouse: Delhivery collects from it and Petpooja bills against it.
 *
 * `code` is the URL slug of that store's staff portal (/store/<code>) and the value written to
 * orders.store_code. It is an identifier, not a label — renaming a store is free, changing a code
 * orphans every order already routed to it.
 *
 * `posMode` decides who puts the order into Petpooja:
 *   'AUTO'   — we relay it ourselves over the Save Order API. Only Begur: it is the single outlet
 *              Petpooja has configured for us, so a ticket for any other kitchen would be billed
 *              against the wrong store.
 *   'MANUAL' — the staff at that store key the order into their own Petpooja terminal and print the
 *              bill there. Our job is to show them everything they need to do that accurately.
 */
import { getOne } from './db.js';

export const ADC_STORES = [
  { code: 'begur', posMode: 'AUTO', name: 'A Dough Cookie — Begur (Warehouse)', contact: '9381502998', address_line_1: '167/3, First floor, Chickbegur Village, Singasandra Post, Manipal County Rd', city: 'Bengaluru', state: 'Karnataka', pincode: 560114, latitude: 12.8845, longitude: 77.6270, pickupName: process.env.SHIPROCKET_PICKUP_BEGUR || null },
  { code: 'jayanagar', posMode: 'MANUAL', name: 'A Dough Cookie — Jayanagar', contact: '9381502998', address_line_1: 'Jain University, 1314, 24th Main Rd, Jayanagar 9th Block', city: 'Bengaluru', state: 'Karnataka', pincode: 560041, latitude: 12.9250, longitude: 77.5938, pickupName: process.env.SHIPROCKET_PICKUP_JAYANAGAR || null },
  { code: 'sgpalya', posMode: 'MANUAL', name: 'A Dough Cookie — S.G. Palya', contact: '9381502998', address_line_1: 'No 10, 1st Main Rd, Venkateshwara Layout, S.G. Palya', city: 'Bengaluru', state: 'Karnataka', pincode: 560029, latitude: 12.9345, longitude: 77.6070, pickupName: process.env.SHIPROCKET_PICKUP_SGPALYA || null },
  { code: 'ecity', posMode: 'MANUAL', name: 'A Dough Cookie — Electronic City', contact: '9381502998', address_line_1: 'F3 Alley, GF, 1st Cross, Neeladri Rd, Electronic City Phase I', city: 'Bengaluru', state: 'Karnataka', pincode: 560100, latitude: 12.8452, longitude: 77.6602, pickupName: process.env.SHIPROCKET_PICKUP_ECITY || null },
  { code: 'besant', posMode: 'MANUAL', name: 'A Dough Cookie — Besant Nagar', contact: '9381502998', address_line_1: '63, 6th Avenue, Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: 600090, latitude: 13.0002, longitude: 80.2668, pickupName: process.env.SHIPROCKET_PICKUP_BESANT || null },
];

/**
 * The warehouse. Outstation orders ship from here (Delhivery collects here) and it is the only
 * outlet wired to Petpooja, so anything we cannot place at a shop-front belongs to it.
 */
export const WAREHOUSE_CODE = 'begur';

/** Look a store up by its portal code. Null for an unknown code — never guess a nearby one. */
export function storeByCode(code) {
  if (!code) return null;
  const want = String(code).trim().toLowerCase();
  return ADC_STORES.find((s) => s.code === want) || null;
}

/** True when WE push this store's orders to Petpooja; false when its staff key them in by hand. */
export function storeRelaysToPos(code) {
  return storeByCode(code)?.posMode === 'AUTO';
}

/**
 * Is this store currently taking orders? The one function here that touches the database
 * (store_status) — kept in this file rather than duplicated across orders.js/delivery.js/admin.js,
 * which all need the same answer before routing or quoting against a store. No row means active:
 * every store starts on, and this table only ever records an explicit admin flip.
 */
export async function isStoreActive(code) {
  const row = await getOne('SELECT is_active FROM store_status WHERE store_code = $1', [String(code || '').trim().toLowerCase()]);
  return row ? !!row.is_active : true;
}

/**
 * The stores in this pincode's zone that are actually switched on, nearest pincode first.
 *
 * Serviceability used to be decided from zoneStores()[0] alone — the single nearest store BY
 * PINCODE NUMBER — and refused same-day if that one store was off. With only Jayanagar trading,
 * that broke almost every Bengaluru pincode: 560011 sorts S.G. Palya (560029) closest by digits, so
 * an address 2.4 km from an open Jayanagar shop was told same-day was paused. Whether we can bake
 * an order is a question about the zone, not about whichever store happens to sort first.
 */
export async function activeZoneStores(destPincode) {
  const zone = zoneStores(destPincode);
  const flags = await Promise.all(zone.map((s) => isStoreActive(s.code)));
  return zone.filter((_, i) => flags[i]);
}

const parseCities = (raw) => String(raw || '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);

/**
 * Can this product go on a same-day, store-fulfilled order to this pincode?
 *
 * zoneStores already answers "which stores could serve this pincode" for the ordinary
 * courier-routing decision; this reuses it rather than re-deriving city eligibility a second way
 * that could drift from what booking actually does. `restrict_cities` narrows WHICH intracity
 * cities count (e.g. Red Velvet: Bengaluru, not Chennai) — empty means any intracity city is fine.
 */
export function intracityEligible(destPincode, product) {
  if (!product.intracity_available) return false;
  const stores = zoneStores(destPincode);
  if (!stores.length) return false;                // not an intracity pincode at all
  const allowed = parseCities(product.restrict_cities);
  if (!allowed.length) return true;
  return stores.some((s) => allowed.includes(s.city.toLowerCase()));
}

/** Can this product go on a multi-day Delhivery parcel at all, anywhere? No city concept — Delhivery
 *  is national, so this is a flat on/off (Red Velvet: permanently off, 24h shelf life). */
export function intercityEligible(product) {
  return !!product.intercity_available;
}

/**
 * Can this product reach this destination AT ALL, by whichever carrier actually applies there?
 *
 * NOT "intracity OR intercity" independently — an intracity-zone pincode never falls back to
 * Delhivery for a same-day product (the standing rule: a same-day promise is never silently
 * downgraded to multi-day), so a pincode inside a store zone is judged ONLY on intracity
 * eligibility. Everywhere else, only intercity applies. This is the one function order-creation,
 * the storefront catalog, and checkout should all call — never re-derive this a second way.
 */
export function deliveryEligible(destPincode, product) {
  return zoneStores(destPincode).length
    ? intracityEligible(destPincode, product)
    : intercityEligible(product);
}

/**
 * The intracity rule, asked from the OTHER direction: not "can this pincode be reached", but "can
 * THIS store sell it at all". Used by the store portal's own menu view — a city-restricted product
 * is not something Besant Nagar carries, whatever a customer's address happens to be.
 */
export function storeProductAvailable(storeCode, product) {
  if (!product.intracity_available) return false;
  const store = storeByCode(storeCode);
  if (!store) return false;
  const allowed = parseCities(product.restrict_cities);
  return !allowed.length || allowed.includes(store.city.toLowerCase());
}

/**
 * The same question, but honouring a manual admin override first (see store_product_overrides in
 * db.js) — an explicit "on" or "off" for this exact store/product always wins over the automatic
 * intracity_available/restrict_cities rule, since it's what lets an admin handle a one-off case (a
 * specific store out of an ingredient today) that a city-name rule can't express. `override` is
 * `true`/`false` when a row exists for this store+product, or `null`/`undefined` when it doesn't —
 * callers fetch that themselves (stores.js stays DB-free) and pass it straight through.
 */
export function resolveProductAvailability(storeCode, product, override) {
  if (override != null) return !!override;
  return storeProductAvailable(storeCode, product);
}

const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km between a store and a point. */
function distanceKm(store, lat, lng) {
  const dLat = rad(store.latitude - lat);
  const dLng = rad(store.longitude - lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(store.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

/**
 * Stores sorted nearest-first to a customer location, each annotated with `km`.
 *
 * Distance to the CUSTOMER is the right order to try pickups in — the rider's journey is what the
 * delivery costs. Nearest is not the same as serviceable though, so callers still quote each in
 * turn rather than assuming the first one works.
 */
export function orderStoresByProximity(stores, lat, lng) {
  if (lat == null || lng == null) return stores;
  return [...stores]
    .map((s) => ({ ...s, km: Math.round(distanceKm(s, lat, lng) * 100) / 100 }))
    .sort((a, b) => a.km - b.km);
}

/** The store or warehouse a parcel leaves from, matched by the origin pincode the quote used. */
export function storeByPincode(pin) {
  const p = String(pin || '').replace(/\D/g, '');
  return ADC_STORES.find((s) => String(s.pincode) === p) || null;
}

/**
 * Straight-line km from a store to a customer's coordinates, to one decimal.
 *
 * For an outstation parcel there is no carrier-supplied routing distance — Delhivery prices by
 * weight and zone and never reports one — so this is the only number available. It is as-the-crow-
 * flies and will read shorter than the road, which is why anything showing it says "about". The
 * intracity quote does NOT use this: Shiprocket returns its own real routing distance, and that is
 * the figure the fee is actually calculated from.
 */
export function straightLineKm(store, lat, lng) {
  if (!store || lat == null || lng == null) return null;
  return Math.round(distanceKm(store, lat, lng) * 10) / 10;
}

/**
 * Nearest store to an actual customer location. Optionally constrained to one city — falling back
 * to the full list rather than returning nothing when that city has no store.
 */
export function nearestStoreToCoords(lat, lng, city) {
  if (lat == null || lng == null) return null;
  const inCity = city ? ADC_STORES.filter((s) => s.city.toLowerCase() === String(city).toLowerCase()) : ADC_STORES;
  const pool = inCity.length ? inCity : ADC_STORES;
  let best = null;
  for (const s of pool) {
    const km = distanceKm(s, lat, lng);
    if (!best || km < best.km) best = { ...s, km: Math.round(km * 100) / 100 };
  }
  return best;
}

/**
 * Every store in the destination's city zone (matched on the pincode's first 3 digits), nearest
 * pincode first. A non-empty result is what makes an order "intracity" and therefore same-day.
 */
export function zoneStores(destPincode) {
  const pin = Number(String(destPincode).replace(/\D/g, ''));
  if (!pin) return [];
  const zone = String(pin).slice(0, 3);
  return ADC_STORES
    .filter((s) => String(s.pincode).slice(0, 3) === zone)
    .sort((a, b) => Math.abs(a.pincode - pin) - Math.abs(b.pincode - pin));
}

/** Nearest single store by pincode zone — used for the checkout estimate. Null if none in zone. */
export function nearestStore(destPincode) {
  return zoneStores(destPincode)[0] || null;
}

/**
 * Which kitchen owns an order, decided from the delivery address alone.
 *
 * This runs the moment an order is placed, BEFORE any courier is booked — a store has to see its
 * order and start baking whether or not a rider can be found — and the answer is FINAL. Booking
 * (attemptShipment, in routes/orders.js) only ever tries this exact store; it never reassigns the
 * order to a different one, even if that other store would have been Shiprocket-serviceable. Once a
 * kitchen is holding an order (or has accepted it), the rider has to collect from there — moving the
 * pickup point after the fact means sending them to a kitchen with nothing to hand over.
 *
 * Anything outside a store zone is the warehouse's: outstation parcels leave from Begur.
 */
export function storeForAddress(address) {
  if (!address) return storeByCode(WAREHOUSE_CODE);
  const inZone = zoneStores(String(address.pincode || '').replace(/\D/g, ''));
  if (!inZone.length) return storeByCode(WAREHOUSE_CODE);
  const nearest = nearestStoreToCoords(address.latitude, address.longitude, address.city);
  // Coordinates are optional here on purpose. Without them we cannot measure distance, but the
  // pincode zone already narrowed it to one city, so the first zone store is a sound default —
  // better than leaving the order unassigned and invisible to every kitchen.
  return nearest || inZone[0];
}
