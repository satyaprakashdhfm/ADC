import Image from 'next/image';

/**
 * The payment methods we actually take, as small chips along the footer's baseline.
 *
 * Three of the four are the real brand artwork. They used to be redrawn as inline SVG, on the
 * reasoning that a raster at this size would be heavier and blurrier than a few shapes. That holds
 * for shapes and not for wordmarks: VISA and RuPay are typefaces, and the redrawn versions set them
 * in whatever sans-serif the device happened to have. An approximation of a typeface is simply the
 * wrong logo, which for a payment network is the one thing it must not be.
 *
 * Mastercard stays drawn, and legitimately so — it IS two overlapping circles, with no lettering to
 * get wrong, so the shapes are the mark rather than an impression of it. It also stays sharp at any
 * size and costs no download.
 *
 * The source PNGs were trimmed to their content and normalised to a common height, so the chips
 * line up on the logos rather than on whatever padding each download happened to carry. Widths stay
 * natural from there — RuPay's wordmark is close to four times as wide as it is tall, and a square
 * box would squash it. Every chip is the same height and the artwork inside is the same height, so
 * the row reads as one band whatever each logo's proportions are.
 *
 * White chips because the marks are dark and the footer is not.
 *
 * Only what Razorpay is confirmed to take on this account. Amex, Diners and Maestro are a one-line
 * addition once someone drops artwork into `public/assets/payments/` — but a card logo in a footer
 * is a promise, and a customer who picks a card that then fails at checkout was misled by it, so
 * nothing goes here on the assumption that it probably works.
 */

const CHIP_H = 30;   // every chip is this tall, so the row sits on one line
const LOGO_H = 19;   // and every mark inside is this tall, whatever its width works out to

const chip: React.CSSProperties = {
  height: CHIP_H,
  padding: '0 9px',
  borderRadius: 5,
  background: 'var(--white)',
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  boxShadow: '0 1px 3px var(--black-18)',
};

const IMAGE_MARKS = [
  { src: '/assets/payments/upi.png', alt: 'UPI', w: 120, h: 72 },
  { src: '/assets/payments/visa.png', alt: 'Visa', w: 116, h: 72 },
] as const;

const RUPAY = { src: '/assets/payments/rupay.png', alt: 'RuPay', w: 270, h: 72 } as const;

function ImageMark({ src, alt, w, h }: { src: string; alt: string; w: number; h: number }) {
  return (
    <span style={chip} title={alt}>
      {/* Height is what makes the row read as one band; width follows the logo's own ratio. */}
      <Image src={src} alt={alt} width={w} height={h} style={{ height: LOGO_H, width: 'auto' }} />
    </span>
  );
}

function Mastercard() {
  // Drawn at the same height as the artwork in its neighbours so the row stays even. The darker
  // orange lens is the brand's own overlap colour, not a blend.
  const w = Math.round(LOGO_H * 1.7);
  return (
    <span style={chip} title="Mastercard">
      <svg width={w} height={LOGO_H} viewBox="0 0 34 20" aria-hidden focusable="false">
        <circle cx="13.5" cy="10" r="6.4" fill="#EB001B" />
        <circle cx="20.5" cy="10" r="6.4" fill="#F79E1B" />
        <path d="M17 5.1a6.4 6.4 0 0 0 0 9.8 6.4 6.4 0 0 0 0-9.8Z" fill="#FF5F00" />
      </svg>
    </span>
  );
}

export default function PaymentMarks() {
  return (
    <div
      aria-label="Payment methods we accept"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      {IMAGE_MARKS.map((m) => <ImageMark key={m.alt} {...m} />)}
      <Mastercard />
      <ImageMark {...RUPAY} />
    </div>
  );
}
