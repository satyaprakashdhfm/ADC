import type { SeoPageContent } from '../types';
import { TIN } from '../menu';

/* Primary keyword: "cookie tins" (10K to 100K searches a month, up 9,900% on last year).
   "tinned cookies" and "cookie cake tin" are the same search to Google and are covered here. */
export const cookieTins: SeoPageContent = {
  path: '/cookie-tins',
  kind: 'landing',
  title: `Fresh-Baked Cookie Tins, Sent Across India | a dough cookie`,
  description: `Cookie tins from a dough cookie: one big eggless cookie in a round tin, in four flavours from {tins:from}. Same day in Bengaluru and Chennai, by courier across India.`,
  h1: `Cookie tins, baked fresh and sent across India`,
  name: `Cookie tins`,
  excerpt: `What is inside our cookie tins, the four flavours and their prices, and how they travel to the rest of India.`,
  hero: {
    src: '/assets/seo/cookie-tins-a-dough-cookie.jpg',
    alt: `The four a dough cookie tins: Chocolate Chip, Nutella, Red Velvet and Biscoff`,
    width: 1280,
    height: 720,
  },
  ogImage: '/assets/seo/og/cookie-tins-a-dough-cookie.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `A cookie tin from A Dough Cookie is one large, eggless cookie in a round tin, cut into slices so everyone at the table gets a piece. We make four: Chocolate Chip, Nutella, Red Velvet and Biscoff.`,
    `They are baked at our shops in Bengaluru and Chennai and sent out the same day. Three of the four also travel by courier, so you can order a tin from almost anywhere in India.`,
  ],
  answer: {
    title: `What is a cookie tin?`,
    text: `A large cookie that fills a round tin, sliced for sharing and closed with a lid. Ours cost {tins:from} to {tins:to}, are eggless, and most keep for up to two days with the lid on.`,
  },
  sections: [
    {
      h2: `Our four cookie tins`,
      blocks: [
        { kind: 'tins' },
        { kind: 'h3', text: `Chocolate Chip, {price:${TIN.chocolateChip}}` },
        { kind: 'p', text: `The classic, and our lowest-priced tin. Like all our cookies it is made with Président butter and couverture chocolate. If you do not know what someone likes, this is the one to send.` },
        { kind: 'h3', text: `Nutella, {price:${TIN.nutella}}` },
        { kind: 'p', text: `A soft chocolate cookie made with real Nutella, for anyone who likes hazelnut. Warm a slice for a few seconds and the Nutella turns glossy again.` },
        { kind: 'h3', text: `Red Velvet, {price:${TIN.redVelvet}}` },
        { kind: 'p', text: `Red velvet with a smooth cream cheese layer. The cream cheese means it has to be eaten within 24 hours of baking, so we deliver it the same day inside Bengaluru and Chennai only.` },
        { kind: 'h3', text: `Biscoff, {price:${TIN.biscoff}}` },
        { kind: 'p', text: `Made with Lotus Biscoff spread and crushed Biscoff biscuits, so it tastes of caramel and cinnamon. It is our highest-priced tin and comes with a free name tag.` },
      ],
    },
    {
      h2: `Why a tin`,
      blocks: [
        { kind: 'p', text: `The tin protects the cookie on its way to you and keeps the air out once it has arrived. It also looks finished enough to hand over as a present without any more wrapping. When the cookie is gone, the tin is yours to reuse.` },
      ],
    },
    {
      h2: `Cookie tin delivery across India`,
      blocks: [
        { kind: 'p', text: `In Bengaluru and Chennai, a tin is sent from our nearest shop and arrives the same day. Delivery is priced by distance, and you see the fee before you pay.` },
        { kind: 'p', text: `Everywhere else, the Chocolate Chip, Nutella and Biscoff tins go by courier for a flat fee. Checkout shows the expected delivery date for your PIN code, which comes from the courier. The Red Velvet tin does not travel this way.` },
        { kind: 'p', text: `In Bangalore, our page on [cookie tins in Bangalore](/cookie-tins-in-bangalore) lists the shops and how local delivery works. In Chennai, see [cookies in Chennai](/best-cookies-in-chennai).` },
        { kind: 'buttons', primary: { label: 'Order a cookie tin', href: '/order' } },
      ],
    },
    {
      h2: `Choosing a tin`,
      blocks: [
        {
          kind: 'list',
          items: [
            `For a first order, or someone whose taste you do not know: Chocolate Chip.`,
            `For someone who loves chocolate and hazelnut: Nutella.`,
            `For a birthday in Bengaluru or Chennai that will be eaten the same day: Red Velvet.`,
            `For a bigger present: Biscoff, the richest of the four.`,
          ],
        },
        { kind: 'p', text: `Sending one as a gift? Read [how to choose a cookie tin as a gift](/blog/cookie-tins-for-gifts), or see our [gift hampers and boxes](/cookie-gift-hampers) for larger orders. Chocolate fans can compare our two chocolate tins in [this guide](/blog/chocolate-cookie-tins).` },
      ],
    },
  ],
  faqs: [
    { q: `What is in a cookie tin?`, a: `One large cookie, sized to the tin and cut into slices, with a lid to keep it fresh. The flavour decides the rest: chocolate chips, Nutella, red velvet with cream cheese, or Biscoff spread and crumbs.` },
    { q: `How much do your cookie tins cost?`, a: `{tins:from} to {tins:to}. Chocolate Chip is {price:${TIN.chocolateChip}}, Nutella {price:${TIN.nutella}}, Red Velvet {price:${TIN.redVelvet}} and Biscoff {price:${TIN.biscoff}}.` },
    { q: `Can you ship cookie tins across India?`, a: `Yes, to most PIN codes, by courier. The Chocolate Chip, Nutella and Biscoff tins travel. The Red Velvet tin is same-day only, in Bengaluru and Chennai.` },
    { q: `How long does a cookie tin stay fresh?`, a: `Up to two days with the lid on, kept somewhere cool and dry. The Red Velvet tin should be eaten within 24 hours of baking.` },
    { q: `Are the cookie tins eggless?`, a: `Yes. Everything we bake is eggless.` },
    { q: `Do you make cookie tins in bulk?`, a: `Yes, for offices, weddings and festivals. Send your numbers and date through the form on our [corporate gifting page](/corporate) and we will reply with a quote within one working day.` },
  ],
  related: ['/cookie-tins-in-bangalore', '/blog/chocolate-cookie-tins', '/cookie-gift-hampers', '/blog/keep-cookies-fresh-in-a-tin'],
  listsTins: true,
  cta: { title: 'Pick your cookie tin', body: 'Same day in Bengaluru and Chennai, by courier to the rest of India.', label: 'Order a tin', href: '/order' },
};
