import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/storefront/LegalPage';
import { COMPANY_NAME, SITE_EMAIL } from '@/lib/site';

/*
 * Written from scratch for this business rather than adapted from anyone else's terms. Another
 * company's legal text is their copyrighted work, it names their entity and their courts, and it
 * describes obligations we may not actually have — pasting it in would leave us claiming things
 * that are not true about us, which is worse than having no page.
 *
 * Everything here is deliberately narrow and checkable: we sell perishable food, prepaid only, in
 * cities we can reach. Where a real registration number or a firm commitment is needed, it is
 * marked in the handover notes rather than invented.
 */

export const metadata: Metadata = {
  title: `Terms of Service — ${COMPANY_NAME} (a dough cookie)`,
  description: `The terms that apply when you order from a dough cookie, operated by ${COMPANY_NAME}.`,
  alternates: { canonical: '/terms' },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who these terms are between',
    body: [
      `This website and the a dough cookie brand are operated by ${COMPANY_NAME} ("we", "us"). By browsing this site, creating an account or placing an order, you agree to these terms.`,
      'If you do not agree with them, please do not place an order. We would rather you asked us a question first — our contact details are at the bottom of this page.',
    ],
  },
  {
    heading: 'Who can order',
    body: [
      'You need to be 18 or older to place an order yourself. If you are younger than that, a parent or guardian can order on your behalf.',
      'You are responsible for what happens under your account, including keeping your login details to yourself. Tell us straight away if you think somebody else has access to it.',
    ],
  },
  {
    heading: 'Your account and the details you give us',
    body: [
      'To deliver an order we need a name, a delivery address with a valid PIN code, and a working phone number. Our couriers cannot create a shipment without a phone number, so an order placed without one cannot ship.',
      'Please make sure those details are right before you pay. If a delivery fails because the address or phone number was wrong, we may not be able to re-send the order free of charge.',
      'We may suspend or close an account if the details given are false, or if it is being used in a way that breaks these terms or the law.',
    ],
  },
  {
    heading: 'Prices, and what you are charged',
    body: [
      'Prices on this site are in Indian Rupees and include GST. The price you see at checkout is the price you pay for that order.',
      'Prices and the menu can change without notice, and an item can sell out during the day. Our kitchens bake in small batches, so availability genuinely does move.',
      'Delivery is charged separately and is worked out from your delivery address and the shop the order will be sent from. The fee and the expected arrival are both shown before you pay.',
      'Every order total is recalculated on our own servers when the order is created. If what your browser shows and what we calculate ever disagree, our figure is the one charged — this protects you as much as us.',
    ],
  },
  {
    heading: 'Payment',
    body: [
      'We take payment online only, through our payment provider, before an order is confirmed. We do not offer cash on delivery.',
      'We never see or store your card, UPI or bank details. Those go directly to the payment provider.',
      'An order is only confirmed once payment has actually succeeded. If you close the payment window or the payment fails, the order is cancelled and nothing is charged. If money left your account but you did not get a confirmation, contact us with the order number and we will trace it.',
    ],
  },
  {
    heading: 'Delivery',
    body: [
      'Inside the cities where we have shops, orders are sent same-day from whichever shop is nearest your address, and usually arrive within about an hour.',
      'Elsewhere in India, orders go by courier and take longer. The expected date is shown at checkout.',
      'Some items are only sold for same-day delivery inside our shop cities, because they keep for less than a day. Those items are marked at checkout and cannot be sent by courier, whatever the address.',
      'Delivery times are our honest estimate, not a guarantee. Weather, traffic and courier delays happen. If an order is running badly late, tell us.',
    ],
  },
  {
    heading: 'Cancellations and refunds',
    body: [
      'We bake to order, so an order cannot be cancelled once it is placed. If something is wrong with what arrives, we will put it right — our Refund Policy sets out how.',
    ],
  },
  {
    heading: 'Allergens and food safety',
    body: [
      'Our cookies are made in a kitchen that handles wheat, milk, eggs, soy and nuts, including tree nuts and peanuts. We cannot guarantee that any item is free from traces of these, even where a recipe does not use them.',
      'If you have a food allergy, please check with us before ordering. Our gluten-free item is made without wheat flour, but is baked in the same kitchen.',
      'Our food is best eaten fresh, on the day it reaches you. Storage guidance is on the product pages.',
    ],
  },
  {
    heading: 'Using this website',
    body: [
      'You are welcome to browse the site, order from it, and share links to it. What you may not do:',
      [
        'Copy, republish or resell our photographs, text, recipes, branding or page designs without written permission.',
        'Scrape the site, or use bots or automated tools to collect our prices, listings or customer information.',
        'Try to access parts of the site or other people’s accounts that are not yours.',
        'Use the site to post or send anything unlawful, abusive, misleading or harmful.',
        'Interfere with the running of the site or the systems behind it.',
      ],
      'Everything on this site — the name, logo, photographs, wording and design — belongs to us or is used with permission.',
    ],
  },
  {
    heading: 'When things go wrong',
    body: [
      'We take responsibility for the orders we bake and send. Where the law allows, our liability for any order is limited to what you paid for it.',
      'We are not responsible for things genuinely outside our control, such as a courier strike, a natural event, or a failure of a payment provider or network.',
      'Nothing here removes any right you have under Indian consumer law.',
    ],
  },
  {
    heading: 'Changes to these terms',
    body: [
      'We may update these terms. The version on this page is always the current one, and the date at the top tells you when it last changed. The terms that apply to an order are the ones published when you placed it.',
    ],
  },
  {
    heading: 'Questions',
    body: [
      `These terms follow Indian law. If any part of them turns out not to hold, the rest still does.`,
      `If something here is unclear, or you think we have got something wrong, write to ${SITE_EMAIL}. We would far rather sort it out directly than have anyone reading this wondering what it means.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The agreement between you and us when you order cookies from this site. Written to be read, not to be skipped."
      updated="12 August 2026"
      sections={SECTIONS}
    />
  );
}
