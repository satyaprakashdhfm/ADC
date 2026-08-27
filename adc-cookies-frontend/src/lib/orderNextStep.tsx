import { Info } from 'lucide-react';
import { shipStage, isCancelledStatus, isDeadShipment, formatMoney } from './orderFormat';

/**
 * A single source of truth for the "What happens next" line shown across the
 * order experience (account order tracker + post-payment success screen).
 *
 * Maps the current order signals -> ONE short, reassuring next-step sentence.
 * ADC is prepaid-only, so nothing moves until payment is done.
 *
 * The stage ladder comes from orderFormat's shipStage(). This file used to carry its own copy of
 * it, described as "mirrors AccountPage's shipStage()" — and then the two drifted, which is exactly
 * how a comment like that ends. orderFormat learned that "Not Picked" and "pickup not attempted"
 * mean the opposite of picked up; the copy here did not, so a cancelled Delhivery booking sitting
 * at "Not Picked — Shipment not received from client" told the customer it was on the move. Two
 * ladders that must agree should be one ladder.
 */

type NextStepSignals = {
  orderStatus?: string | null;   // PLACED -> CONFIRMED -> ... -> DELIVERED / CANCELLED
  shipmentStatus?: string | null; // carrier's own label (free text)
  /** What WE last recorded on the booking, as opposed to the freshest carrier scan. A carrier keeps
   *  answering for a cancelled waybill, so its latest scan must not be allowed to hide our cancel. */
  bookingStatus?: string | null;
  carrier?: string | null;        // 'SHIPROCKET' (intracity, same-day) | 'DELHIVERY' (outstation)
  paymentStatus?: string | null;  // PENDING -> PAID
  /** Set once a store has an order code but hasn't tapped Accept yet. Manual-POS stores don't book
   *  the same-day rider until they accept, so `carrier` is still null in this window — without this
   *  signal that read as generic "preparing" instead of "we're confirming this with the store". */
  hasStore?: boolean;
  storeAccepted?: boolean;
  /** How much has actually gone back, in rupees. Lets a cancelled order name the figure instead of
   *  saying "any payment", which is what it said when the API sent no number to say. */
  amountRefunded?: number;
  /** When the refund was raised, so the 5-7 working days can be counted from something real. */
  refundedAt?: string | null;
};

/** Baked and boxed, but nobody has collected it yet — the gap between our kitchen and the carrier. */
const isPacked = (s?: string | null) => /packed|ready for pickup|manifest/i.test(s || '');

/** "21 Aug" — short, because this sits inside a sentence. */
function shortDate(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function orderNextStep({ orderStatus, shipmentStatus, bookingStatus, carrier, paymentStatus, hasStore, storeAccepted, amountRefunded, refundedAt }: NextStepSignals): string {
  const os = (orderStatus || '').toUpperCase();
  const paid = (paymentStatus || '').toUpperCase() === 'PAID';
  const intracity = (carrier || '').toUpperCase() === 'SHIPROCKET';
  const delhivery = (carrier || '').toUpperCase() === 'DELHIVERY';
  const refunded = (amountRefunded ?? 0) > 0;

  // Terminal states first.
  if (os === 'CANCELLED' || isCancelledStatus(orderStatus) || isDeadShipment(shipmentStatus)) {
    /*
     * Name the amount when we know it.
     *
     * "Any payment is refunded to source" was all this could say while the API sent no refund
     * figure — vague on the one screen where somebody wants a number, and it left people asking
     * whether anything had happened at all. When a refund exists we say what went back and roughly
     * when their bank will show it; the banks, not us, are what the remaining wait is.
     */
    if (refunded) {
      const when = refundedAt ? ` on ${shortDate(refundedAt)}` : '';
      return `Cancelled. ${formatMoney(amountRefunded)} was refunded${when} — banks usually take 5-7 working days to show it.`;
    }
    return paid
      ? 'Cancelled. Your refund is on its way back to the account you paid from.'
      : 'This order was cancelled. Nothing was charged.';
  }

  const stage = Math.max(shipStage(shipmentStatus), shipStage(orderStatus));
  if (os === 'DELIVERED' || stage >= 3)
    return 'Delivered. We hope you love it! 🍪';

  // Prepaid-only: nothing is prepared or shipped until payment clears.
  if (!paid)
    return 'Complete payment to confirm your order.';

  /* The booking was pulled but the order itself is still live — someone is putting it on a
     different courier. Ranked above the stage ladder because the carrier will happily keep
     reporting scans against a waybill we have already cancelled. */
  if (isCancelledStatus(bookingStatus) || isCancelledStatus(shipmentStatus))
    return "We're re-arranging the courier for this order. Nothing to do at your end.";

  // Out for delivery.
  if (stage >= 2)
    return 'Your order is on the way. Keep your phone handy.';

  // Shipped / picked up / in transit.
  if (stage >= 1)
    return intracity
      ? 'On its way with a rider, arriving today. Keep your phone handy.'
      : "Handed to Delhivery and on the move. It'll arrive in a few days.";

  /* Packed is its own step, and it used to be missing. "Packed" fell through to "we're baking your
     order" (wrong — it is baked) or, worse, got read as stage 1 and became "on its way with a
     rider" while no rider had been assigned at all. It is the honest in-between: ours is done,
     the collection has not happened. */
  if (isPacked(orderStatus) || isPacked(shipmentStatus))
    return intracity
      ? 'Baked and packed. A rider is being assigned to collect it. Arriving today.'
      : "Packed and waiting for Delhivery to collect it. It'll arrive in a few days.";

  // Paid, assigned to a store, but that store hasn't tapped Accept yet — no rider is booked until
  // they do, so say that plainly rather than a generic "preparing" that implies it's already moving.
  if (hasStore && !storeAccepted && !carrier)
    return "We're confirming your order with the store. It'll start baking any moment.";

  // Paid & confirmed, still being made.
  if (intracity)
    return "We're baking your order. A rider will pick it up from our store and deliver today.";
  if (delhivery)
    return "We're packing your order. It'll be handed to Delhivery and arrive in a few days.";
  return "We're preparing your order. Tracking updates will appear here soon.";
}

/**
 * Soft, on-brand info banner that renders the next-step line. Pass the current
 * order signals; optional `style` merges onto the wrapper for per-placement tweaks.
 */
export function OrderNextStep({ style, ...signals }: NextStepSignals & { style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--amber-50)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '10px 13px', color: 'var(--text-body)', fontSize: 'var(--text-sm)', fontWeight: 700, lineHeight: 1.45, textAlign: 'left', ...style }}>
      <Info size={16} strokeWidth={2.4} style={{ color: 'var(--brand-secondary)', flex: 'none', marginTop: 1 }} />
      <span>{orderNextStep(signals)}</span>
    </div>
  );
}
