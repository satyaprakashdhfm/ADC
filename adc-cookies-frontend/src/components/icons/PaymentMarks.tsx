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

/*
 * Every chip is the same card, and each mark is fitted inside it — rather than each chip taking the
 * width its own logo happened to want. Ragged widths made the row look like four things collected
 * from four places; a fixed card is what makes it read as a set, and it is what every checkout
 * footer worth copying does.
 *
 * The trade is that a wide wordmark ends up shorter than a compact one: RuPay is nearly four times
 * as wide as it is tall, so fitting it by width leaves it around half the height of the Mastercard
 * circles. That is correct — the alternative is either cropping the mark or letting one chip run
 * twice the width of its neighbours.
 */
const CHIP_W = 54;
const CHIP_H = 32;
const PAD = 6;                       // breathing room inside the card
const FIT_W = CHIP_W - PAD * 2;      // usable box the artwork is contained within
const FIT_H = CHIP_H - PAD * 2;

const chip: React.CSSProperties = {
  width: CHIP_W,
  height: CHIP_H,
  borderRadius: 6,
  // Vanilla, not white. Against the orange footer a pure-white block reads as something pasted on
  // top of the page; this is the same warm card colour used across the rest of the site, and the
  // marks are all dark enough to sit on it comfortably.
  background: 'var(--vanilla)',
  border: '1px solid var(--cream-200)',
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  boxShadow: '0 1px 3px var(--black-18)',
};

const fit: React.CSSProperties = { maxWidth: FIT_W, maxHeight: FIT_H, width: 'auto', height: 'auto', objectFit: 'contain' };

const IMAGE_MARKS = [
  { src: '/assets/payments/upi.png', alt: 'UPI', w: 120, h: 72 },
  { src: '/assets/payments/visa.png', alt: 'Visa', w: 116, h: 72 },
] as const;

const RUPAY = { src: '/assets/payments/rupay.png', alt: 'RuPay', w: 270, h: 72 } as const;

function ImageMark({ src, alt, w, h }: { src: string; alt: string; w: number; h: number }) {
  return (
    <span style={chip} title={alt}>
      {/* Contained, not sized: whichever of the two limits the logo's own ratio hits first wins. */}
      <Image src={src} alt={alt} width={w} height={h} style={fit} />
    </span>
  );
}

function Mastercard() {
  // The mark is 1.7:1, so it fits by height like the other compact logos. The darker orange lens is
  // the brand's own overlap colour, not a blend of the two discs.
  return (
    <span style={chip} title="Mastercard">
      <svg width={Math.round(FIT_H * 1.7)} height={FIT_H} viewBox="0 0 34 20" style={fit} aria-hidden focusable="false">
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
