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
    name: 'A Dough Cookie — Jayanagar',
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
    name: 'A Dough Cookie — S.G. Palya',
    address: 'No 10, 1st Main Rd, Venkateshwara Layout, S.G. Palya, Bengaluru, Karnataka 560029',
    pincode: 560029,
    phone: SITE_PHONE,
    email: SITE_EMAIL,
    map: 'https://www.google.com/maps/search/?api=1&query=ADC+A+Dough+Cookie+SG+Palya+Bengaluru+560029',
    lat: 12.9357,
    lng: 77.6068,
  },
  {
    city: 'Bengaluru',
    name: 'A Dough Cookie — Electronic City',
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
    name: 'A Dough Cookie — Besant Nagar',
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
