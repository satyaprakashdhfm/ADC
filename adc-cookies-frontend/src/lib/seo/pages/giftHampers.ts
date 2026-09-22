import type { SeoPageContent } from '../types';
import { EIGHT_PACK } from '../menu';

/* The gifting page the festival and gift articles point to. Drawn by its own layout in
   app/cookie-gift-hampers (not the article template), but described here like every other search
   page, so the blog cards, related links, sitemap and admin SEO tab all read it from one place.
   Keyword ("cookie gift hampers" / "cookie gift box") was not in the planner export yet. */
export const giftHampers: SeoPageContent = {
  path: '/cookie-gift-hampers',
  kind: 'landing',
  title: `Cookie Gift Hampers & Gift Boxes | a dough cookie`,
  description: `Eggless cookie gift boxes and hampers for festivals, birthdays and office gifting. Cookie tins from {tins:from}, gift wrap with a handwritten card, and bulk hampers.`,
  h1: `Cookie gift hampers and boxes`,
  name: `Gift hampers and boxes`,
  excerpt: `Cookie tins, boxes of eight and made-to-order hampers for festivals, birthdays and the office.`,
  hero: {
    src: '/assets/seo/cookie-gift-hamper-biscoff-tin.jpg',
    alt: `Biscoff cookie tin with Lotus Biscoff biscuits, ready to be given as a gift`,
    width: 1280,
    height: 720,
  },
  ogImage: '/assets/seo/og/cookie-gift-hamper-biscoff-tin.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `Eggless cookie tins, boxes of eight and made-to-order hampers, baked fresh at our shops in Bengaluru and Chennai and gift wrapped with a handwritten card.`,
  ],
  sections: [],
  faqs: [
    { q: `Are your cookie gift boxes eggless?`, a: `Yes. Every cookie we bake is eggless, and our kitchens do not use eggs.` },
    { q: `How much does a cookie gift box cost?`, a: `Cookie tins cost {tins:from} to {tins:to}, and a box of any eight cookies is {price:${EIGHT_PACK}}. Bulk hampers are quoted by quantity.` },
    { q: `Can I send a cookie gift to another city?`, a: `Yes. The Chocolate Chip, Nutella and Biscoff tins go by courier to most PIN codes in India. The Red Velvet tin and the box of eight are same-day only, in Bengaluru and Chennai.` },
    { q: `Can I add a personal message?`, a: `Yes. Choose "Send this as a gift" at checkout for gift wrap and a handwritten message card, and tag the occasion.` },
    { q: `Do you make custom hampers in bulk?`, a: `Yes, for festivals, weddings and companies, with your logo on the sleeves if you want it. Send the number and the date through our [corporate enquiry form](/corporate#quote) and we will reply with a quote within one working day.` },
  ],
  related: ['/blog/ganesh-chaturthi-cookie-gifts', '/blog/cookie-tins-for-gifts', '/cookie-tins', '/corporate'],
  listsTins: true,
  cta: { title: 'Send a cookie gift today', body: 'Pick a tin, add your message, and we will deliver it.', label: 'Order a gift', href: '/order' },
};
