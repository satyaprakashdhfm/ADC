import type { SeoPageContent } from '../types';

/* Primary keyword: "best cookies in chennai" (10 to 100 searches a month, up 900%). Our one Chennai
   shop is in Besant Nagar, so the page is about that shop and the city it delivers to. */
export const bestCookiesChennai: SeoPageContent = {
  path: '/best-cookies-in-chennai',
  kind: 'landing',
  title: `Best Cookies in Chennai | a dough cookie, Besant Nagar`,
  description: `Fresh, eggless cookies in Chennai from our Besant Nagar shop. Chocolate chip, Nutella, Biscoff and more from {cookies:from}, with same-day delivery in Chennai.`,
  h1: `The best cookies in Chennai, baked fresh in Besant Nagar`,
  name: `Cookies in Chennai`,
  excerpt: `Our Besant Nagar shop, the cookies and tins on the menu, and how same-day delivery works in Chennai.`,
  hero: {
    src: '/assets/seo/cookie-shop-besant-nagar-chennai.jpg',
    alt: `A Dough Cookie shop on 6th Avenue, Besant Nagar, Chennai`,
    width: 900,
    height: 506,
  },
  ogImage: '/assets/seo/og/cookie-shop-besant-nagar-chennai.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `If you are looking for the best cookies in Chennai, our shop is on 6th Avenue in Besant Nagar. We bake there through the day in small trays, so a cookie bought in the evening is as fresh as one bought in the morning.`,
    `Everything is eggless and made with Président butter, couverture chocolate, and real Nutella and Lotus Biscoff. Order online for same-day delivery in Chennai, or send a cookie tin to someone in another city by courier.`,
  ],
  answer: {
    title: `The short answer`,
    text: `A Dough Cookie in Besant Nagar bakes eggless cookies all day, priced from {cookies:from} to {cookies:to}. Cookie tins cost {tins:from} to {tins:to}, and orders to Chennai addresses are usually delivered the same day.`,
  },
  sections: [
    {
      h2: `Our shop in Besant Nagar`,
      blocks: [
        { kind: 'stores', city: 'Chennai' },
        { kind: 'p', text: `Walk in for a warm cookie, a cookie shake or a coffee, or order online and have it brought to you.` },
      ],
    },
    {
      h2: `The cookies`,
      blocks: [
        {
          kind: 'list',
          items: [
            `Chocolate Chip, {price:1}. Crisp outside, chewy inside, and the one to judge us by.`,
            `Double Choco Chip, {price:2}. Chocolate dough with twice the chips, and one of our best sellers.`,
            `Nutella Filled, {price:8}. A soft centre of real Nutella.`,
            `Biscoff Filled, {price:7}. Biscoff spread inside, with a piece of Lotus Biscoff biscuit.`,
            `Red Velvet Filled, {price:6}. Cream cheese filling, so eat it the day you buy it.`,
            `ADC Special, {price:5}. Our brownie-style cookie with a gooey chocolate centre.`,
            `Matcha, {price:4}. Buttery, with earthy matcha and a light sweetness.`,
            `Ragi, {price:3}. Gluten-free, made with finger millet instead of wheat flour.`,
          ],
        },
        { kind: 'p', text: `Prices come from our live menu. Filled cookies taste best warm: 8 to 10 seconds in the microwave brings the centre back.` },
      ],
    },
    {
      h2: `Cookie tins in Chennai`,
      blocks: [
        { kind: 'p', text: `A cookie tin is one large cookie in a round tin, cut into slices for sharing. The Red Velvet tin is same-day only. The other three can also be couriered to family and friends outside Chennai.` },
        { kind: 'tins' },
        { kind: 'p', text: `More on each flavour on our [cookie tins](/cookie-tins) page.` },
      ],
    },
    {
      h2: `Same-day cookie delivery in Chennai`,
      blocks: [
        { kind: 'p', text: `Orders to a Chennai address are sent from Besant Nagar. At checkout you see the distance and the delivery fee, and whether same-day delivery is confirmed for your address, before you pay. Most orders arrive in about an hour.` },
        { kind: 'p', text: `Orders placed late in the evening go out on the next baking day. The full rules are in our [shipping policy](/shipping-policy).` },
        { kind: 'buttons', primary: { label: 'Order cookies', href: '/order' }, secondary: { label: 'All our stores', href: '/locations' } },
      ],
    },
  ],
  faqs: [
    { q: `Where can I buy fresh cookies in Chennai?`, a: `At A Dough Cookie, 63, 6th Avenue, Besant Nagar, Chennai 600090. You can also order online for same-day delivery in Chennai.` },
    { q: `Do you deliver cookies in Chennai?`, a: `Yes, from the Besant Nagar shop, usually in about an hour. Checkout confirms same-day delivery for your address before you pay.` },
    { q: `Are your cookies eggless?`, a: `Yes, all of them. Our kitchens do not use eggs.` },
    { q: `Do you have gluten-free cookies in Chennai?`, a: `Yes. The Ragi cookie is gluten-free, made with finger millet instead of wheat flour.` },
    { q: `How much are your cookies?`, a: `Single cookies cost {cookies:from} to {cookies:to}, and cookie tins {tins:from} to {tins:to}. Chennai delivery is priced by distance and shown before you pay.` },
  ],
  related: ['/cookie-tins', '/best-cookies-in-bangalore', '/cookie-gift-hampers', '/blog/best-cookies-in-india'],
  city: 'Chennai',
  listsTins: true,
  cta: { title: 'Cookies in Chennai, today', body: 'Order online and we will send them from Besant Nagar.', label: 'Order now', href: '/order' },
};
