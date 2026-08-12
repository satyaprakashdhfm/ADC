/**
 * The payment methods we actually take, as small chips along the footer's baseline.
 *
 * Drawn here rather than shipped as brand PNGs: at 24px tall a raster of each card logo is both
 * heavier and blurrier than a few shapes, and the set changes whenever the gateway does.
 *
 * Deliberately limited to what Razorpay is definitely configured for on this account — UPI, Visa,
 * Mastercard, RuPay. Amex, Diners and Maestro are easy to add below, but they should only appear
 * once someone has confirmed they are enabled: a card logo in the footer is a promise, and a
 * customer who picks a card that then fails at checkout has been misled by it.
 */
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const chip: React.CSSProperties = {
  width: 40, height: 26, borderRadius: 5, background: 'var(--white)',
  display: 'grid', placeItems: 'center', flex: 'none',
  boxShadow: '0 1px 3px var(--black-18)',
};

function Visa() {
  return (
    <span style={chip} title="Visa">
      <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden focusable="false">
        <text x="15" y="9.6" textAnchor="middle" fontFamily={FONT} fontSize="10.5"
          fontWeight="800" fontStyle="italic" letterSpacing="0.4" fill="#1A1F71">VISA</text>
      </svg>
    </span>
  );
}

function Mastercard() {
  return (
    <span style={chip} title="Mastercard">
      <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden focusable="false">
        <circle cx="13.5" cy="10" r="6.4" fill="#EB001B" />
        <circle cx="20.5" cy="10" r="6.4" fill="#F79E1B" />
        {/* The lens where the two discs overlap — the darker orange is the brand's own overlap colour. */}
        <path d="M17 5.1a6.4 6.4 0 0 0 0 9.8 6.4 6.4 0 0 0 0-9.8Z" fill="#FF5F00" />
      </svg>
    </span>
  );
}

function RuPay() {
  return (
    <span style={chip} title="RuPay">
      <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden focusable="false">
        <text x="17" y="9.4" textAnchor="middle" fontFamily={FONT} fontSize="9.5" fontWeight="800">
          <tspan fill="#F26522">Ru</tspan><tspan fill="#0B4EA2">Pay</tspan>
        </text>
      </svg>
    </span>
  );
}

function Upi() {
  return (
    <span style={chip} title="UPI">
      <svg width="34" height="14" viewBox="0 0 34 14" aria-hidden focusable="false">
        {/* The two chevrons of the UPI mark, then the letters — recognisable at this size without
            pretending to be a pixel-exact reproduction of the official logo. */}
        <path d="M4 2.5h3.1L4.9 11.5H1.8L4 2.5Z" fill="#0E7C3A" />
        <path d="M7.4 2.5h3.1L8.3 11.5H5.2L7.4 2.5Z" fill="#F26522" />
        <text x="23" y="10" textAnchor="middle" fontFamily={FONT} fontSize="8.6"
          fontWeight="800" letterSpacing="0.5" fill="#1A1F71">UPI</text>
      </svg>
    </span>
  );
}

export default function PaymentMarks() {
  return (
    <div
      aria-label="Payment methods we accept"
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      <Upi />
      <Visa />
      <Mastercard />
      <RuPay />
    </div>
  );
}
