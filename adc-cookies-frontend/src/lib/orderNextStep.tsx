import { Info } from 'lucide-react';

/**
 * A single source of truth for the "What happens next" line shown across the
 * order experience (account order tracker + post-payment success screen).
 *
 * Maps the current order signals -> ONE short, reassuring next-step sentence.
 * ADC is prepaid-only, so nothing moves until payment is done.
 */

type NextStepSignals = {
  orderStatus?: string | null;   // PLACED -> CONFIRMED -> ... -> DELIVERED / CANCELLED
  shipmentStatus?: string | null; // carrier's own label (free text)
  carrier?: string | null;        // 'SHADOWFAX' (intracity, same-day) | 'DELHIVERY' (outstation)
  paymentStatus?: string | null;  // PENDING -> PAID
};

const isCancelled = (s?: string | null) => /cancel|\brto\b|returned|lost/i.test(s || '');

// Which fixed milestone (0 placed .. 3 delivered) a free-text status has reached.
// Mirrors AccountPage's shipStage() so the copy tracks the visible timeline.
function stageOf(s?: string | null): number {
  const t = (s || '').toLowerCase();
  if (!t) return -1;
  if ((t.includes('deliver') && !t.includes('out for') && !t.includes('attempt') && !t.includes('undeliver')) || t.includes('rts_d')) return 3;
  if (t.includes('out for') || t === 'ofd' || t.includes('out_for') || t.includes('dispatch')) return 2;
  if (t.includes('transit') || t.includes('shipped') || t.includes('picked') || t.includes('packed') || t.includes('manifest') || t.includes('bag') || t.includes('hub')) return 1;
  return 0; // placed / confirmed / new / preparing / pending
}

export function orderNextStep({ orderStatus, shipmentStatus, carrier, paymentStatus }: NextStepSignals): string {
  const os = (orderStatus || '').toUpperCase();
  const paid = (paymentStatus || '').toUpperCase() === 'PAID';
  const shadowfax = (carrier || '').toUpperCase() === 'SHADOWFAX';
  const delhivery = (carrier || '').toUpperCase() === 'DELHIVERY';

  // Terminal states first.
  if (os === 'CANCELLED' || isCancelled(orderStatus) || isCancelled(shipmentStatus))
    return 'This order was cancelled. Any payment is refunded to source.';

  const stage = Math.max(stageOf(shipmentStatus), stageOf(orderStatus));
  if (os === 'DELIVERED' || stage >= 3)
    return 'Delivered — we hope you love it! 🍪';

  // Prepaid-only: nothing is prepared or shipped until payment clears.
  if (!paid)
    return 'Complete payment to confirm your order.';

  // Out for delivery.
  if (stage >= 2)
    return 'Your order is on the way — keep your phone handy.';

  // Shipped / picked up / in transit.
  if (stage >= 1)
    return shadowfax
      ? 'On its way with a rider — arriving today. Keep your phone handy.'
      : "Handed to Delhivery and on the move — it'll arrive in a few days.";

  // Paid & confirmed, still being made.
  if (shadowfax)
    return "We're baking your order — a rider will pick it up from our store and deliver today.";
  if (delhivery)
    return "We're packing your order — it'll be handed to Delhivery and arrive in a few days.";
  return "We're preparing your order — tracking updates will appear here soon.";
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
