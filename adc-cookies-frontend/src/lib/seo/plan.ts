/*
 * The SEO plan: which Google searches we target, and which page targets each one.
 *
 * Read by the admin SEO tab. Kept apart from the page copy in lib/seo/pages so the admin bundle
 * carries a few kilobytes of keywords instead of every article.
 *
 * Numbers are from the Google Keyword Planner export of 22 Sep 2026 (searches from Sep 2025 to
 * Aug 2026). Google shows searches as a range, not a count, for accounts that are not running
 * search ads, which is why every figure here is a range.
 */

export type Competition = 'Low' | 'Medium' | 'High' | 'Unknown';

export interface KeywordStat {
  keyword: string;
  /** Average searches a month, as Google's range. */
  searches: string;
  competition: Competition;
  /** Google's 0 to 100 competition score, when it gave one. */
  index?: number;
  /** Top-of-page bid range in rupees, when Google gave one. */
  bid?: string;
  /** Change against a year before. */
  trend?: string;
}

export interface KeywordGroup {
  id: string;
  name: string;
  verdict: string;
  why: string;
  keywords: KeywordStat[];
}

export const KEYWORD_SOURCE = 'Google Keyword Planner, exported 22 Sep 2026 (searches Sep 2025 to Aug 2026)';

export const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    id: 'local',
    name: 'Near me and city searches',
    verdict: 'Easiest to win first',
    why: 'People nearby, ready to buy today. The least contested keywords in the whole file, and we have shops in both cities.',
    keywords: [
      { keyword: 'cookie tins near me', searches: '1K–10K', competition: 'Low', index: 10, bid: '₹1.78–9.68', trend: '+9,900%' },
      { keyword: 'cookie tins nearby', searches: '100–1K', competition: 'Low', index: 14, trend: 'New' },
      { keyword: 'cookie tin nearby', searches: '100–1K', competition: 'Low', index: 14, trend: 'New' },
      { keyword: 'tin of cookies near me', searches: '10–100', competition: 'Low', index: 21 },
      { keyword: 'best cookies in chennai', searches: '10–100', competition: 'High', index: 86, trend: '+900%' },
      { keyword: 'best cookies in bangalore', searches: 'Not in the file', competition: 'Unknown' },
    ],
  },
  {
    id: 'tins',
    name: 'Cookie tins',
    verdict: 'Our main product',
    why: 'The biggest searches in the file, and growing fast. Hardest to reach the top for, because marketplaces and packaging sellers are there too.',
    keywords: [
      { keyword: 'cookie tins', searches: '10K–100K', competition: 'Low', index: 32, bid: '₹2.58–15.06', trend: '+9,900%' },
      { keyword: 'tinned cookies', searches: '10K–100K', competition: 'Low', index: 32, bid: '₹2.58–15.06', trend: '+9,900%' },
      { keyword: 'cookie tin cookies', searches: '100–1K', competition: 'High', index: 89, trend: '+900%' },
      { keyword: 'cookies in the tin', searches: '100–1K', competition: 'High', index: 89, trend: '+900%' },
      { keyword: 'a tin of cookies', searches: '100–1K', competition: 'High', index: 89, trend: '+900%' },
      { keyword: 'cookietin', searches: '100–1K', competition: 'Low', index: 14, bid: '₹1.24–6.09', trend: '+900%' },
      { keyword: 'cookie cake tin', searches: '100–1K', competition: 'Low', index: 30, trend: '+9,900%' },
      { keyword: 'chocolate cookie tin', searches: '100–1K', competition: 'Medium', index: 50, trend: '+9,900%' },
      { keyword: 'chocolate chip cookies in a tin', searches: '10–100', competition: 'High', index: 72, trend: '+900%' },
    ],
  },
  {
    id: 'gifting',
    name: 'Gifting and festivals',
    verdict: 'Small, but ready to buy',
    why: 'Few searches each, but everyone typing them is about to spend money on a present.',
    keywords: [
      { keyword: 'cookie tins for gifts', searches: '10–100', competition: 'High', index: 100 },
      { keyword: 'cookie tins for gift giving', searches: '10–100', competition: 'High', index: 88, trend: 'New' },
      { keyword: 'cookies in gift tin', searches: '10–100', competition: 'Unknown' },
      { keyword: 'biscuit tin gift', searches: '10–100', competition: 'Medium', index: 40 },
      { keyword: 'birthday cookie tin', searches: '10–100', competition: 'Low', index: 14, trend: 'New' },
      { keyword: 'ganesh chaturthi gifts', searches: 'Not checked yet', competition: 'Unknown' },
      { keyword: 'cookie gift hampers', searches: 'Not checked yet', competition: 'Unknown' },
    ],
  },
  {
    id: 'corporate',
    name: 'Corporate and bulk',
    verdict: 'Few searches, big orders',
    why: 'Rarely searched, but one company finding us can mean a hundred tins.',
    keywords: [
      { keyword: 'corporate cookie tins', searches: '10–100', competition: 'Unknown' },
      { keyword: 'custom cookie tins', searches: '10–100', competition: 'Low', index: 3 },
      { keyword: 'personalized cookie tins', searches: '10–100', competition: 'Low', index: 3 },
      { keyword: 'cookie tins bulk', searches: '10–100', competition: 'High', index: 87, bid: '₹2.32–8.71' },
    ],
  },
  {
    id: 'india',
    name: 'Best cookies in India',
    verdict: 'Valuable, but slow',
    why: 'Advertisers pay up to ₹33 a click for these, so they sell. Big brand lists hold the top spots, so expect months, not weeks.',
    keywords: [
      { keyword: 'best cookies in india', searches: '100–1K', competition: 'High', index: 98, bid: '₹0.81–33.38' },
      { keyword: 'best cookie brands in india', searches: '100–1K', competition: 'High', index: 99, bid: '₹0.86–28.32' },
      { keyword: 'best cookies online india', searches: '10–100', competition: 'High', index: 95, bid: '₹1.15–25.97' },
      { keyword: 'famous cookies in india', searches: '10–100', competition: 'Medium', index: 35 },
      { keyword: 'best choco chip cookies in india', searches: '10–100', competition: 'High', index: 80 },
    ],
  },
  {
    id: 'care',
    name: 'Storing cookies',
    verdict: 'Helpful reading',
    why: 'Few searches, but it answers what every tin buyer asks, and it links readers back to the tins.',
    keywords: [
      { keyword: 'cookie storage tins', searches: '10–100', competition: 'Medium', index: 60 },
      { keyword: 'keeping cookies fresh in tins', searches: '10–100', competition: 'Unknown' },
      { keyword: 'airtight cookie tins', searches: '10–100', competition: 'High', index: 90 },
    ],
  },
];

