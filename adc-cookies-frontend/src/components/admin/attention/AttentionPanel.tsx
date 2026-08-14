'use client';
import { Truck, RefreshCw, AlertTriangle } from 'lucide-react';
import { type AttentionReport } from '@/lib/api';
import { money } from '../shared/format';
import { card, iconBtn, actionBtn } from '../shared/ui';

/*
 * Orders that took the customer's money but did not finish downstream.
 *
 * Four separate lists rather than one, because each needs a different action:
 *   • paid, no courier      → re-book (one click, re-runs the same routing payment would have)
 *   • paid, no POS ticket   → usually an unmapped product; fix the mapping, then push again
 *   • cancelled, leg stuck  → the POS or carrier refused; must be finished in THEIR dashboard
 *   • money reversed        → a refund or chargeback landed on an order still being fulfilled
 * The whole panel is hidden when every list is empty, so a clean day shows nothing at all.
 */
export default function AttentionPanel({ report, busy, onRebook, onRetryPos, onOpen, onRefresh }: {
  report: AttentionReport; busy: number | null;
  onRebook: (id: number) => void; onRetryPos: (id: number) => void;
  onOpen: (id: number) => void; onRefresh: () => void;
}) {
  const head: React.CSSProperties = { fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', margin: '14px 0 6px' };
  const line: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border-soft)', fontSize: 'var(--text-sm)' };
  const num: React.CSSProperties = { fontWeight: 800, color: 'var(--text-link)', cursor: 'pointer' };
  const why: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 'var(--text-xs)', flex: 1, minWidth: 180 };

  return (
    <div style={{ ...card, padding: '14px 16px', marginBottom: 16, borderColor: 'var(--status-error)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={18} style={{ color: 'var(--status-error)' }} />
        <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Needs attention ({report.total})</span>
        <button onClick={onRefresh} style={{ ...iconBtn, marginLeft: 'auto' }} title="Refresh"><RefreshCw size={15} /></button>
      </div>

      {!!report.paidNoShipment.length && <>
        <div style={head}>Paid, but no courier booked ({report.paidNoShipment.length})</div>
        {report.paidNoShipment.map(o => (
          <div key={o.id} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span>{money(o.total_amount)}</span>
            {/* No address = nothing to ship to, and no retry can ever fix it. Say so instead of
                offering a button that is guaranteed to fail. */}
            {/* A hyperlocal booking exists as soon as Shiprocket accepts it, but the AWB is
                issued asynchronously while a rider is found — and this list is keyed on the AWB.
                Nothing reaches this panel during that search any more (the backend now waits out a
                grace window), so an order that IS here with a booking on it is one where the search
                has gone on far too long, and the sentence says that rather than "waiting". */}
            <span style={why}>
              {o.has_address === false
                ? 'No delivery address on this order — it cannot be shipped.'
                : o.shipment_error
                  ? o.shipment_error
                  : (o.shipment_id || o.carrier_order_id)
                    ? `${o.carrier || 'Courier'} booking #${o.shipment_id || o.carrier_order_id} placed${o.shipment_status ? ` — ${o.shipment_status}` : ''}, but no rider has been assigned since. Check the delivery wallet first.`
                    : 'No booking attempt recorded yet.'}
            </span>
            {o.has_address === false ? (
              <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>Not shippable</span>
            ) : (
              <button disabled={busy === o.id} onClick={() => onRebook(o.id)} style={{ ...actionBtn(), opacity: busy === o.id ? 0.5 : 1 }}
                title={(o.shipment_id || o.carrier_order_id) ? 'A booking already exists — this books a second one' : 'Book a courier for this order'}>
                <Truck size={13} /> {busy === o.id ? 'Booking…' : (o.shipment_id || o.carrier_order_id) ? 'Book again' : 'Book courier'}
              </button>
            )}
          </div>
        ))}
      </>}

      {!!report.paidNoPosTicket.length && <>
        <div style={head}>Paid, but the kitchen never got the ticket ({report.paidNoPosTicket.length})</div>
        {report.paidNoPosTicket.map(o => (
          <div key={o.id} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span>{money(o.total_amount)}</span>
            <span style={why}>{o.last_error || 'Never attempted.'}{o.attempts ? ` (${o.attempts} attempt${o.attempts > 1 ? 's' : ''})` : ''}</span>
            <button disabled={busy === o.id} onClick={() => onRetryPos(o.id)} style={{ ...actionBtn(), opacity: busy === o.id ? 0.5 : 1 }}>
              <RefreshCw size={13} /> {busy === o.id ? 'Sending…' : 'Send to POS'}
            </button>
          </div>
        ))}
      </>}

      {!!report.cancelStuckDownstream.length && <>
        <div style={head}>Cancelled here, but still live downstream ({report.cancelStuckDownstream.length})</div>
        {report.cancelStuckDownstream.map((o, i) => (
          <div key={`${o.id}-${i}`} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span style={why}>{o.remarks}</span>
          </div>
        ))}
      </>}

      {!!report.moneyReversed.length && <>
        <div style={head}>Money refunded or contested ({report.moneyReversed.length})</div>
        {report.moneyReversed.map((o, i) => (
          <div key={`${o.id}-${i}`} style={line}>
            <span style={num} onClick={() => onOpen(o.id)}>{o.order_number}</span>
            <span style={why}>{o.remarks}</span>
          </div>
        ))}
      </>}

    </div>
  );
}

/*
 * One store: where its staff sign in, who can, and what it is sitting on.
 *
 * The password handling here is the honest kind. Hashes cannot be read back, so there is no way to
 * answer "what is their password" for an account in use — and pretending otherwise by storing a
 * copy would be worse than useless. Instead: a brand-new account shows the starting password it was
 * created with, and the moment it is used or changed that stops being shown and the only move left
 * is to set a new one, which the admin then hands over in person.
 */
