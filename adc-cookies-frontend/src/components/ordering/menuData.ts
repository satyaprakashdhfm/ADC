import { Cookie, Gift, Briefcase } from 'lucide-react';

/* The menu shown before the API responds, plus the category metadata around it. Kept out of the
   component so a copy change is a data edit, not a JSX edit. */
export const CATEGORIES = ['Cookies', 'Cookie Tins', 'Corporate Gifting'];

export const CATEGORY_META = {
  Cookies: { icon: Cookie },
  'Cookie Tins': { icon: Gift },
  'Corporate Gifting': { icon: Briefcase },
} as const;

export const PAIRINGS = [
  { id: 'shake', name: 'Vanilla Milkshake', price: 120, img: null },
  { id: 'brownie', name: 'Fudge Brownie', price: 90, img: null },
  { id: 'coffee', name: 'Cold Coffee', price: 110, img: null },
  { id: 'icecream', name: 'Ice Cream Scoop', price: 70, img: null },
];

export const FALLBACK_MENU = [
  { id: 'choc', name: 'Chocolate Chip Cookie', price: 60, cat: 'Cookies', rec: true, rating: 4.6, rc: '3.4k', veg: true, img: '/assets/products/blueberry.jpg', desc: 'Golden-baked cookie loaded with premium chocolate chips, perfectly crisp outside and soft, chewy inside.' },
  { id: 'double', name: 'Double Choco Chip Cookie', price: 65, cat: 'Cookies', best: true, rating: 4.7, rc: '1.2k', veg: true, img: '/assets/products/triple-choc.jpg', desc: 'A rich chocolate cookie packed with double chocolate chips for an intensely fudgy, chocolate-loaded experience.' },
  { id: 'raagi', name: 'Ragi Cookie (Gluten-Free)', price: 60, cat: 'Cookies', rating: 4.4, rc: '820', veg: true, img: '/assets/products/oatmeal-raisin.jpg', desc: 'Wholesome gluten-free ragi cookie with a hearty bite, balanced sweetness, and satisfying crunch.' },
  { id: 'matcha', name: 'Matcha Cookie', price: 90, cat: 'Cookies', rec: true, rating: 4.5, rc: '640', veg: true, img: '/assets/products/matcha.jpg', desc: 'Buttery cookie infused with premium matcha, delivering earthy notes balanced with subtle sweetness.' },
  { id: 'special', name: 'ADC Special Cookie', price: 90, cat: 'Cookies', best: true, rating: 4.8, rc: '2.1k', veg: true, img: '/assets/products/adc-special.jpg', desc: 'Our signature brownie-inspired cookie with a rich chocolatey center, crisp edges, and irresistibly gooey bites.' },
  { id: 'redvelvet', name: 'Red Velvet Filled Cookie', price: 90, cat: 'Cookies', rating: 4.6, rc: '910', veg: true, img: '/assets/products/red-velvet.jpg', desc: 'Soft red velvet cookie with a luscious cream cheese filling for the perfect sweet balance.' },
  { id: 'biscoff', name: 'Biscoff Filled Cookie', price: 110, cat: 'Cookies', best: true, rating: 4.9, rc: '4.0k', veg: true, img: '/assets/products/peanut-butter.jpg', desc: 'Warm cookie filled with creamy Biscoff spread and crunchy Lotus Biscoff biscuit piece.' },
  { id: 'nutella', name: 'Nutella Filled Cookie', price: 90, cat: 'Cookies', rec: true, rating: 4.7, rc: '2.6k', veg: true, img: '/assets/products/caramel-cashew.jpg', desc: 'Freshly baked cookie overflowing with rich, molten Nutella in every indulgent bite.' },
];

export const FALLBACK_TINS = [
  { id: 'nutella-tin', name: 'Nutella Cookie Tin', price: 600, count: 6, img: '/assets/products/coffee-almond.jpg', desc: 'Soft-baked cookies generously filled with creamy Nutella for an irresistible chocolate indulgence.' },
  { id: 'biscoff-tin', name: 'Biscoff Cookie Tin', price: 850, count: 9, img: '/assets/products/m-and-m.jpg', desc: 'Freshly baked Biscoff cookies layered with creamy Biscoff spread and crunchy biscuit crumbles.' },
];

export type MenuItem = typeof FALLBACK_MENU[0];
export type TinItem = typeof FALLBACK_TINS[0];