/** Searches in the file we are deliberately not chasing, and why. */
export const SKIPPED: { keyword: string; searches: string; why: string }[] = [
  { keyword: 'royal dansk cookies', searches: '1K–10K', why: 'People want that brand, not ours.' },
  { keyword: 'butter cookies denmark', searches: '1K–10K', why: 'Same: the blue Danish tin.' },
  { keyword: 'tin boxes for cookies', searches: '1K–10K', why: 'Empty tins, for people packing their own.' },
  { keyword: 'cookie containers', searches: '100–1K', why: 'Storage boxes, not cookies.' },
  { keyword: 'best sugar free biscuits in india', searches: '100–1K', why: 'Not on our menu.' },
  { keyword: 'muffin tins, cookie pans, Walkers, Thanksgiving tins', searches: 'Many small', why: 'Baking tools, foreign brands and foreign holidays.' },
];

export type PageKind = 'Landing page' | 'Article' | 'Gift page';

export interface PlanPage {
  path: string;
  name: string;
  kind: PageKind;
  group: KeywordGroup['id'];
  primary: string;
  secondary: string[];
  /** What the person searching wants, in a line. */
  intent: string;
  /** The day it went live (IST). */
  live: string;
}

/* One row per page. The primary keyword's numbers are looked up from KEYWORD_GROUPS. */
export const PLAN_PAGES: PlanPage[] = [
  { path: '/cookie-tins-in-bangalore', name: 'Cookie tins in Bangalore', kind: 'Landing page', group: 'local', primary: 'cookie tins near me', secondary: ['cookie tins nearby', 'tin of cookies near me', 'cookie tins in bangalore', 'cookie tin delivery'], intent: 'In Bangalore, wants a tin today.', live: '2026-09-22' },
  { path: '/cookie-tins', name: 'Cookie tins', kind: 'Landing page', group: 'tins', primary: 'cookie tins', secondary: ['tinned cookies', 'cookie tin cookies', 'a tin of cookies', 'cookie cake tin'], intent: 'Wants to know what a cookie tin is and buy one.', live: '2026-09-22' },
  { path: '/best-cookies-in-bangalore', name: 'Best cookies in Bangalore', kind: 'Landing page', group: 'local', primary: 'best cookies in bangalore', secondary: ['cookies in bangalore', 'cookie delivery bangalore', 'cookie shop bangalore'], intent: 'In Bangalore, choosing where to get cookies.', live: '2026-08-12' },
  { path: '/best-cookies-in-chennai', name: 'Cookies in Chennai', kind: 'Landing page', group: 'local', primary: 'best cookies in chennai', secondary: ['cookies in chennai', 'cookie delivery chennai', 'cookies besant nagar'], intent: 'In Chennai, choosing where to get cookies.', live: '2026-09-22' },
  { path: '/cookie-gift-hampers', name: 'Gift hampers and boxes', kind: 'Gift page', group: 'gifting', primary: 'cookie gift hampers', secondary: ['cookie gift box', 'cookies in gift tin', 'biscuit tin gift'], intent: 'Buying cookies as a present, one or many.', live: '2026-09-22' },
  { path: '/blog/cookie-tins-for-gifts', name: 'Cookie tins for gifts', kind: 'Article', group: 'gifting', primary: 'cookie tins for gifts', secondary: ['cookie tins for gift giving', 'birthday cookie tin', 'cookies in gift tin'], intent: 'Choosing which tin to give someone.', live: '2026-09-22' },
  { path: '/blog/ganesh-chaturthi-cookie-gifts', name: 'Ganesh Chaturthi cookie gifts', kind: 'Article', group: 'gifting', primary: 'ganesh chaturthi gifts', secondary: ['ganesh chaturthi sweets gift', 'eggless cookies for festival'], intent: 'Looking for a festival gift for family or friends.', live: '2026-09-22' },
  { path: '/corporate', name: 'Corporate gifting', kind: 'Landing page', group: 'corporate', primary: 'corporate cookie tins', secondary: ['custom cookie tins', 'personalized cookie tins', 'cookie tins bulk'], intent: 'A company ordering gifts in bulk.', live: '2026-07-25' },
  { path: '/blog/best-cookies-in-india', name: 'Best cookies in India', kind: 'Article', group: 'india', primary: 'best cookies in india', secondary: ['best cookie brands in india', 'best cookies online india', 'famous cookies in india'], intent: 'Comparing cookies before ordering online.', live: '2026-09-22' },
  { path: '/blog/chocolate-cookie-tins', name: 'Chocolate cookie tins', kind: 'Article', group: 'tins', primary: 'chocolate cookie tin', secondary: ['chocolate chip cookies in a tin', 'tin of chocolate chip cookies', 'best choco chip cookies in india'], intent: 'Wants a chocolate tin and is choosing between two.', live: '2026-09-22' },
  { path: '/blog/keep-cookies-fresh-in-a-tin', name: 'Keeping cookies fresh in a tin', kind: 'Article', group: 'care', primary: 'keeping cookies fresh in tins', secondary: ['cookie storage tins', 'airtight cookie tins'], intent: 'Has cookies and wants them to last.', live: '2026-09-22' },
];

/** The Planner numbers for a keyword, if it is in the file. */
export function statFor(keyword: string): KeywordStat | undefined {
  for (const g of KEYWORD_GROUPS) {
    const hit = g.keywords.find(k => k.keyword === keyword);
    if (hit) return hit;
  }
  return undefined;
}
