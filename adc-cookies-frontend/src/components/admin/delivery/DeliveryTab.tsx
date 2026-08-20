'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Star, ToggleLeft, ToggleRight, ExternalLink, RefreshCw, Download, Truck, FileText, AlertTriangle, X } from 'lucide-react';
import {
  adminGetWarehouses, adminSetDefaultWarehouse, adminToggleWarehouse, adminGetOrders,
  adminCreateShipment, adminCancelShipment, adminTrackOrder, openLabel,
  adminCreatePickupRequest, adminFetchOrderDocument, adminGetStoreReadiness, adminGetShiprocketWallet,
  type Order, type Warehouse, type WarehouseInput, type StoreReadinessReport, type ShiprocketWallet,
} from '@/lib/api';
import { todayStr } from '../shared/format';
import { card, td, inp, addBtn, iconBtn, actionBtn, Panel, Table, Badge, Empty, Field } from '../shared/ui';
import { belongsInShipments } from '../orders/orderConstants';
import { SR_ORDER_STATES } from './srOrderStates';
import { shipStatusLabel } from './shipStatusLabel';
import { EMPTY_WH } from './warehouseDefaults';

interface Props {
  delivSub: 'main' | 'sameday' | 'delhivery';
  setDelivSub: (v: 'main' | 'sameday' | 'delhivery') => void;
  warehouses: Warehouse[] | null;
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[] | null>>;
  setWhForm: (v: { id?: number; data: WarehouseInput } | null) => void;
  orders: Order[] | null;
  setOrders: React.Dispatch<React.SetStateAction<Order[] | null>>;
  purDate: string; setPurDate: (v: string) => void;
  purTime: string; setPurTime: (v: string) => void;
  purCount: string; setPurCount: (v: string) => void;
  purResult: string; setPurResult: (v: string) => void;
  shipmentBusy: number | null; setShipmentBusy: (v: number | null) => void;
  shipmentWeights: Record<number, string>;
  setShipmentWeights: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  trackResult: Record<number, unknown>;
  setTrackResult: React.Dispatch<React.SetStateAction<Record<number, unknown>>>;
  storeReadiness: StoreReadinessReport | null;
  setStoreReadiness: React.Dispatch<React.SetStateAction<StoreReadinessReport | null>>;
  sfxStatesOpen: boolean; setSfxStatesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setErr: (s: string) => void;
  setCancelInfo: (v: { orderNumber: string; ok: boolean; message: string } | null) => void;
  deliveryFeeOutstation: string;
  deliveryFeeSaved: boolean;
  changeDeliveryFeeOutstation: (v: string) => void;
  saveDeliveryFeeOutstation: () => void;
}

