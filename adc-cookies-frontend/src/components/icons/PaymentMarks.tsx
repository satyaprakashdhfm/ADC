import Image from 'next/image';

/**
 * The payment methods we actually take, as small chips along the footer's baseline.
 *
 * These are the real brand marks now. They were previously redrawn as inline SVG — approximations
 * with the letters set in whatever sans-serif the device had — on the reasoning that a raster at
 * 24px would be heavier and blurrier. That held for the shapes and not for the wordmarks: VISA and
 * RuPay are typefaces, and an approximation of a typeface is just the wrong logo, which for a
 * payment network is the one thing it must not be.
 *
 * Each source PNG was trimmed to its content and normalised to a common height, so the chips line
 * up on their logos rather than on whatever padding each download happened to carry. They keep
 * their natural widths from there — RuPay's wordmark is nearly twice as wide as it is tall and
 * forcing it into a square box would squash it.
 *
 * White chips because all three marks are dark-on-transparent and the footer is not.
 *
 * Only what Razorpay is confirmed to take on this account. Mastercard, Amex, Diners and Maestro are
 * a one-line addition once someone drops the artwork in `public/assets/payments/` — but a card logo
 * in a footer is a promise, and a customer who picks a card that then fails at checkout was misled
 * by it, so nothing goes here on the assumption that it probably works.
 */

const MARKS = [
  { src: '/assets/payments/upi.png', alt: 'UPI', w: 120, h: 72 },
  { src: '/assets/payments/visa.png', alt: 'Visa', w: 116, h: 72 },
  { src: '/assets/payments/rupay.png', alt: 'RuPay', w: 270, h: 72 },
] as const;

const CHIP_H = 30;   // chip height in px; the logo sits inside with a little air around it
const LOGO_H = 19;

export default function PaymentMarks() {
  return (
    <div
      aria-label="Payment methods we accept"
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      {MARKS.map((m) => (
        <span
          key={m.alt}
          title={m.alt}
          style={{
            height: CHIP_H,
            padding: '0 9px',
            borderRadius: 5,
            background: 'var(--white)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
            boxShadow: '0 1px 3px var(--black-18)',
          }}
        >
          <Image
            src={m.src}
            alt={m.alt}
            width={m.w}
            height={m.h}
            // Height is what makes the row read as one line; width follows the logo's own ratio.
            style={{ height: LOGO_H, width: 'auto' }}
          />
        </span>
      ))}
    </div>
  );
}
