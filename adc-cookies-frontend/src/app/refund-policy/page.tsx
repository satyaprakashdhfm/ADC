import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/storefront/LegalPage';
import { COMPANY_NAME, SITE_EMAIL, SITE_PHONE } from '@/lib/site';

/*
 * Freshly baked food is not a returnable good, and a refund policy copied from a subscription
 * business does not describe it — "cancel 3 business days before the next service period" means
 * nothing to somebody whose cookies arrived crushed this afternoon. So this is written around the
 * two things that actually happen here: an order cancelled before it is baked, and an order that
 * turned up wrong.
 *
 * The timings below are the sensible defaults for a same-day food business and are marked in the
 * handover notes as needing confirmation before this is treated as final.
 */

export const metadata: Metadata = {
  title: `Refund & Cancellation Policy | ${COMPANY_NAME} (a dough cookie)`,
  description: 'How cancellations and refunds work at a dough cookie: when you can cancel, when we refund, and how long it takes.',
  alternates: { canonical: '/refund-policy' },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'The short version',
    body: [
      'If something is wrong with your order, tell us and we will put it right with a replacement or a refund. We would rather fix it than argue about it.',
      'What we cannot do is take back food that is fine. Everything is baked to order and it is perishable, so an unwanted cookie cannot be resold.',
    ],
  },
  {
    heading: 'Orders cannot be cancelled once placed',
    body: [
      'We start baking the moment an order is confirmed. It is made for you, to order, and it will not keep, so once an order is placed it cannot be cancelled or changed.',
      'Please check your basket, your address and your phone number before you pay.',
      'If you close the payment window, or the payment fails, no order is placed and nothing is charged. There is nothing to cancel in that case.',
      'This does not affect your right to a refund if something is actually wrong with the order. That is the next section, and it is where almost every real problem belongs.',
    ],
  },
  {
    heading: 'When we will refund you',
    body: [
      'We will refund, or resend the order, in any of these cases:',
      [
        'The order arrived damaged, spoiled, or clearly not in a state you would want to eat.',
        'The wrong items arrived, or items were missing.',
        'The order never arrived.',
        'We cancelled it ourselves, because an item ran out, a kitchen could not bake it, or we could not reach your address.',
      ],
      'Please tell us within 24 hours of delivery, and send a photograph if something arrived damaged or wrong. With food that keeps for a day, a photograph on the day is the only way either of us can tell what actually happened.',
      'Whether you get a replacement or your money back is your choice, not ours.',
    ],
  },
  {
    heading: 'When we will not refund',
    body: [
      [
        'You changed your mind, or no longer want an order that was baked correctly.',
        'The delivery failed because the address or phone number given was wrong, or nobody was there to receive it.',
        'A taste preference. A flavour you did not enjoy is not the same as an order that was wrong.',
        'A claim made more than 24 hours after delivery, where we have no way left to check what happened.',
      ],
      'If you think we have got this wrong in your case, write to us anyway. These are guidelines, and a real person reads them.',
    ],
  },
  {
    heading: 'How a refund is paid',
    body: [
      'Refunds always go back to the account you paid from, through our payment provider. We cannot pay a refund to a different account, in cash, or as store credit unless you ask for credit instead.',
      'Once we approve a refund we raise it the same working day. Your bank then takes its own time, usually 5 to 7 working days for the money to appear, depending on the bank and the payment method.',
      'Delivery charges are refunded along with the order when the fault was ours.',
    ],
  },
  {
    heading: 'How to raise it',
    body: [
      `Email ${SITE_EMAIL} or call ${SITE_PHONE} with your order number, what went wrong, and a photograph if there is one to take.`,
      'We aim to reply within one working day, and to settle a refund claim within three.',
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro="What happens if you need to cancel, or if an order arrives wrong. We bake fresh to order, which shapes most of what follows."
      updated="12 August 2026"
      sections={SECTIONS}
    />
  );
}
