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
 */
export const ADC_STORES = [
  { name: 'A Dough Cookie — Begur (Warehouse)', contact: '9381502998', address_line_1: '167/3, First floor, Chickbegur Village, Singasandra Post, Manipal County Rd', city: 'Bengaluru', state: 'Karnataka', pincode: 560114, latitude: 12.8845, longitude: 77.6270, pickupName: process.env.SHIPROCKET_PICKUP_BEGUR || null },
  { name: 'A Dough Cookie — Jayanagar', contact: '9381502998', address_line_1: 'Jain University, 1314, 24th Main Rd, Jayanagar 9th Block', city: 'Bengaluru', state: 'Karnataka', pincode: 560041, latitude: 12.9250, longitude: 77.5938, pickupName: process.env.SHIPROCKET_PICKUP_JAYANAGAR || null },
  { name: 'A Dough Cookie — S.G. Palya', contact: '9381502998', address_line_1: 'No 10, 1st Main Rd, Venkateshwara Layout, S.G. Palya', city: 'Bengaluru', state: 'Karnataka', pincode: 560029, latitude: 12.9345, longitude: 77.6070, pickupName: process.env.SHIPROCKET_PICKUP_SGPALYA || null },
  { name: 'A Dough Cookie — Electronic City', contact: '9381502998', address_line_1: 'F3 Alley, GF, 1st Cross, Neeladri Rd, Electronic City Phase I', city: 'Bengaluru', state: 'Karnataka', pincode: 560100, latitude: 12.8452, longitude: 77.6602, pickupName: process.env.SHIPROCKET_PICKUP_ECITY || null },
  { name: 'A Dough Cookie — Besant Nagar', contact: '9381502998', address_line_1: '63, 6th Avenue, Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: 600090, latitude: 13.0002, longitude: 80.2668, pickupName: process.env.SHIPROCKET_PICKUP_BESANT || null },
];

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
