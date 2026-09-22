import type { SeoPageContent } from '../types';

/* Supporting article: "cookie storage tins", "keeping cookies fresh in tins", "airtight cookie tins".
   Few searches, but it answers the question every tin buyer has and links back to the tins. */
export const keepCookiesFresh: SeoPageContent = {
  path: '/blog/keep-cookies-fresh-in-a-tin',
  kind: 'article',
  title: `How to Keep Cookies Fresh in a Tin | a dough cookie`,
  description: `How to store cookies in a tin so they stay fresh: where to keep it, how long cookies last, how to warm a slice, and what to do with a filled cookie.`,
  h1: `How to keep cookies fresh in a tin`,
  name: `Keeping cookies fresh in a tin`,
  excerpt: `Where to keep the tin, how long each kind of cookie lasts, and how to warm a slice so it tastes just baked.`,
  hero: {
    src: '/assets/seo/keep-cookies-fresh-in-a-tin.jpg',
    alt: `Nutella cookie tin with its lid off, next to a jar of Nutella and hazelnuts`,
    width: 1280,
    height: 720,
  },
  ogImage: '/assets/seo/og/keep-cookies-fresh-in-a-tin.jpg',
  published: '2026-09-22',
  updated: '2026-09-22',
  intro: [
    `A cookie goes stale in one of two ways. A soft cookie dries out and turns hard, and a crisp one takes in moisture from the air and goes limp. A closed tin slows both down.`,
    `This is how we tell customers to store our cookie tins, and most of it works for cookies from anywhere.`,
  ],
  sections: [
    {
      h2: `Keep the lid on`,
      blocks: [
        { kind: 'p', text: `Air is what changes a cookie, so close the tin after every slice. A tin with a tight lid does most of the work for you.` },
      ],
    },
    {
      h2: `Where to keep the tin`,
      blocks: [
        { kind: 'p', text: `Somewhere cool and dry. A cupboard away from the stove and the window is right; the top of the fridge is warm, so it is not. In a Chennai monsoon or a Bengaluru summer, pick the coolest cupboard in the house.` },
      ],
    },
    {
      h2: `Should cookies go in the fridge?`,
      blocks: [
        { kind: 'p', text: `Plain cookies, no. The fridge dries them out, and they pick up smells from the food around them.` },
        { kind: 'p', text: `A cookie with a cream cheese layer, like our Red Velvet, is the exception. Eat it within 24 hours of baking, and if it has to wait a few hours on a hot day, the fridge is the safer place for it.` },
      ],
    },
    {
      h2: `How long cookies last in a tin`,
      blocks: [
        {
          kind: 'list',
          items: [
            `Our Nutella and Biscoff tins: up to two days with the lid on.`,
            `Our Red Velvet tin: the same day, because of the cream cheese.`,
            `Plain cookies from a home oven: a few days in a closed tin.`,
            `Packaged biscuits once opened: they go soft within days unless the packet is sealed again or tipped into a tin.`,
          ],
        },
      ],
    },
    {
      h2: `Keep soft and crisp cookies apart`,
      blocks: [
        { kind: 'p', text: `A soft cookie gives off moisture and a crisp one soaks it up, so if you store them together, both end up somewhere in between. Use separate tins, or eat the crisp ones first.` },
      ],
    },
    {
      h2: `Bringing a cookie back to life`,
      blocks: [
        { kind: 'p', text: `Take a slice or a cookie out of the tin and warm it on a plate for 8 to 10 seconds in the microwave. Never put the tin itself in the microwave; it is metal.` },
        { kind: 'p', text: `For cookies that have gone hard, there is an old trick: put a slice of bread in the closed tin overnight. The cookies take moisture from the bread and soften. Take the bread out the next day.` },
      ],
    },
    {
      h2: `What to do with the empty tin`,
      blocks: [
        { kind: 'p', text: `Wash it in warm soapy water and dry it completely before you store anything in it, because a damp tin can rust. After that it will hold spices, buttons or letters, or the next batch of cookies.` },
        { kind: 'p', text: `Need a new one to fill? Our [cookie tins](/cookie-tins) come in four flavours, and in Bangalore they are [delivered the same day](/cookie-tins-in-bangalore).` },
      ],
    },
  ],
  faqs: [
    { q: `How long do cookies stay fresh in a tin?`, a: `Our Nutella and Biscoff tins keep for up to two days with the lid on, and the Red Velvet tin should be eaten the same day. Plain home-baked cookies usually last a few days in a closed tin.` },
    { q: `Should I keep a cookie tin in the fridge?`, a: `Not for plain cookies, which dry out there. Cookies with a cream cheese filling are the exception if they have to wait a few hours on a hot day.` },
    { q: `How do I warm a cookie from the tin?`, a: `Take it out of the tin and microwave it on a plate for 8 to 10 seconds. Do not put the metal tin in the microwave.` },
    { q: `How do I soften cookies that have gone hard?`, a: `Put a slice of bread in the closed tin overnight and take it out the next day. The cookies take up moisture from the bread.` },
  ],
  related: ['/cookie-tins', '/blog/chocolate-cookie-tins', '/blog/cookie-tins-for-gifts', '/cookie-tins-in-bangalore'],
  cta: { title: 'Need a fresh tin?', body: 'Ours arrive the same day in Bengaluru and Chennai.', label: 'Order a cookie tin', href: '/order' },
};