export default function DeliveryTab({
  delivSub, setDelivSub, warehouses, setWarehouses, setWhForm, orders, setOrders,
  purDate, setPurDate, purTime, setPurTime, purCount, setPurCount, purResult, setPurResult,
  shipmentBusy, setShipmentBusy, shipmentWeights, setShipmentWeights,
  trackResult, setTrackResult, storeReadiness, setStoreReadiness,
  sfxStatesOpen, setSfxStatesOpen, setErr, setCancelInfo,
  deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
}: Props) {
  /* Kept local rather than lifted into useAdminDelivery: nothing else needs it, it is read-only,
     and it must not join the props chain every other field here already travels through. */
  const [wallet, setWallet] = useState<ShiprocketWallet | null>(null);
  useEffect(() => { adminGetShiprocketWallet().then(setWallet).catch(() => {}); }, []);

  /*
   * What this panel is for: orders that still need something doing about a parcel.
   *
   * An abandoned checkout — cancelled before it was ever paid for — has no shipment and can never
   * have one, so it sat here reading "Not created · No shipment" forever with two buttons that could
   * do nothing. The Orders tab already stopped counting those as orders; this is the same rule
   * applied to the same list, which is what it should have been from the start.
   *
   * A cancelled order that WAS booked stays visible: cancelling on our side does not always succeed
   * downstream, and a live waybill on a cancelled order means a rider may still be coming.
   */
  const liveShipments = (orders || []).filter(belongsInShipments);
  const shipmentRows = delivSub === 'delhivery'
    ? liveShipments.filter(o => o.carrier === 'DELHIVERY')
    : liveShipments;
  const hiddenCancelled = (orders || []).length - liveShipments.length;

  return (

    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sub-nav: all shipments · same-day intracity · Delhivery outstation */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['main', 'All shipments'], ['sameday', 'Same-day · Intracity'], ['delhivery', 'Delhivery · Outstation']] as const).map(([id, label]) => {
          const on = delivSub === id;
          return <button key={id} onClick={() => setDelivSub(id)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? 'var(--white)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>{label}</button>;
        })}
      </div>

      {(delivSub === 'main' || delivSub === 'delhivery') && (<>
      {/* Warehouses and pickup scheduling are Delhivery's, so they live on Delhivery's tab.
          They used to sit under "All shipments", which put outstation-only setup in front of
          someone looking for the order list and left the Delhivery tab with no way to reach it.
          "All" is the list of every shipment and nothing else. */}
      {delivSub === 'delhivery' && (<>
      {/* What the customer is charged for an outstation parcel. It used to sit under Products,
          nowhere near the carrier it prices — and it is the only delivery fee anyone sets by hand,
          since intracity is whatever Shiprocket quotes live for that address. */}
      <Panel title="Delivery fee — outstation">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>
          What a customer pays for outstation (Delhivery) delivery. Same-day intracity is never set here —
          that&apos;s charged exactly what Shiprocket quotes for each address, live at checkout.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹</span>
          <input
            type="number" min="0" step="1"
            value={deliveryFeeOutstation}
            onChange={e => changeDeliveryFeeOutstation(e.target.value)}
            style={{ ...inp, width: 120 }}
          />
          <button onClick={saveDeliveryFeeOutstation} style={addBtn}>{deliveryFeeSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </Panel>

      {/* Warehouses */}
      <Panel title="Warehouses" loading={warehouses === null}
        action={<button onClick={() => setWhForm({ data: { ...EMPTY_WH } })} style={addBtn}><Plus size={16} /> Add warehouse</button>}>
        {warehouses && warehouses.length > 0 ? (
          <Table head={['Name', 'Location', 'Pincode', 'Status', 'Default', '']}>
            {warehouses.map(w => (
              <tr key={w.id}>
                <td style={td}><strong>{w.name}</strong><br /><span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{w.pickupLocation}</span></td>
                <td style={td}>{[w.city, w.state].filter(Boolean).join(', ') || '—'}</td>
                <td style={td}>{w.pincode}</td>
                <td style={td}><Badge text={w.isActive ? 'Active' : 'Inactive'} ok={w.isActive} /></td>
                <td style={td}>
                  {w.isDefault
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand-secondary)', fontWeight: 700, fontSize: 'var(--text-xs)' }}><Star size={13} fill="currentColor" /> Default</span>
                    : <button onClick={async () => { await adminSetDefaultWarehouse(w.id); adminGetWarehouses().then(setWarehouses).catch(() => {}); }} style={{ ...iconBtn, width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>Set default</button>}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => setWhForm({ id: w.id, data: { name: w.name, registeredName: w.registeredName || '', pickupLocation: w.pickupLocation, addressLine1: w.addressLine1 || '', addressLine2: w.addressLine2 || '', city: w.city || '', state: w.state || '', pincode: w.pincode, returnPincode: w.returnPincode || '', phone: w.phone || '', email: w.email || '' } })} style={iconBtn} aria-label="Edit"><Pencil size={15} /></button>
                  <button onClick={async () => { const u = await adminToggleWarehouse(w.id).catch(() => null); if (u) setWarehouses(p => (p || []).map(x => x.id === w.id ? u : x)); }} style={iconBtn} aria-label="Toggle active">
                    {w.isActive ? <ToggleRight size={15} color="var(--brand-secondary)" /> : <ToggleLeft size={15} />}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        ) : warehouses !== null && <Empty text="No warehouses yet — add one to create shipments." />}
      </Panel>

      {/* Pickup request (Delhivery only) */}
      {(() => {
        const pending = (orders || []).filter(o => o.carrier === 'DELHIVERY' && o.delhiveryWaybill && !['DELIVERED', 'CANCELLED'].includes(o.shipmentStatus || ''));
        return (
      <Panel title="Schedule a Delhivery pickup">
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Delhivery collects <strong>all manifested outstation packages</strong> from your default warehouse at the chosen slot.
          Intracity needs no pickup request — Shiprocket dispatches a rider to the store automatically once the order is confirmed.
        </p>
        <div style={{ marginBottom: 14, background: 'var(--surface-sunken)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: pending.length ? 6 : 0 }}>
            {pending.length} Delhivery package{pending.length !== 1 ? 's' : ''} awaiting pickup
          </div>
          {pending.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pending.map(o => (
                <span key={o.id} style={{ fontSize: 'var(--text-2xs)', fontFamily: 'monospace', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '2px 7px', color: 'var(--text-body)' }} title={`${o.address?.fullName || ''} · ${o.delhiveryWaybill}`}>{o.orderNumber}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Pickup date"><input type="date" style={{ ...inp, width: 160 }} value={purDate} min={todayStr()} onChange={e => setPurDate(e.target.value)} /></Field>
          <Field label="Pickup time"><input type="time" style={{ ...inp, width: 120 }} value={purTime} onChange={e => setPurTime(e.target.value)} /></Field>
          <Field label="Package count"><input type="number" style={{ ...inp, width: 90 }} value={purCount} onChange={e => setPurCount(e.target.value)} min="1" /></Field>
          <button onClick={() => setPurCount(String(Math.max(1, pending.length)))} style={{ ...iconBtn, width: 'auto', padding: '0 12px', height: 40, marginRight: 0, fontSize: 'var(--text-xs)', fontWeight: 700 }} title="Use the awaiting-pickup count">Use {Math.max(1, pending.length)}</button>
          <button onClick={async () => {
            setPurResult('Submitting…');
            const r = await adminCreatePickupRequest(purDate, purTime, Number(purCount)).catch(e => ({ ok: false, reason: String(e.message || e), data: undefined }));
            // The backend translates Delhivery's terse refusals — a wallet under the Rs.500
            // minimum, or a slot already open for this warehouse today — into a sentence worth
            // reading, so prefer it over the raw reason.
            setPurResult(r.ok
              ? `Pickup scheduled for ${purDate} at ${purTime} · ${purCount} package(s). Delhivery sometimes moves the date — check their panel to confirm the slot.`
              : `Error: ${(r as { ok: boolean; reason?: string }).reason}`);
          }} disabled={!purDate || !purTime} style={{ ...addBtn, opacity: !purDate ? 0.5 : 1 }}>Request pickup</button>
        </div>
        {purResult && <div style={{ marginTop: 10, fontSize: 'var(--text-sm)', color: purResult.startsWith('Error') ? 'var(--status-error)' : 'var(--status-success)', fontWeight: 700 }}>{purResult}</div>}

        {/* Delhivery's rules, from their own Pickup Request Creation docs. An earlier version
            of this box claimed the waybills had to be attached by hand in their panel and that
            a pickup with none attached collects nothing. That was wrong: their documentation
            states the request is raised against the WAREHOUSE, not the waybill, and one
            request therefore covers every parcel ready at that location. */}
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--amber-50)', border: '1px solid var(--border-brand)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <AlertTriangle size={16} style={{ color: 'var(--brand-secondary)', flex: 'none', marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: 6 }}>
                How Delhivery pickups work
              </div>
              <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--text-body)', lineHeight: 1.7, margin: '0 0 8px', paddingLeft: 18 }}>
                <li><strong>One request covers every parcel at this warehouse.</strong> It is raised against the pickup location, not against waybills — you do not need one request per shipment.</li>
                <li><strong>Only one open request per warehouse per day.</strong> A second can be raised only after the existing one is closed, so schedule once the day&apos;s parcels are ready rather than per order.</li>
                <li><strong>Raise it when the parcels are packed</strong> and ready to hand to the field executive — not at the moment the order is placed.</li>
                <li><strong>Count</strong> is how many packages the rider should collect. Use the button above to fill in the {Math.max(1, pending.length)} awaiting pickup.</li>
                <li>Each parcel needs its <strong>shipping label</strong> printed — recipient address and scannable tracking barcode. Download them from the shipments list.</li>
                <li>Parcels at a <strong>different location</strong> need their own request from that warehouse.</li>
                <li><strong>Your Delhivery wallet must hold at least ₹500</strong> or the request is rejected. This applies to Prepaid and COD alike — confirmed live. Shipment creation also debits the wallet at the time the parcel is created, not on delivery.</li>
                <li>Delhivery may <strong>move the date</strong> you ask for — a request for one day has come back scheduled for the next. Check the confirmation rather than assuming the slot you chose.</li>
              </ul>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 8px' }}>
                This step is optional: your Delhivery account POC can enable <strong>auto-pickup</strong>, after which collections are
                scheduled for you and this panel is only needed for an ad-hoc slot. Delhivery has no cancel-pickup API, so cancelling
                is done in their panel.
              </p>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="https://one.delhivery.com/v2/pickup-requests/domestic" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--brand-secondary)' }}>
                  <ExternalLink size={13} /> Open pickup requests
                </a>
                <a href="https://one.delhivery.com/v2/pickup-requests/domestic" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--status-error)' }}
                  title="Delhivery provides no cancel-pickup API — cancel it from their panel">
                  <X size={13} /> Cancel a pickup request
                </a>
              </div>
            </div>
          </div>
        </div>
      </Panel>
        );
      })()}
      </>)}

      {/* Orders with shipment actions — all carriers under "All", or Delhivery-only under its tab.
          Cancelled orders with no booking are left out: nothing to ship, and they already live on the
          Orders tab. One that WAS booked stays, because its courier may still need calling off. */}
      <Panel title={delivSub === 'delhivery' ? 'Delhivery — outstation shipments' : 'Order shipments'} loading={orders === null}
        action={orders === null ? undefined : <button onClick={() => adminGetOrders().then(setOrders).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
        {orders && (
          <Table head={['Order', 'Customer', 'Service', 'Waybill', 'Status', 'Actions']}>
            {shipmentRows.map(o => {
              const w = shipmentWeights[o.id] ?? '0.5';
              /* What is still true of this shipment, decided once per row.
                 Separators flattened because our statuses are SCREAMING_SNAKE and the carriers'
                 are spaced words. A shipment that has arrived, been called off, or come back has
                 nothing left to cancel -- offering it anyway is how a delivered order ends up with
                 a "carrier refused to cancel" note on it and a permanent entry in Needs attention. */
              const sFlat = (o.shipmentStatus || '').toLowerCase().replace(/[_-]+/g, ' ');
              const shipTerminal = (/deliver/.test(sFlat) && !sFlat.includes('out for'))
                || /cancel|rto|returned|lost/.test(sFlat);
              // Booked with Shiprocket and still hunting: no waybill yet, but very much cancellable.
              const srSearching = o.carrier === 'SHIPROCKET' && !o.delhiveryWaybill && !shipTerminal;

              /*
               * Create books a DELHIVERY parcel, and nothing else. It therefore appears only on
               * Delhivery's own tab, and never on an order that was routed intracity.
               *
               * It used to sit on any row without a waybill, including "All shipments" — so a
               * same-day order whose Shiprocket booking had just been cancelled showed a weight box
               * and a Create button, one click from a multi-day courier. That is not a hypothetical:
               * it happened, and it put a real waybill on a 17 km cookie order.
               *
               * `carrierOrderId` is the tell that survives. Once Create runs it rewrites `carrier`
               * to DELHIVERY, so carrier alone would forget the order was ever intracity and offer
               * the button again on the next render.
               */
              const wasIntracity = o.carrier === 'SHIPROCKET' || !!o.carrierOrderId;
              const canCreateDelhivery = delivSub === 'delhivery' && !o.delhiveryWaybill && !wasIntracity;

              /* One Cancel, rendered by whichever branch applies. A booking still searching and one
                 with a rider already on the road are the same action against the same carrier --
                 only the warning differs -- so they must not drift into two implementations. Null
                 when there is nothing left to cancel, which is what keeps it off a delivered row. */
              const cancelBtn = shipTerminal ? null : (
                <button disabled={shipmentBusy === o.id} onClick={async () => {
                  // For Shiprocket the AWB only exists once a real rider has been found — so its
                  // presence means someone is already on their way AND the delivery charge has been
                  // taken. That is a different decision from cancelling a booking still searching
                  // for a rider, and must not sit behind the same casual confirm.
                  const riderOut = o.carrier === 'SHIPROCKET' && !!o.delhiveryWaybill;
                  const ref = o.delhiveryWaybill || o.carrierOrderId || o.orderNumber;
                  const q = riderOut
                    ? `A RIDER HAS ALREADY BEEN DISPATCHED for ${o.orderNumber}.\n\nThey may be at the store or on the way to the customer, and the delivery charge has already been taken. The carrier may refuse to call them off this late.\n\nStill try to cancel?`
                    : `Cancel booking ${ref}?\n\nNo rider has been assigned, so nothing has been charged for the delivery. This does NOT refund the customer's payment.`;
                  if (!confirm(q)) return;
                  setShipmentBusy(o.id); setErr('');
                  try {
                    const r = await adminCancelShipment(o.id);
                    // Only NOW is it actually cancelled. This used to mark the row CANCELLED even
                    // when the carrier refused, so a failed cancel looked identical to a successful
                    // one — while a rider was still on the way.
                    setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, shipmentStatus: 'CANCELLED' } : x));
                    setCancelInfo({ orderNumber: o.orderNumber, ok: true, message: r?.message || `Booking ${ref} cancelled with ${o.carrier || 'the carrier'}. The customer's payment is not refunded by this.` });
                  } catch (e: unknown) {
                    setCancelInfo({ orderNumber: o.orderNumber, ok: false, message: e instanceof Error ? e.message : 'The carrier refused to cancel this booking.' });
                  } finally { setShipmentBusy(null); }
                }} style={actionBtn(true)} title="Cancel this booking with the carrier">
                  {shipmentBusy === o.id ? '…' : <><X size={13} /> Cancel</>}
                </button>
              );
              const trackData = trackResult[o.id] as { status?: string; note?: string; scans?: { time: string; event: string }[] } | undefined;
              const service = o.carrier === 'SHIPROCKET' ? { kind: 'Intracity', name: 'Shiprocket' }
                : o.carrier === 'DELHIVERY' ? { kind: 'Intercity', name: 'Delhivery' } : null;
              return (
                <tr key={o.id}>
                  <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{o.orderStatus}</span></td>
                  <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.pincode || ''}</span></td>
                  <td style={td}>
                    {service
                      ? <><span style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-xs)' }}>{service.kind}</span><br /><span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-2xs)' }}>({service.name})</span></>
                      : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>}
                  </td>
                  <td style={td}>
                    {o.delhiveryWaybill
                      ? <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill}</span>
                      : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>—</span>}
                  </td>
                  <td style={td}><Badge text={shipStatusLabel(o.shipmentStatus)} ok={o.shipmentStatus === 'DELIVERED'} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    {/* An intracity order that is already booked has no waybill until a rider
                        accepts, and this row keyed the Create button off the waybill alone — so a
                        live Shiprocket booking still searching for a rider was offered a DELHIVERY
                        shipment, and pressing it would have booked the same cookies twice with two
                        carriers. Being booked is what disqualifies it, not having a waybill. */}
                    {srSearching ? (
                      /* Booked, no rider yet. This is exactly when calling it off is cheapest --
                         no AWB means no rider was ever allocated and the wallet was never charged --
                         so the label alone, with no way to act on it, was the wrong half. */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
                          Booked — waiting for a rider
                        </span>
                        {cancelBtn}
                      </div>
                    ) : canCreateDelhivery ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="number" value={w} min="0.1" step="0.1" title="Weight (kg)"
                          onChange={e => setShipmentWeights(p => ({ ...p, [o.id]: e.target.value }))}
                          style={{ ...inp, width: 62, padding: '6px 8px' }} />
                        <button disabled={shipmentBusy === o.id} onClick={async () => {
                          setShipmentBusy(o.id); setErr('');
                          const r = await adminCreateShipment(o.id, Number(w) || 0.5).catch(e => { setErr(String(e.message || e)); return null; });
                          if (r) setOrders(p => (p || []).map(x => x.id === o.id ? { ...x, delhiveryWaybill: r.delhiveryWaybill, shipmentStatus: r.shipmentStatus, carrier: 'DELHIVERY' } : x));
                          setShipmentBusy(null);
                        }} style={{ ...addBtn, padding: '7px 12px', fontSize: 'var(--text-xs)' }}>
                          {shipmentBusy === o.id ? '…' : <><Truck size={13} /> Create</>}
                        </button>
                      </div>
                    ) : !o.delhiveryWaybill ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {shipTerminal ? 'Booking cancelled' : 'No shipment'}
                      </span>
                    ) : (
                      /* Labelled pills rather than bare icons — four unlabelled glyphs in a row
                         gave no clue which one cancelled a shipment. */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {o.carrier === 'DELHIVERY' && <button onClick={() => openLabel(o.delhiveryWaybill!).catch(e => setErr(String(e.message || e)))} style={actionBtn()} title="Download the shipping label PDF"><Download size={13} /> Label</button>}
                        {o.carrier === 'DELHIVERY' && (
                          <button title="Proof of delivery / signature (available after delivery)" onClick={async () => {
                            setErr('');
                            for (const t of ['EPOD', 'SIGNATURE_URL'] as const) {
                              const r = await adminFetchOrderDocument(o.id, t).catch(() => null);
                              if (r?.ok && r.url) { window.open(r.url, '_blank', 'noopener'); return; }
                            }
                            setErr('No proof-of-delivery document available yet — Delhivery provides it after delivery.');
                          }} style={actionBtn()}><FileText size={13} /> POD</button>
                        )}
                        <button title="Fetch the latest carrier status" onClick={async () => {
                          const r = await adminTrackOrder(o.id).catch(() => null);
                          if (!r?.ok) { if (r) setTrackResult(p => ({ ...p, [o.id]: { status: `Error: ${r.reason || 'unknown'}` } })); return; }
                          if (r.carrier === 'SHIPROCKET') {
                            setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', note: '', scans: r.scans || [] } }));
                          } else {
                            type ShipmentData = { ShipmentData?: { Shipment?: { Status?: { Status?: string; Instructions?: string }; Scans?: { ScanDetail?: { ScanDateTime?: string; Instructions?: string; Scan?: string } }[] } }[] };
                            const shipment = (r.data as ShipmentData)?.ShipmentData?.[0]?.Shipment;
                            const scans = (shipment?.Scans || []).map(s => ({ time: s.ScanDetail?.ScanDateTime || '', event: [s.ScanDetail?.Scan, s.ScanDetail?.Instructions].filter(Boolean).join(' — ') })).reverse();
                            setTrackResult(p => ({ ...p, [o.id]: { status: shipment?.Status?.Status || 'No status', note: shipment?.Status?.Instructions || '', scans } }));
                          }
                        }} style={actionBtn()}><ExternalLink size={13} /> Status</button>
                        {cancelBtn}
                      </div>
                    )}
                    {trackData && (
                      <div style={{ marginTop: 6, background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 12px', maxWidth: 340, whiteSpace: 'normal' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-xs)', marginBottom: 6 }}>{trackData.status}{trackData.note ? ` — ${trackData.note}` : ''}</div>
                        {trackData.scans && trackData.scans.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {trackData.scans.slice(0, 5).map((s, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                                <span style={{ flex: 'none', color: 'var(--text-subtle)', minWidth: 110 }}>{s.time ? new Date(s.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                <span>{s.event}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {orders !== null && !shipmentRows.length && <Empty text={delivSub === 'delhivery' ? 'No Delhivery (outstation) shipments yet.' : 'No shipments to handle.'} />}
        {/* Never silently drop rows: say how many were left out and where to find them. */}
        {hiddenCancelled > 0 && (
          <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '12px 0 0', lineHeight: 1.5 }}>
            {hiddenCancelled} cancelled order{hiddenCancelled === 1 ? '' : 's'} with no booking {hiddenCancelled === 1 ? 'is' : 'are'} not
            listed — there is nothing to ship. {hiddenCancelled === 1 ? 'It is' : 'They are'} kept under
            <strong> Orders → Cancelled &amp; failed payments</strong>.
          </p>
        )}
        {orders === null && <button onClick={() => adminGetOrders().then(setOrders).catch(() => setOrders([]))} style={addBtn}>Load orders</button>}
      </Panel>
      </>)}

      {delivSub === 'sameday' && (
        <>
        {/* Pickup readiness. What decides whether a store can take a same-day order is
            whether its Shiprocket pickup location is VERIFIED — an unverified one quotes a
            price and then refuses the booking, so it must never read as available. */}
        <Panel title="Same-day stores — Shiprocket pickup readiness" loading={storeReadiness === null}
          action={storeReadiness === null ? undefined : <button onClick={() => adminGetStoreReadiness().then(setStoreReadiness).catch(() => {})} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>}>
          {storeReadiness && (
            <>
              {!storeReadiness.configured ? (
                <Empty text="Shiprocket is not configured on this environment, so no store can take a same-day order." />
              ) : (
                <>
                  <div style={{ ...card, padding: '10px 14px', marginBottom: 12, borderColor: storeReadiness.verifiedCount === storeReadiness.stores.length ? 'var(--border-default)' : 'var(--status-error)' }}>
                    <strong style={{ color: storeReadiness.verifiedCount === storeReadiness.stores.length ? 'var(--text-strong)' : 'var(--status-error)', fontSize: 'var(--text-sm)' }}>
                      {storeReadiness.verifiedCount} of {storeReadiness.stores.length} stores can dispatch
                    </strong>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      A store can take same-day orders when its pickup nickname exists in Shiprocket — that is where the rider
                      collects from. Shiprocket&apos;s own <em>status</em> is shown for reference only: it reads 2 on your primary
                      location and 1 on the rest, while their panel marks all of them verified, and bookings from status-1
                      locations are accepted. Read live from Shiprocket, not cached.
                    </p>
                  </div>
                  <Table head={['Store', 'City', 'Pincode', 'Pickup name', 'Can dispatch?']}>
                    {storeReadiness.stores.map((s) => (
                      <tr key={s.pincode} style={{ opacity: s.verified ? 1 : 0.75 }}>
                        <td style={td}><strong style={{ color: 'var(--text-strong)' }}>{s.name}</strong>{s.isPrimary && <span style={{ marginLeft: 6, fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)' }}>PRIMARY</span>}</td>
                        <td style={td}>{s.city}, {s.state}</td>
                        <td style={td}><span style={{ fontFamily: 'monospace' }}>{s.pincode}</span></td>
                        <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{s.pickupName || '—'}</span>{s.pickupId ? <><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>id {s.pickupId}</span></> : null}</td>
                        <td style={td}>
                          {s.usable ? <Badge text="Yes" ok /> : <Badge text="No" />}
                          {s.usable && !s.verified && <div style={{ marginTop: 3, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>Shiprocket status 1 (normal for a non-primary location)</div>}
                          {s.blockedReason && <div style={{ marginTop: 4, fontSize: 'var(--text-2xs)', color: 'var(--status-error)', maxWidth: 320, lineHeight: 1.45 }}>{s.blockedReason}</div>}
                        </td>
                      </tr>
                    ))}
                  </Table>
                  {!!storeReadiness.unmappedPickups?.length && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '10px 0 0' }}>
                      Registered in Shiprocket but not mapped to any ADC store: {storeReadiness.unmappedPickups.map(p => p.nickname).join(', ')}.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </Panel>
        <Panel title="Shiprocket — status reference (admin only)"
          action={<button onClick={() => setSfxStatesOpen(v => !v)} style={{ ...iconBtn, width: 'auto', padding: '4px 10px', fontSize: 'var(--text-xs)', fontWeight: 700 }}>{sfxStatesOpen ? 'Hide' : 'Show'}</button>}>
          {sfxStatesOpen ? (
            <>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                What each Shiprocket tracking status does to the order. Anything not listed leaves the order untouched rather than
                guessing. Note &quot;Rider assigned&quot; only means a rider was allocated — nothing has left the store yet, so it must
                not read as shipped to the customer.
              </p>
              <Table head={['Shiprocket status', 'Order becomes', 'What it means']}>
                {SR_ORDER_STATES.map((s) => (
                  <tr key={s.id}>
                    <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{s.id}</span></td>
                    <td style={td}><strong>{s.status}</strong></td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{s.description}</td>
                  </tr>
                ))}
              </Table>
              <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', margin: '10px 0 0', lineHeight: 1.5 }}>
                Observed on a real delivery (1 Aug 2026, Rapido rider, 10.61 km): Rider reached pickup 18:33:01 → Picked up 18:33:28
                → Rider reached drop 18:57:12 → Delivered 19:46:05. Every webhook arrived within seconds of the event.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>{SR_ORDER_STATES.length} mapped statuses — click Show to view the full reference.</p>
          )}
        </Panel>
        <Panel title="Same-day — intracity orders" loading={orders === null}
          action={orders === null ? undefined : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {/* The balance a rider is dispatched against. Creating the order is free; assigning
                  the rider is what spends, so an empty wallet fails AFTER the money is taken and the
                  cookies are baked. This is the one number that predicts it, and it used to live
                  only inside Shiprocket's own panel. */}
              {wallet?.ok && wallet.balance != null && (
                <span title={wallet.low ? 'Low — top up before the next same-day order' : 'Shiprocket wallet balance'}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-2xs)', fontWeight: 800,
                    background: wallet.low ? 'var(--red-wash)' : 'var(--green-wash)',
                    color: wallet.low ? 'var(--red-danger)' : 'var(--green-success)',
                    border: `1px solid ${wallet.low ? 'var(--red-danger)' : 'var(--green-success)'}`,
                  }}>
                  {wallet.low ? '⚠ ' : ''}Wallet ₹{wallet.balance}
                </span>
              )}
              <button onClick={() => { adminGetOrders().then(setOrders).catch(() => {}); adminGetShiprocketWallet().then(setWallet).catch(() => {}); }} style={iconBtn} title="Refresh"><RefreshCw size={15} /></button>
            </span>
          )}>
          {orders && (() => {
            // Was filtered to the retired carrier, so every real intracity order since the
            // carrier changed was invisible on this screen.
            const sfx = orders.filter(o => o.carrier === 'SHIPROCKET');
            if (!sfx.length) return <Empty text="No intracity orders yet." />;
            return (
              <>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>Same-city orders delivered by a rider from the nearest store, on Shiprocket Hyperlocal. There is no shipping label to print — the rider collects from the store — so tracking is the live status trail.</p>
                <Table head={['Order', 'Customer', 'AWB', 'Status', 'Documents']}>
                  {sfx.map(o => {
                    const trackData = trackResult[o.id] as { status?: string; scans?: { time: string; event: string }[] } | undefined;
                    return (
                      <tr key={o.id}>
                        <td style={td}><strong style={{ color: 'var(--text-link)' }}>{o.orderNumber}</strong><br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-2xs)' }}>{o.orderStatus}</span></td>
                        <td style={td}>{o.address?.fullName || '—'}<br /><span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)' }}>{o.address?.city} · {o.address?.pincode}</span></td>
                        <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{o.delhiveryWaybill || '—'}</span></td>
                        <td style={td}><Badge text={o.shipmentStatus || 'NOT_CREATED'} ok={o.shipmentStatus === 'DELIVERED'} /></td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          {o.delhiveryWaybill ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button title="Track" onClick={async () => {
                                const r = await adminTrackOrder(o.id).catch(() => null);
                                if (r?.ok) setTrackResult(p => ({ ...p, [o.id]: { status: r.status || 'No status', scans: r.scans || [] } }));
                                else setTrackResult(p => ({ ...p, [o.id]: { status: `Error: ${r?.reason || 'unknown'}` } }));
                              }} style={iconBtn}><ExternalLink size={14} /></button>
                              {/* Hyperlocal has no printable document — the rider collects
                                  from the store — so the public tracking page is the artefact. */}
                              {o.trackingUrl && (
                                <a href={o.trackingUrl} target="_blank" rel="noreferrer" title="Open Shiprocket tracking page" style={{ ...iconBtn, display: 'inline-grid' }}><FileText size={14} /></a>
                              )}
                            </div>
                          ) : <span style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-sm)' }}>No shipment</span>}
                          {trackData && (
                            <div style={{ marginTop: 6, background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 12px', maxWidth: 340, whiteSpace: 'normal' }}>
                              <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-xs)', marginBottom: trackData.scans?.length ? 6 : 0 }}>{trackData.status}</div>
                              {(trackData.scans || []).slice(0, 5).map((s, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                                  <span style={{ flex: 'none', color: 'var(--text-subtle)', minWidth: 110 }}>{s.time ? new Date(s.time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                                  <span>{s.event}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </>
            );
          })()}
          {orders === null && <button onClick={() => adminGetOrders().then(setOrders).catch(() => setOrders([]))} style={addBtn}>Load orders</button>}
        </Panel>
        </>
      )}
    </div>
  );
}
