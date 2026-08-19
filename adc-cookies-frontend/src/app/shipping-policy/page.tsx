import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/storefront/LegalPage';
import { COMPANY_NAME, SITE_EMAIL, SITE_PHONE } from '@/lib/site';

/*
 * Describes what the code actually does, not a generic shipping template: orders route to the
 * nearest shop by real distance (see stores.js / delivery.js), same-day inside a store zone is
 * quoted live by the hyperlocal carrier and refused rather than downgraded when it cannot be
 * confirmed, and short-life items are blocked from courier entirely. A policy that promised
 * anything looser than that would be describing a different shop.
 */

export const metadata: Metadata = {
  title: `Shipping & Delivery Policy | ${COMPANY_NAME} (a dough cookie)`,
  description: 'How a dough cookie delivers: same-day from the nearest shop inside our cities, courier elsewhere in India, and what each costs.',
  alternates: { canonical: '/shipping-policy' },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Where we deliver',
    body: [
      'We deliver across Bengaluru and Chennai from our own shops, and to most other PIN codes in India by courier.',
      'Enter your address at checkout and the site will tell you straight away whether we can reach it, how it will travel, and when it should arrive, before you pay for anything.',
    ],
  },
  {
    heading: 'Same-day delivery in our cities',
    body: [
      'If your address is in a city where we have a shop, the order is sent from whichever shop is actually nearest you, not from one central kitchen. That short trip is what lets a cookie arrive warm.',
      'These orders usually reach you within about an hour of being baked.',
      'We only make that promise once our delivery partner has confirmed it for your specific address. If they cannot, we say so and the order is not accepted. We will not quietly turn a same-day order into a three-day parcel.',
    ],
  },
  {
    heading: 'Delivery elsewhere in India',
    body: [
      'Orders outside our shop cities travel by courier. The expected delivery date is shown at checkout and comes from the courier, based on your PIN code.',
      'Some items are never sent this way. Anything with a shelf life shorter than a day, such as our filled Red Velvet cookies, is sold for same-day delivery inside our cities only. Those items are marked at checkout and cannot be added to a courier order, whatever the address.',
    ],
  },
  {
    heading: 'What delivery costs',
    body: [
      'Same-day delivery is priced by the real distance from the shop that will dispatch your order. The fee and the distance are both shown on the bill before you pay.',
      'Courier delivery to the rest of India is a flat fee, also shown before you pay.',
      'There are no charges added after checkout. The total you approve is the total you are charged.',
    ],
  },
  {
    heading: 'Timing, honestly',
    body: [
      'Delivery times are our best estimate, not a guarantee. Traffic, weather, and courier delays are real and we do not control them.',
      'We bake and dispatch during shop hours. An order placed late in the evening goes out the next baking day.',
      'If an order is running badly late, contact us. Do not wait for it to sort itself out.',
    ],
  },
  {
    heading: 'Getting your order to you',
    body: [
      'We need a delivery address with a valid PIN code and a working phone number. Our couriers cannot create a shipment without a phone number, so an order without one cannot ship.',
      'The rider or courier will call the number on the order. If nobody can be reached and the delivery fails, we may not be able to send it again free of charge, as the food will not have kept.',
      'You will get an order confirmation by email, and tracking where the courier provides it.',
    ],
  },
  {
    heading: 'Something wrong with a delivery?',
    body: [
      `Email ${SITE_EMAIL} or call ${SITE_PHONE} with your order number. If an order arrives damaged, wrong, or does not arrive at all, our Refund Policy covers what happens next.`,
    ],
  },
];

export default function ShippingPolicyPage() {
  return (
    <LegalPage
      title="Shipping & Delivery Policy"
      intro="How your order gets to you: same-day from the nearest shop in our cities, by courier elsewhere, and what each of those costs."
      updated="12 August 2026"
      sections={SECTIONS}
    />
  );
}
