/*
 * The menu as the search pages see it: the gift tins and boxes, with the price and courier rule
 * the checkout will actually apply.
 *
 * Read from the live API on the server, so a price changed in admin reaches these pages within the
 * hour (the pages revalidate hourly) instead of waiting for someone to edit a paragraph. A search
 * page whose whole job is being right cannot keep its own copy of the prices.
 *
 * SNAPSHOT is what the API returned on 22 Sep 2026. It is used only when the API cannot be reached,
 * which includes a build that runs before the backend is up. It is a fallback, not a second source:
 * nothing reads it while the API answers.
 */

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
  /** Can travel by courier to the rest of India. False means same-day in our shop cities only. */
  ships: boolean;
  /** Why it cannot travel, in the words checkout uses. Null when it can. */
  shipsNote: string | null;
}

/** Product ids the pages refer to by name in their copy. */
export const TIN = { chocolateChip: 12, nutella: 9, redVelvet: 13, biscoff: 10 } as const;
export const EIGHT_PACK = 39;

const SAME_DAY_ONLY = 'Made to be eaten within 24 hours of baking, so it goes same-day inside our shop cities only.';

const cookie = (id: number, name: string, price: number, image: string, ships = true): MenuItem => ({
  id, name, category: 'COOKIES', price, description: '', image: `/assets/cookies_new_images/${image}.jpeg`, ships, shipsNote: ships ? null : SAME_DAY_ONLY,
});

const SNAPSHOT: MenuItem[] = [
  cookie(1, 'Chocolate Chip Cookie', 60, 'chocolate-chip'),
  cookie(2, 'Double Choco Chip Cookie', 65, 'double-chocolate'),
  cookie(3, 'Ragi Cookie (Gluten-Free)', 60, 'raagi'),
  cookie(4, 'Matcha Cookie', 90, 'matcha'),
  cookie(5, 'ADC Special Cookie', 90, 'adc-special'),
  cookie(6, 'Red Velvet Filled Cookie', 90, 'red-velvet-filled', false),
  cookie(7, 'Biscoff Filled Cookie', 110, 'biscoff-filled'),
  cookie(8, 'Nutella Filled Cookie', 90, 'nutella-filled'),
  { id: 12, name: 'Chocolate Chip Cookie Tin', category: 'TINS', price: 500, description: 'A tin full of freshly baked chocolate chip cookies with rich chocolate in every bite.', image: '/assets/cookies_new_images/choc-chip-tin.jpeg', ships: true, shipsNote: null },
  { id: 9, name: 'Nutella Cookie Tin', category: 'TINS', price: 600, description: 'Soft-baked cookies generously filled with creamy Nutella for an irresistible chocolate indulgence.', image: '/assets/cookies_new_images/nutella-tin.jpeg', ships: true, shipsNote: null },
  { id: 13, name: 'Red Velvet Cookie Tin', category: 'TINS', price: 700, description: 'Red velvet cookies layered with smooth cream cheese for a rich and velvety dessert experience.', image: '/assets/cookies_new_images/red-velvet-tin.jpeg', ships: false, shipsNote: SAME_DAY_ONLY },
  { id: 10, name: 'Biscoff Cookie Tin', category: 'TINS', price: 850, description: 'Freshly baked Biscoff cookies layered with creamy Biscoff spread and crunchy biscuit crumbles.', image: '/assets/cookies_new_images/biscoff-tin.jpeg', ships: true, shipsNote: null },
  { id: 39, name: '8 Pack Cookies', category: 'COMBOS', price: 600, description: 'Choose any eight freshly baked cookies and enjoy your favourite flavours in one delicious assortment.', image: '/assets/products/new_coming/Pack%20of%208%20Cookies.jpeg', ships: false, shipsNote: SAME_DAY_ONLY },
];

interface ApiProduct {
  id: number; name: string; category: string; price: number; description: string;
  images: string | null; isAvailable: boolean;
  intercityAvailable: boolean; intercityUnavailableReason: string | null;
}

function firstImage(images: string | null, fallback: string): string {
  if (!images) return fallback;
  try {
    const list = JSON.parse(images);
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : fallback;
  } catch {
    return fallback;
  }
}

/** Every available product, or the snapshot when the API is unreachable. Never throws. */
export async function getMenu(): Promise<MenuItem[]> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return SNAPSHOT;
  try {
    const res = await fetch(`${base}/products`, { next: { revalidate: 3600 } });
    if (!res.ok) return SNAPSHOT;
    const rows = (await res.json()) as ApiProduct[];
    if (!Array.isArray(rows) || !rows.length) return SNAPSHOT;
    return rows.filter(p => p.isAvailable).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      description: p.description,
      image: firstImage(p.images, SNAPSHOT.find(s => s.id === p.id)?.image ?? '/assets/products/adc-special.jpg'),
      ships: p.intercityAvailable,
      shipsNote: p.intercityAvailable ? null : (p.intercityUnavailableReason || SAME_DAY_ONLY),
    }));
  } catch {
    return SNAPSHOT;
  }
}

export const tinsOf = (menu: MenuItem[]) => menu.filter(m => m.category === 'TINS').sort((a, b) => a.price - b.price);
export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * Fills the price placeholders in page copy: {price:12} is product 12's price; {tins:from},
 * {tins:to}, {cookies:from} and {cookies:to} are the cheapest and dearest tin or single cookie.
 * A product that has left the menu renders as "the price on the menu" rather than a stale number,
 * so a withdrawn tin can never be quoted at its old price.
 */
export function fillPrices(text: string, menu: MenuItem[]): string {
  if (!text.includes('{')) return text;
  const range = (category: string) => menu.filter(m => m.category === category).map(m => m.price).sort((a, b) => a - b);
  const tins = range('TINS');
  const cookies = range('COOKIES');
  const end = (list: number[], last: boolean) => (list.length ? rupees(last ? list[list.length - 1]! : list[0]!) : 'the menu price');
  return text
    .replace(/\{price:(\d+)\}/g, (_, id) => {
      const item = menu.find(m => m.id === Number(id));
      return item ? rupees(item.price) : 'the price on the menu';
    })
    .replace(/\{tins:from\}/g, end(tins, false))
    .replace(/\{tins:to\}/g, end(tins, true))
    .replace(/\{cookies:from\}/g, end(cookies, false))
    .replace(/\{cookies:to\}/g, end(cookies, true));
}
