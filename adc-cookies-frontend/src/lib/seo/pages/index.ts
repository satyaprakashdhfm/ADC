import type { SeoImage, SeoPageContent } from '../types';
import { cookieTinsBangalore } from './cookieTinsBangalore';
import { cookieTins } from './cookieTins';
import { bestCookiesChennai } from './bestCookiesChennai';
import { cookieTinsForGifts } from './cookieTinsForGifts';
import { ganeshChaturthi } from './ganeshChaturthi';
import { bestCookiesIndia } from './bestCookiesIndia';
import { chocolateCookieTins } from './chocolateCookieTins';
import { keepCookiesFresh } from './keepCookiesFresh';
import { giftHampers } from './giftHampers';

/** Every search page built from lib/seo content, in the order the blog lists them. */
export const SEO_PAGES: SeoPageContent[] = [
  giftHampers,
  cookieTins,
  cookieTinsBangalore,
  bestCookiesChennai,
  ganeshChaturthi,
  cookieTinsForGifts,
  chocolateCookieTins,
  bestCookiesIndia,
  keepCookiesFresh,
];

export const ARTICLES = SEO_PAGES.filter(p => p.kind === 'article');

export const seoPage = (path: string) => SEO_PAGES.find(p => p.path === path);

export interface PageCard {
  path: string;
  name: string;
  excerpt: string;
  image: SeoImage;
}

/* The two search pages that predate lib/seo and keep their own hand-written layouts. They are
   here only so other pages can link to them with a proper card. */
const OLDER_PAGES: PageCard[] = [
  {
    path: '/best-cookies-in-bangalore',
    name: 'Best cookies in Bangalore',
    excerpt: 'Our three Bengaluru shops, the full cookie menu, and same-day delivery across the city.',
    image: { src: '/assets/hero-cookies-wide.jpg', alt: 'Freshly baked cookies from a dough cookie in Bangalore', width: 2400, height: 1200 },
  },
  {
    path: '/corporate',
    name: 'Corporate gifting',
    excerpt: 'Branded cookie boxes and tins for clients, teams and events, with volume pricing.',
    image: { src: '/assets/seo/og/corporate-cookie-gift-hampers.jpg', alt: 'Corporate cookie gift hampers from a dough cookie', width: 1200, height: 630 },
  },
];

export function pageCard(path: string): PageCard | undefined {
  const page = seoPage(path);
  if (page) return { path: page.path, name: page.name, excerpt: page.excerpt, image: page.hero };
  return OLDER_PAGES.find(p => p.path === path);
}
