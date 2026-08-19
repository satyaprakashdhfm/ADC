import { SITE_PHONE, SITE_EMAIL } from './site';

export interface Store {
  city: string;
  name: string;
  address: string;
  pincode: number;
  phone: string;
  email: string;
  map: string;
  lat: number;
  lng: number;
  image?: string; // storefront photo shown on the /locations store card
}

/** ADC store locations — shared by the homepage About/Stores, /locations store finder and Contact. */
export const STORES: Store[] = [
  {
    city: 'Bengaluru',
    name: 'A Dough Cookie, Jayanagar',
    address: 'Jain University, 1314, 24th Main Rd, opposite Gate 1, Kottapalya, Jayanagar 9th Block, Jayanagar, Bengaluru, Karnataka 560041',
    pincode: 560041,
    phone: SITE_PHONE,
    email: SITE_EMAIL,
    map: 'https://www.google.com/maps/search/?api=1&query=ADC+A+Dough+Cookie+Jayanagar+9th+Block+Bengaluru+560041',
    lat: 12.9166,
    lng: 77.5906,
    image: '/assets/stores/jayanagar.jpeg',
  },
  {
    city: 'Bengaluru',
    name: 'A Dough Cookie, S.G. Palya',
    address: 'No 10, 1st Main Rd, Venkateshwara Layout, S.G. Palya, Bengaluru, Karnataka 560029',
    pincode: 560029,
    phone: SITE_PHONE,
    email: SITE_EMAIL,
    map: 'https://www.google.com/maps/search/?api=1&query=ADC+A+Dough+Cookie+SG+Palya+Bengaluru+560029',
    lat: 12.9357,
    lng: 77.6068,
    image: '/assets/stores/sg-palya.jpeg',
  },
  {
    city: 'Bengaluru',
    name: 'A Dough Cookie, Electronic City',
    address: 'F3 Alley, GF, 1st Cross, Neeladri Rd, Electronic City Phase I, Bengaluru, Karnataka 560100',
    pincode: 560100,
    phone: SITE_PHONE,
    email: SITE_EMAIL,
    map: 'https://www.google.com/maps/search/?api=1&query=ADC+A+Dough+Cookie+Electronic+City+Phase+1+Bengaluru+560100',
    lat: 12.8452,
    lng: 77.6602,
    image: '/assets/stores/electronic-city.jpeg',
  },
  {
    city: 'Chennai',
    name: 'A Dough Cookie, Besant Nagar',
    address: '63, 6th Avenue, Besant Nagar, Chennai, Tamil Nadu 600090',
    pincode: 600090,
    phone: SITE_PHONE,
    email: SITE_EMAIL,
    map: 'https://www.google.com/maps/search/?api=1&query=ADC+A+Dough+Cookie+Besant+Nagar+Chennai+600090',
    lat: 13.0002,
    lng: 80.2668,
    image: '/assets/stores/besant-nagar.jpeg',
  },
];

/**
 * Mirrors the backend's storeProductAvailable (stores.js) — a city-restricted product only belongs
 * on the menu for a shopper whose resolved store sits in one of its allowed cities. Tier 1 of two:
 * a lightweight pre-filter using whatever coarse location signal we have, so an ineligible shopper
 * doesn't add it to cart only to hit a rejection later. Tier 2 (checkDeliveryPin's
 * sameDayRestrictions, checked once a real address exists) is precise — a real pincode-zone match,
 * not "nearest of ours by straight-line distance" — and has the final word; this is a hint, not the
 * guarantee. The backend's order-creation guard is the actual guarantee, independent of both.
 *
 * `store === null` means no location signal exists yet (no geolocation, no address, no manual
 * pincode) — the menu shows normally until we actually know where the shopper is; restricting
 * before that would be guessing.
 */
export function productAvailableFor(store: { city: string } | null, product: { intracityAvailable: boolean; restrictCities: string | null }): boolean {
  if (!store) return true;
  if (!product.intracityAvailable) return false;
  const allowed = String(product.restrictCities || '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
  return !allowed.length || allowed.includes(store.city.toLowerCase());
}
