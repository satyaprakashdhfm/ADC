import type { SeoPageContent } from '../types';
import { TIN } from '../menu';

/* Primary keyword: "cookie tins for gifts". Small searches each (10 to 100 a month), but the people
   typing them are about to buy, and the related gifting searches add up. */
export const cookieTinsForGifts: SeoPageContent = {
  path: '/blog/cookie-tins-for-gifts',
  kind: 'article',
  title: `Cookie Tins for Gifts: How to Pick One | a dough cookie`,
  description: `How to choose a cookie tin as a gift: which flavour suits whom, adding a message, timing the delivery, and sending it to another city.`,
  h1: `Cookie tins for gifts: how to pick the right one`,
  name: `Cookie tins for gifts`,
  excerpt: `Which flavour to choose, how to add a note, and how to time delivery so the tin arrives fresh.`,
  hero: {
    src: '/assets/seo/cookie-tin-gift-red-velvet.jpg',
    alt: `Red velvet cookie tin cut into slices, with cream cheese on top`,
    width: 1280,
    height: 720,
  },
  ogImage: '/assets/seo/og/cookie-tin-gift-red-velvet.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `Cookie tins make good gifts because they arrive ready to hand over and already cut into slices, so they work for a family visit as well as for one person with a sweet tooth. A few questions are worth answering before you order one.`,
  ],
  sections: [
    {
      h2: `Start with who it is for`,
      blocks: [
        {
          kind: 'list',
          items: [
            `Someone whose taste you do not know: the Chocolate Chip tin ({price:${TIN.chocolateChip}}). It is the safest choice on the menu.`,
            `A chocolate lover: the Nutella tin ({price:${TIN.nutella}}), made with real Nutella.`,
            `Someone who has tried everything: the Biscoff tin ({price:${TIN.biscoff}}). It tastes of caramel and cinnamon and comes with a free name tag.`,
            `A birthday or anniversary in the same city: the Red Velvet tin ({price:${TIN.redVelvet}}). It has a cream cheese layer, so it has to be eaten within a day, and we deliver it only within Bengaluru and Chennai.`,
          ],
        },
        { kind: 'tins' },
      ],
    },
    {
      h2: `Add a note`,
      blocks: [
        { kind: 'p', text: `At checkout, turn on "Send this as a gift". We add gift wrap and a handwritten card with your message, and you can tag the occasion: birthday, anniversary, wedding, thank you and a few more. The charge for gift wrap shows on the bill before you pay.` },
        { kind: 'p', text: `A line or two fits the card. Sign it, so they know who it is from.` },
      ],
    },
    {
      h2: `Time the delivery`,
      blocks: [
        { kind: 'p', text: `In Bengaluru and Chennai, a tin is sent from our nearest shop and arrives the same day. Order in the morning for a same-day surprise. Orders placed late in the evening go out on the next baking day.` },
        { kind: 'p', text: `For another city, choose Chocolate Chip, Nutella or Biscoff, which travel by courier. Checkout shows the expected delivery date for their PIN code, so you can order a few days ahead of a birthday. Most tins keep for up to two days after they arrive.` },
      ],
    },
    {
      h2: `Sending it to someone else`,
      blocks: [
        { kind: 'p', text: `Enter their address and their phone number at checkout, so the delivery can reach them directly. Your order confirmation still comes to your own WhatsApp, so it does not give the surprise away.` },
      ],
    },
    {
      h2: `Gifts for a group`,
      blocks: [
        { kind: 'p', text: `For an office, a housing society or a wedding, one tin per family or team is easy to hand out. Our [gift hampers and boxes](/cookie-gift-hampers) page covers larger orders, and [corporate gifting](/corporate) adds your logo and a single delivery date.` },
        { kind: 'buttons', primary: { label: 'See gift hampers and boxes', href: '/cookie-gift-hampers' }, secondary: { label: 'Order a tin', href: '/order' } },
      ],
    },
  ],
  faqs: [
    { q: `Which cookie tin is best as a gift?`, a: `If you do not know their taste, Chocolate Chip ({price:${TIN.chocolateChip}}). For a chocolate lover, Nutella ({price:${TIN.nutella}}). For a bigger gift, Biscoff ({price:${TIN.biscoff}}), which comes with a free name tag.` },
    { q: `Can I add a gift message to a cookie tin?`, a: `Yes. Turn on "Send this as a gift" at checkout for gift wrap and a handwritten card with your message.` },
    { q: `Can I send a cookie tin to another city?`, a: `Yes. The Chocolate Chip, Nutella and Biscoff tins go by courier to most PIN codes in India. The Red Velvet tin is same-day only, in Bengaluru and Chennai.` },
    { q: `Are the cookie tins eggless?`, a: `Yes. Every cookie we bake is eggless, and our kitchens do not use eggs.` },
  ],
  related: ['/cookie-gift-hampers', '/cookie-tins', '/blog/ganesh-chaturthi-cookie-gifts', '/corporate'],
  cta: { title: 'Send a cookie tin today', body: 'Pick a flavour, add your note, and we will take it from there.', label: 'Order a gift', href: '/order' },
};
