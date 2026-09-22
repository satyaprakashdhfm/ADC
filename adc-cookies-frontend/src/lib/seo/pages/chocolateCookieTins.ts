import type { SeoPageContent } from '../types';
import { TIN } from '../menu';

/* Primary keyword: "chocolate cookie tin" (100 to 1K searches a month, up 9,900% on last year).
   Also covers "chocolate chip cookies in a tin" and "tin of chocolate chip cookies". */
export const chocolateCookieTins: SeoPageContent = {
  path: '/blog/chocolate-cookie-tins',
  kind: 'article',
  title: `Chocolate Cookie Tins: Which One to Order | a dough cookie`,
  description: `Our two chocolate cookie tins compared: the Chocolate Chip tin and the Nutella tin, what is in each, the prices, and how to serve a slice warm.`,
  h1: `Chocolate cookie tins: Chocolate Chip or Nutella?`,
  name: `Chocolate cookie tins`,
  excerpt: `What is in our Chocolate Chip and Nutella tins, how they differ, and how to serve them warm.`,
  hero: {
    src: '/assets/seo/chocolate-chip-cookie-tin.jpg',
    alt: `Chocolate chip cookie tin cut into slices, next to a bar of chocolate and loose chocolate chips`,
    width: 1280,
    height: 720,
  },
  ogImage: '/assets/seo/og/chocolate-chip-cookie-tin.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `We make two chocolate cookie tins. The Chocolate Chip tin ({price:${TIN.chocolateChip}}) is the classic, and the Nutella tin ({price:${TIN.nutella}}) is the richer of the two. Each is one large eggless cookie in a round tin, cut into slices, and both travel by courier across India.`,
    `Here is what separates them, so you can pick the right one for the person you are buying for.`,
  ],
  sections: [
    {
      h2: `The Chocolate Chip cookie tin`,
      blocks: [
        { kind: 'p', text: `Butter cookie dough with chocolate chips all the way through, made with Président butter and couverture chocolate. At {price:${TIN.chocolateChip}} it is also our lowest-priced tin.` },
        { kind: 'p', text: `Choose it when you are buying for a group with mixed tastes, or for a house with children.` },
      ],
    },
    {
      h2: `The Nutella cookie tin`,
      blocks: [
        { kind: 'image', image: { src: '/assets/seo/nutella-chocolate-cookie-tin.jpg', alt: `Nutella cookie tin cut into slices, with a jar of Nutella and hazelnuts beside it`, width: 1280, height: 720 } },
        { kind: 'p', text: `A soft chocolate cookie made with real Nutella. It is sweeter and creamier than the Chocolate Chip tin, and the Nutella turns glossy again when a slice is warmed.` },
        { kind: 'p', text: `Choose it for someone who loves hazelnut, or when the tin is the dessert after a meal.` },
      ],
    },
    {
      h2: `Side by side`,
      blocks: [
        {
          kind: 'list',
          items: [
            `Chocolate Chip costs {price:${TIN.chocolateChip}} and Nutella {price:${TIN.nutella}}.`,
            `Chocolate Chip is buttery with pockets of chocolate. Nutella tastes of chocolate and hazelnut all the way through.`,
            `Both go the same day in Bengaluru and Chennai, and by courier to most PIN codes in India.`,
            `Both are best eaten within two days of arriving, with the lid kept on in between.`,
          ],
        },
        { kind: 'tins', ids: [TIN.chocolateChip, TIN.nutella] },
      ],
    },
    {
      h2: `How to serve a chocolate cookie tin`,
      blocks: [
        { kind: 'p', text: `Warm one slice at a time on a plate, 8 to 10 seconds in the microwave. The chocolate softens and the edge stays crisp. Never put the tin itself in the microwave, since it is metal.` },
        { kind: 'p', text: `Cold coffee or a glass of milk goes well with either. For storing what is left, see our guide to [keeping cookies fresh in a tin](/blog/keep-cookies-fresh-in-a-tin).` },
      ],
    },
    {
      h2: `Other chocolate cookies on our menu`,
      blocks: [
        { kind: 'p', text: `If you would rather have single cookies, try the Double Choco Chip ({price:2}), a chocolate dough with twice the chips, or the ADC Special ({price:5}), our brownie-style cookie with a gooey centre. Our full range of tins is on the [cookie tins](/cookie-tins) page.` },
      ],
    },
  ],
  faqs: [
    { q: `Which chocolate cookie tin should I order?`, a: `Chocolate Chip ({price:${TIN.chocolateChip}}) for a classic taste most people like. Nutella ({price:${TIN.nutella}}) for someone who loves chocolate and hazelnut.` },
    { q: `Can I warm a cookie tin?`, a: `Warm one slice at a time on a plate, 8 to 10 seconds in the microwave. The tin is metal and must not go in the microwave.` },
    { q: `Can chocolate cookie tins be shipped?`, a: `Yes. Both go by courier to most PIN codes in India, and the same day in Bengaluru and Chennai.` },
    { q: `Are the chocolate cookie tins eggless?`, a: `Yes, both of them, like everything we bake.` },
  ],
  related: ['/cookie-tins', '/blog/keep-cookies-fresh-in-a-tin', '/blog/cookie-tins-for-gifts', '/blog/best-cookies-in-india'],
  cta: { title: 'Chocolate, in a tin', body: 'Same day in Bengaluru and Chennai, by courier across India.', label: 'Order a tin', href: '/order' },
};
