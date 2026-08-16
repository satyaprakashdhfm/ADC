'use client';
import { X, Gift, Package, Truck, RefreshCw, ExternalLink } from 'lucide-react';
import { adminTrackOrder, type Order } from '@/lib/api';
import { money, fmtDate } from '../shared/format';
import { card, addBtn, iconBtn, Badge } from '../shared/ui';

interface Props {
  order: Order;
  onClose: () => void;
  trackResult: Record<number, unknown>;
  setTrackResult: React.Dispatch<React.SetStateAction<Record<number, unknown>>>;
  fixing: number | null;
  onRebook: (id: number) => void;
  onRetryPos: (id: number) => void;
}

export default function OrderDetailModal({ order: o, onClose, trackResult, setTrackResult, fixing, onRebook, onRetryPos }: Props) {
  const items = o.items || [];
  const parse = (s?: string | null) => { try { return s ? JSON.parse(s) : {}; } catch { return {}; } };
  const giftItem = items.find(it => { const p = parse(it.selectedOptions); return p.giftWrap || p.giftPackaging; });
  const giftOpts = giftItem ? parse(giftItem.selectedOptions) : null;
  const a = o.address;
  const row = (label: string, val: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>{label}</span><span>{val}</span></div>
  );

  const modalTrack = trackResult[o.id] as { status?: string; note?: string; scans?: { time: string; event: string }[] } | undefined;
  const service = o.carrier === 'SHIPROCKET' ? 'Intracity (Shiprocket)' : o.carrier === 'DELHIVERY' ? 'Intercity (Delhivery)' : null;

  const track = async () => {
    const r = await adminTrackOrder(o.id).catch(() => null);
    if (!r?.ok) return;
    // Shiprocket is pre-normalised by the backend into { status, scans };
    // only Delhivery returns its own raw envelope.
    if (r.carrier === 'SHIPROCKET') {
      setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', note: '', scans: r.scans || [] } }));
    } else {
      type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
      const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
      const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
      setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="hide-sb" style={{ width: 'min(520px,96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 'var(--text-h4)' }}>{o.orderNumber}</h3>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 2 }}>{fmtDate(o.createdAt)}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Badge text={o.orderStatus} />
          <Badge text={o.paymentStatus} ok={o.paymentStatus === 'PAID'} />
          {o.warningFlags?.includes('DUPLICATE_CHARGE') && (
            <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--status-danger-bg, #FCEBEA)', color: 'var(--status-danger, #C0392B)', fontSize: 'var(--text-xs)', fontWeight: 800 }}>
              ⚠ Possible duplicate charge — check Razorpay
            </span>
          )}
        </div>

        <div style={{ ...card, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: giftOpts ? 'var(--gradient-warm)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{giftOpts ? <Gift size={18} style={{ color: 'var(--white)' }} /> : <Package size={18} color="var(--text-muted)" />}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{giftOpts ? 'Gift packaging' : 'Standard packaging'}</div>
            {giftOpts && (giftOpts.giftMessage ? <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)', marginTop: 4, fontStyle: 'italic' }}>&ldquo;{giftOpts.giftMessage}&rdquo;</div> : <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>No gift message</div>)}
          </div>
        </div>

        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Items</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {items.map(it => {
            const opts = parse(it.selectedOptions);
            const addOns = Array.isArray(opts.addOns) ? opts.addOns : Array.isArray(opts.addons) ? opts.addons : [];
            return (
              <div key={it.id} style={{ ...card, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{it.productName} × {it.quantity}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{money(it.totalPrice)}</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>{money(it.unitPrice)} each</div>
                {addOns.length > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Add-ons: {addOns.join(', ')}</div>}
                {it.specialNotes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Note: {it.specialNotes}</div>}
              </div>
            );
          })}
          {!items.length && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No item details recorded for this order.</div>}
        </div>

        {a && (
          <div style={{ ...card, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Deliver to</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>{a.fullName} · {a.phone}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{[a.addressLine1, a.addressLine2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</div>
          </div>
        )}

        {/* Shipment — read-only summary; create/cancel/label live in the Delivery tab (no duplication) */}
        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Shipment</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'CREATED' || o.shipmentStatus === 'DELIVERED'} />
            {service && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>{service}</span>}
            {o.delhiveryWaybill && <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill}</span>}
          </div>
          {o.delhiveryWaybill ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={track} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', background: 'var(--surface-raised)', color: 'var(--text-strong)', border: '1.5px solid var(--border-default)' }}><ExternalLink size={14} /> Track</button>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {o.shipmentError && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, margin: '0 0 8px' }}>Booking failed: {o.shipmentError}</p>}
              {!a ? (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>This order has no delivery address, so no courier can be booked for it.</p>
              ) : o.paymentStatus === 'PAID' && o.orderStatus !== 'CANCELLED' ? (
                <button disabled={fixing === o.id} onClick={() => onRebook(o.id)} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', opacity: fixing === o.id ? 0.5 : 1 }}>
                  <Truck size={14} /> {fixing === o.id ? 'Booking…' : 'Book courier now'}
                </button>
              ) : (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>Not shipped — a courier is only booked once payment is confirmed.</p>
              )}
            </div>
          )}
          {modalTrack && (
            <div style={{ marginTop: 12, background: 'var(--surface-sunken)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>{modalTrack.status}{modalTrack.note ? ` — ${modalTrack.note}` : ''}</div>
              {modalTrack.scans && modalTrack.scans.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {modalTrack.scans.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, fontSize: 'var(--text-xs)', borderLeft: i === 0 ? '2px solid var(--brand-secondary)' : '2px solid var(--border-soft)', paddingLeft: 10 }}>
                      <span style={{ flex: 'none', color: 'var(--text-subtle)', minWidth: 120 }}>{s.time ? new Date(s.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      <span style={{ color: 'var(--text-body)' }}>{s.event}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kitchen / POS — the leg that decides whether the bill and KOT actually print.
            Shown only for paid orders: an unpaid one is never relayed, by design. */}
        {o.paymentStatus === 'PAID' && (
          /* Two completely different situations wearing one panel.
             Begur is the only AUTO outlet — we relay its tickets ourselves, and a missing one is a
             real failure worth a retry button. Every other store bills on its own terminal by hand,
             so there is no ticket to send and never was: "Not sent" read as something broken on the
             four stores where it is the correct and expected state, and the number that actually
             reconciles the order — the bill the staff typed in — was not shown at all. */
          o.store?.posManual ? (
            <div style={{ ...card, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Kitchen (billed at the store)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge text={o.store.posBillNo ? `Billed — bill ${o.store.posBillNo}` : 'Not billed yet'} ok={!!o.store.posBillNo} />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                {o.store.posBillNo
                  ? 'This store rings orders up on its own Petpooja terminal. The bill number above is the link between this order and their POS.'
                  : 'This store rings orders up on its own Petpooja terminal. Staff enter the bill number when they accept — nothing is sent from here.'}
              </p>
            </div>
          ) : (
          <div style={{ ...card, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>Kitchen (Petpooja POS)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge text={o.pos?.relayed ? 'Ticket printed' : o.pos ? 'Relay failed' : 'Not sent'} ok={!!o.pos?.relayed} />
              {o.pos?.petpoojaOrderId && <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.pos.petpoojaOrderId}</span>}
            </div>
            {!o.pos?.relayed && (
              <div style={{ marginTop: 10 }}>
                {o.pos?.lastError && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, margin: '0 0 8px' }}>{o.pos.lastError}{o.pos.attempts ? ` — ${o.pos.attempts} attempt${o.pos.attempts > 1 ? 's' : ''}` : ''}</p>}
                {o.orderStatus !== 'CANCELLED' && (
                  <button disabled={fixing === o.id} onClick={() => onRetryPos(o.id)} style={{ ...addBtn, padding: '8px 14px', fontSize: 'var(--text-sm)', opacity: fixing === o.id ? 0.5 : 1 }}>
                    <RefreshCw size={14} /> {fixing === o.id ? 'Sending…' : 'Send to POS'}
                  </button>
                )}
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '8px 0 0' }}>Invoices and KOTs live in the Petpooja dashboard — this only shows whether the ticket reached them.</p>
              </div>
            )}
          </div>
          )
        )}

        <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {row('Item total', money(o.subtotal ?? o.totalAmount))}
          {!!o.discountAmount && row(`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`, `−${money(o.discountAmount)}`)}
          {o.deliveryFee != null && row('Delivery fee', money(o.deliveryFee))}
          {!!o.taxAmount && row('Tax / GST', money(o.taxAmount))}
          <div style={{ height: 1, background: 'var(--border-default)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}><span>Total</span><span>{money(o.totalAmount)}</span></div>
          {o.payment && (
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border-default)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>Payment:</span> {o.payment.provider === 'RAZORPAY' ? 'Razorpay' : o.payment.provider} · {o.payment.status}
              {o.payment.transactionId && <><br /><span style={{ fontFamily: 'monospace', color: 'var(--text-body)' }}>{o.payment.transactionId}</span></>}
              {o.payment.paidAt && <><br />Paid {fmtDate(o.payment.paidAt)}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
