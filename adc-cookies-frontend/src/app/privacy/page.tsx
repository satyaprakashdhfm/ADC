import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/storefront/LegalPage';
import { COMPANY_NAME, SITE_EMAIL } from '@/lib/site';

/*
 * Not asked for alongside Terms and Refund, but linked from the footer beside them because a
 * payment provider's compliance check looks for all three, and because the site already collects
 * names, phone numbers, addresses and coordinates — a site that takes those and says nothing about
 * them is the actual problem, not the missing page.
 *
 * Written from what the code genuinely does rather than from a template: the third parties named
 * below are the ones this repo actually calls.
 */

export const metadata: Metadata = {
  title: `Privacy Policy | ${COMPANY_NAME} (a dough cookie)`,
  description: 'What information a dough cookie collects when you order, why we need it, and who we share it with.',
  alternates: { canonical: '/privacy' },
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    body: [
      'Only what an order needs:',
      [
        'Your name, email address and phone number, so we can identify the order and reach you about it.',
        'Your delivery address, including the PIN code, and its approximate map coordinates. The coordinates are what let us work out which shop is nearest and what delivery should cost.',
        'What you ordered, what you paid, and any gift message you wrote.',
        'Basic technical information your browser sends, and which pages you looked at.',
        'Which ad or website link brought you here, if one did, recorded with your order.',
      ],
      'We do not collect your card, UPI or bank details. Those go straight to our payment provider and never reach our servers.',
    ],
  },
  {
    heading: 'Why we need it',
    body: [
      'To bake and deliver your order, to let you see your order history, to answer you when you contact us, and to meet our own accounting and tax obligations.',
      'To send your order confirmation on WhatsApp, to the phone number on your account. If you are signed in and leave items in your basket, or a payment does not go through, we may send you one reminder there.',
      'To understand which of our adverts actually lead to orders, so we spend on the ones that work.',
      'We do not sell your information to anybody.',
    ],
  },
  {
    heading: 'Who else sees it',
    body: [
      'The companies that make an order actually happen, and the two that measure our advertising, each getting only the part it needs:',
      [
        'Our payment provider, to take the payment and process any refund.',
        'Our delivery partners, who receive the delivery name, address and phone number so a rider or courier can find you.',
        'The shop fulfilling your order, and its billing system.',
        'The services that host this website and our database, and the ones that send your order emails and WhatsApp messages.',
        'Meta (Facebook and Instagram) and Google, to measure our advertising. They see which pages you visit and what you add to your basket and buy. When you order, Meta also receives your email address and phone number in scrambled (hashed) form, so it can tell whether one of our adverts led to that order.',
      ],
      'That is the whole list. The payment, delivery and hosting companies are bound to use the information only for the job we gave them; Meta and Google handle what they receive under their own privacy policies.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Order records are kept as long as the law requires us to keep business and tax records. Your account details are kept until you ask us to delete them.',
    ],
  },
  {
    heading: 'Your choices',
    body: [
      'You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to delete your account. We may have to keep records of past orders even after an account is closed, because tax law requires it.',
      `Write to ${SITE_EMAIL} and we will act on it.`,
      'If you would rather not hear from us on WhatsApp, block our number there. Nothing more reaches you from us on WhatsApp after that.',
    ],
  },
  {
    heading: 'Cookies and local storage',
    body: [
      'This site stores a few things in your browser: your basket so it survives a refresh, your login session, and whether you have already seen certain pop-ups. Clearing your browser data clears all of it. While you are signed in, your basket is also saved to your account, so it is there when you sign in on another device. Empty the basket and the saved copy goes too.',
      "The Meta Pixel and Google Analytics also set their own cookies, which is how they measure our advertising as described above. You can block them with your browser's privacy settings or an ad blocker, and the site works exactly the same without them. Meta's own ad settings control which adverts it shows you.",
    ],
  },
  {
    heading: 'Children',
    body: [
      'This site is not aimed at children under 18, and we do not knowingly collect their information. If you believe a child has given us details, tell us and we will remove them.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'If this policy changes, the new version appears here with a new date at the top.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What we collect when you order, why we need it, and who else sees it. Short, because we collect little."
      updated="21 September 2026"
      sections={SECTIONS}
    />
  );
}
