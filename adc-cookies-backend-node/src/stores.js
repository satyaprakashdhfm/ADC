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
 * This runs the moment an order is placed, BEFORE any courier is booked, because a store has to see
 * its order and start baking whether or not a rider was found. Booking may later move the order to a
 * different store — pickServiceableStore quotes each in turn and the nearest is not always the one
 * the carrier can serve — and that correction is written back over this answer.
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
