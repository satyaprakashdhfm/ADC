import type { SeoPageContent } from '../types';
import { TIN } from '../menu';

/* Primary keyword: "cookie tins near me" (1K to 10K searches a month, competition 10 of 100). */
export const cookieTinsBangalore: SeoPageContent = {
  path: '/cookie-tins-in-bangalore',
  kind: 'landing',
  title: `Cookie Tins in Bangalore, Same-Day Delivery | a dough cookie`,
  description: `Fresh-baked cookie tins near you in Bangalore. Four eggless flavours from {tins:from}, sent from our three shops and delivered the same day.`,
  h1: `Cookie tins in Bangalore, baked and delivered the same day`,
  name: `Cookie tins in Bangalore`,
  excerpt: `Where to get a fresh cookie tin near you in Bangalore, what the four tins cost, and how same-day delivery works.`,
  hero: {
    src: '/assets/seo/cookie-tin-shop-bangalore.jpg',
    alt: `A Dough Cookie shop front in Bengaluru, with the Kannada and English sign above the door`,
    width: 1024,
    height: 576,
  },
  ogImage: '/assets/seo/og/cookie-tin-shop-bangalore.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `Looking for cookie tins near you in Bangalore? A Dough Cookie makes four of them, in Chocolate Chip, Nutella, Red Velvet and Biscoff, at three shops in Jayanagar, S.G. Palya and Electronic City. Order one online and it comes to your door the same day from whichever shop is closest.`,
    `Each tin is one large round cookie, sized to the tin and cut into slices so it can be passed around. The lid reads "Happiness in a tin", and the tin is sturdy enough to keep once the cookie is gone.`,
  ],
  answer: {
    title: `The short answer`,
    text: `Order a cookie tin online and it is sent from the nearest of our three Bangalore shops and delivered the same day. Tins cost {tins:from} to {tins:to}, and like everything we bake, they are eggless.`,
  },
  sections: [
    {
      h2: `The four cookie tins`,
      blocks: [
        { kind: 'p', text: `All four are on the menu every day. The prices below come from the menu itself, so they match what you pay at checkout.` },
        { kind: 'tins' },
        { kind: 'p', text: `The Chocolate Chip tin is the simplest and the lowest priced at {price:${TIN.chocolateChip}}. Nutella ({price:${TIN.nutella}}) and Biscoff ({price:${TIN.biscoff}}) are the richer two, and the Biscoff tin comes with a free name tag. The Red Velvet tin ({price:${TIN.redVelvet}}) has a cream cheese layer, so it is made to be eaten the same day and we deliver it only within the city.` },
      ],
    },
    {
      h2: `Cookie tins near you: our Bangalore shops`,
      blocks: [
        { kind: 'p', text: `Each shop bakes its own trays through the day instead of one big batch in the morning. When you order a tin online, it goes to the shop nearest your address, which is how it reaches you while the cookie is still fresh.` },
        { kind: 'stores', city: 'Bengaluru' },
      ],
    },
    {
      h2: `Same-day cookie tin delivery across Bangalore`,
      blocks: [
        { kind: 'p', text: `Put in your address at checkout and, before you pay, you see which shop your tin is coming from, how far away it is, and the delivery fee for that distance.` },
        { kind: 'p', text: `We only promise same-day delivery once our delivery partner has confirmed they can reach your address. If they cannot, checkout tells you and the order is not taken. Orders placed late in the evening go out on the next baking day. The full rules are in our [shipping policy](/shipping-policy).` },
        { kind: 'buttons', primary: { label: 'Order a cookie tin', href: '/order' }, secondary: { label: 'Find a store', href: '/locations' } },
      ],
    },
    {
      h2: `Sending a cookie tin as a gift`,
      blocks: [
        { kind: 'p', text: `Turn on "Send this as a gift" at checkout and the tin is gift wrapped with a handwritten message card. You can tag the occasion, such as a birthday, an anniversary or a thank you, and send it to someone else's address in Bangalore. The small charge for gift wrap shows on the bill before you pay.` },
        { kind: 'p', text: `Our guide to [cookie tins as gifts](/blog/cookie-tins-for-gifts) covers which flavour to pick for whom. For a family function or an office, see [gift hampers and boxes](/cookie-gift-hampers), and [corporate gifting](/corporate) for branded boxes.` },
      ],
    },
    {
      h2: `How long a cookie tin stays fresh`,
      blocks: [
        { kind: 'p', text: `Keep the lid on and the tin somewhere cool and dry, away from the stove and direct sun. The Nutella and Biscoff tins keep for up to two days. Finish the Red Velvet tin the day it arrives, because of the cream cheese.` },
        { kind: 'p', text: `A slice tastes closer to fresh from the oven after 8 to 10 seconds in the microwave. Take it out of the tin first, since the tin is metal. There is more in our guide to [keeping cookies fresh in a tin](/blog/keep-cookies-fresh-in-a-tin).` },
      ],
    },
  ],
  faqs: [
    { q: `Where can I buy cookie tins near me in Bangalore?`, a: `A Dough Cookie has three shops in Bangalore: Jayanagar 9th Block (opposite Jain University Gate 1), S.G. Palya and Electronic City Phase 1. Order a tin online and it comes from whichever shop is nearest your address.` },
    { q: `How much does a cookie tin cost?`, a: `Our cookie tins cost {tins:from} to {tins:to}: Chocolate Chip {price:${TIN.chocolateChip}}, Nutella {price:${TIN.nutella}}, Red Velvet {price:${TIN.redVelvet}} and Biscoff {price:${TIN.biscoff}}. Delivery is charged by distance and shown before you pay.` },
    { q: `Can I get a cookie tin delivered the same day in Bangalore?`, a: `Yes. Orders to a Bangalore address are delivered the same day. Checkout confirms same-day delivery for your address before you pay, and orders placed late in the evening go out the next baking day.` },
    { q: `Are your cookie tins eggless?`, a: `Yes. Every cookie we bake is eggless, and our kitchens do not use eggs at all.` },
    { q: `Can I add a message to a cookie tin?`, a: `Yes. Choose "Send this as a gift" at checkout to add gift wrap and a handwritten message card, and pick the occasion.` },
    { q: `Do you deliver cookie tins outside Bangalore?`, a: `The Chocolate Chip, Nutella and Biscoff tins go by courier to most PIN codes in India, with the expected date shown at checkout. The Red Velvet tin is same-day only, inside Bengaluru and Chennai.` },
  ],
  related: ['/best-cookies-in-bangalore', '/cookie-tins', '/cookie-gift-hampers', '/blog/cookie-tins-for-gifts'],
  city: 'Bengaluru',
  listsTins: true,
  cta: { title: 'Order a cookie tin', body: 'Pick a flavour and we will send it from the shop nearest you.', label: 'Order now', href: '/order' },
};
