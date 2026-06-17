export interface Store {
  city: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  map: string;
}

/** ADC store locations — shared by the homepage About/Stores section and the Contact page. */
export const STORES: Store[] = [
  {
    city: 'Bengaluru',
    name: 'ADC Indiranagar',
    address: '12, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 98765 43210',
    email: 'bengaluru@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Indiranagar+Bengaluru+Karnataka',
  },
  {
    city: 'Mumbai',
    name: 'ADC Bandra',
    address: 'Linking Road, Bandra West, Mumbai, Maharashtra 400050',
    phone: '+91 98765 43211',
    email: 'mumbai@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Bandra+West+Mumbai+Maharashtra',
  },
  {
    city: 'Delhi',
    name: 'ADC Connaught Place',
    address: 'Connaught Place, New Delhi, Delhi 110001',
    phone: '+91 98765 43212',
    email: 'delhi@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Connaught+Place+New+Delhi',
  },
  {
    city: 'Hyderabad',
    name: 'ADC Jubilee Hills',
    address: 'Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033',
    phone: '+91 98765 43213',
    email: 'hyderabad@adccookies.com',
    map: 'https://www.google.com/maps/search/?api=1&query=Jubilee+Hills+Hyderabad+Telangana',
  },
];
