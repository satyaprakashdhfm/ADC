import type { SeoPageContent } from '../types';
import { TIN, EIGHT_PACK } from '../menu';

/* The festival article. The keyword ("ganesh chaturthi gifts") was not in the planner export, so
   its volume is still to be checked. Written without a year so it serves every Ganesh Chaturthi. */
export const ganeshChaturthi: SeoPageContent = {
  path: '/blog/ganesh-chaturthi-cookie-gifts',
  kind: 'article',
  title: `Ganesh Chaturthi Gifts: Eggless Cookie Tins | a dough cookie`,
  description: `Ganesh Chaturthi gift ideas for family, neighbours and the office: eggless cookie tins, same day in Bengaluru and Chennai, and by courier across India.`,
  h1: `Ganesh Chaturthi gifts: eggless cookie tins for family visits`,
  name: `Ganesh Chaturthi cookie gifts`,
  excerpt: `Eggless cookie tins and boxes to carry on festival visits, or to send to family in another city.`,
  hero: {
    src: '/assets/seo/ganesh-chaturthi-cookie-gifts.jpg',
    alt: `Cookies set out with fairy lights and a small brass stand for a festival`,
    width: 1091,
    height: 614,
  },
  ogImage: '/assets/seo/og/ganesh-chaturthi-cookie-gifts.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `Ganesh Chaturthi falls in the month of Bhadrapada, in August or September, and the celebrations run for up to ten days before the visarjan on Anant Chaturdashi. In Karnataka the festival starts a day earlier with Gowri Habba. The days in between are full of visits to family, and to friends who have brought an idol home.`,
    `Modak, said to be Ganesha's favourite sweet, belongs on the puja plate. A cookie tin is for everything around it: something to carry when you visit, or to send to family you cannot visit this year.`,
  ],
  answer: {
    title: `In short`,
    text: `Every cookie we bake is eggless, and our kitchens do not use eggs. Order in the morning for same-day delivery in Bengaluru or Chennai, or send the Chocolate Chip, Nutella or Biscoff tin by courier to another city a few days ahead.`,
  },
  sections: [
    {
      h2: `Why eggless matters during the festival`,
      blocks: [
        { kind: 'p', text: `Many families keep their kitchen vegetarian through the festival days. Every cookie at A Dough Cookie is eggless and our kitchens are kept egg-free, so a tin from us can go into any home you visit.` },
        { kind: 'p', text: `If you plan to offer the cookies as naivedya at the puja itself, ask us for the full ingredient list first. Call +91 88616 57617 or message us on [WhatsApp](https://wa.me/918861657617).` },
      ],
    },
    {
      h2: `Gift ideas for Ganesh Chaturthi`,
      blocks: [
        { kind: 'h3', text: `For a family visit` },
        { kind: 'p', text: `One cookie tin, sliced and ready to share with whoever is in the house. The Nutella ({price:${TIN.nutella}}) and Biscoff ({price:${TIN.biscoff}}) tins are the richest of our four, and the Chocolate Chip tin ({price:${TIN.chocolateChip}}) suits a house with children.` },
        { kind: 'h3', text: `For pandal volunteers or your housing society` },
        { kind: 'p', text: `A box of eight cookies ({price:${EIGHT_PACK}}), picked from the whole menu, is easy to pass around a group. It is made for same-day delivery in Bengaluru and Chennai. If you need several boxes, ask for a quote through our [gift hampers and boxes](/cookie-gift-hampers) page.` },
        { kind: 'h3', text: `For family in another city` },
        { kind: 'p', text: `The Chocolate Chip, Nutella and Biscoff tins travel by courier to most of India. Order a few days before you want it to arrive; checkout shows the expected delivery date for their PIN code.` },
        { kind: 'h3', text: `For the office` },
        { kind: 'p', text: `If your team celebrates at work, [corporate gifting](/corporate) can put your company's logo on the sleeves and deliver every box on the same day.` },
        { kind: 'tins', ids: [TIN.nutella, TIN.biscoff, TIN.chocolateChip, TIN.redVelvet] },
      ],
    },
    {
      h2: `Ordering during the festival`,
      blocks: [
        { kind: 'p', text: `Same-day delivery in Bengaluru and Chennai is confirmed at checkout for your address before you pay. If it cannot be confirmed, the order is not taken. Orders placed late in the evening go out on the next baking day, so order in the morning for an evening visit.` },
        { kind: 'p', text: `To add a festival greeting, turn on "Send this as a gift" at checkout. You get gift wrap and a handwritten card with your message.` },
        { kind: 'buttons', primary: { label: 'See festive gift hampers', href: '/cookie-gift-hampers' }, secondary: { label: 'Order a cookie tin', href: '/order' } },
      ],
    },
    {
      h2: `After Ganesh Chaturthi`,
      blocks: [
        { kind: 'p', text: `Diwali is the next big gifting season. The same tins work for Diwali visits, and our [gift hampers and boxes](/cookie-gift-hampers) cover larger family and office orders.` },
      ],
    },
  ],
  faqs: [
    { q: `Are your cookies eggless?`, a: `Yes. Every cookie we bake is eggless, and our kitchens do not use eggs.` },
    { q: `Can I get cookie tins delivered on Ganesh Chaturthi?`, a: `In Bengaluru and Chennai, yes, the same day from our nearest shop, once checkout confirms delivery to your address. Orders placed late in the evening go out the next baking day.` },
    { q: `Can I send a Ganesh Chaturthi gift to another city?`, a: `Yes. The Chocolate Chip, Nutella and Biscoff tins go by courier to most PIN codes in India. Order a few days ahead; checkout shows the expected delivery date.` },
    { q: `Can I order cookies in bulk for a pandal or housing society?`, a: `Yes. Send your numbers and the date through the enquiry form on our [corporate gifting page](/corporate) and we will reply with a quote within one working day.` },
  ],
  related: ['/cookie-gift-hampers', '/blog/cookie-tins-for-gifts', '/cookie-tins', '/corporate'],
  cta: { title: 'A festival tin, delivered today', body: 'Eggless cookie tins, same day in Bengaluru and Chennai.', label: 'Order now', href: '/order' },
};
