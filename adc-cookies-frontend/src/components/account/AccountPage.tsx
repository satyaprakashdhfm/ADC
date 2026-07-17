'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getOrders, getAddresses, addAddress, trackOrderShipment, getSpinStatus, type DelhiveryTrackResult, type Address, type Order, type OrderItem, type SpinClaim } from '@/lib/api';
import { OrderNextStep } from '@/lib/orderNextStep';
import {
  ChevronLeft, Pencil, Check, X, RotateCcw, Home, Briefcase, Plus, Trash2,
  Info, LifeBuoy, ChevronRight, LogOut, ShoppingBag, MapPin, Gift,
  MessageSquare, ReceiptText, PackageCheck, Truck, CreditCard, Copy, Clock,
} from 'lucide-react';

const card: React.CSSProperties = {
  background: 'var(--panel-92)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-sm)',
};

const sectionTitle: React.CSSProperties = {
  font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)',
  color: 'var(--text-strong)',
};

type ParsedOptions = {
  giftPackaging?: boolean;
  giftWrap?: boolean;
  giftMessage?: string;
  message?: string;
  specialNotes?: string;
  addOns?: string[];
  addons?: string[];
  [key: string]: unknown;
};

function AddressForm({ initial, onSave, onCancel }: { initial?: Address; onSave: (a: Omit<Address, 'id'>) => void; onCancel: () => void }) {
  const [f, setF] = useState<Omit<Address, 'id'>>({
    fullName: initial?.fullName ?? '', phone: initial?.phone ?? '',
    addressLine1: initial?.addressLine1 ?? '', addressLine2: initial?.addressLine2 ?? '',
    city: initial?.city ?? '', state: initial?.state ?? '', pincode: initial?.pincode ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
  const valid = f.fullName && f.phone && f.addressLine1 && f.city && f.pincode;

  return (
    <div style={{ ...card, padding: 16, display: 'grid', gap: 10 }}>
      <input style={inp} placeholder="Full name" value={f.fullName} onChange={set('fullName')} />
      <input style={inp} placeholder="Phone" value={f.phone} onChange={set('phone')} />
      <input style={inp} placeholder="Flat / House / Building" value={f.addressLine1} onChange={set('addressLine1')} />
      <input style={inp} placeholder="Area / Landmark" value={f.addressLine2} onChange={set('addressLine2')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 10 }} className="account-address-grid">
        <input style={inp} placeholder="City" value={f.city} onChange={set('city')} />
        <input style={inp} placeholder="State" value={f.state} onChange={set('state')} />
        <input style={inp} placeholder="Pincode" value={f.pincode} onChange={set('pincode')} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--text-body)', cursor: 'pointer' }}>
        <input type="checkbox" checked={f.isDefault} onChange={e => setF({ ...f, isDefault: e.target.checked })} /> Set as default
      </label>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button disabled={!valid} onClick={() => onSave(f)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', border: 'none', background: valid ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: valid ? 'pointer' : 'not-allowed' }}>Save address</button>
        <button onClick={onCancel} style={{ padding: '10px 16px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

function parseOptions(raw?: string | null): ParsedOptions {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ParsedOptions : {};
  } catch {
    return {};
  }
}

function optionList(options: ParsedOptions) {
  const addOns = Array.isArray(options.addOns) ? options.addOns : Array.isArray(options.addons) ? options.addons : [];
  return addOns.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function hasGift(options: ParsedOptions) {
  return Boolean(options.giftPackaging || options.giftWrap);
}

function giftMessage(item: OrderItem, options: ParsedOptions) {
  const msg = options.giftMessage || options.message || options.specialNotes || item.specialNotes;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : '';
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('deliver')) return { bg: 'var(--status-success-bg)', fg: 'var(--status-success)' };
  if (s.includes('cancel')) return { bg: 'var(--status-error-bg)', fg: 'var(--status-error)' };
  return { bg: 'var(--amber-100)', fg: 'var(--amber-800)' };
}

function formatMoney(value?: number | null) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const _WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function friendlyDate(s?: string | null): string | null {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s);
  return `${_WD[d.getDay()]}, ${d.getDate()} ${_MO[d.getMonth()]}`;
}

// Stored canonically as 91XXXXXXXXXX — show it as "+91 XXXXXXXXXX".
function formatPhone(value?: string | null) {
  const p = String(value ?? '');
  if (/^91\d{10}$/.test(p)) return `+91 ${p.slice(2)}`;
  if (/^\d{10}$/.test(p)) return `+91 ${p}`;
  return p;
}
const national10 = (value?: string | null) => {
  const p = String(value ?? '');
  return /^91\d{10}$/.test(p) ? p.slice(2) : p;
};

// Fixed delivery milestones, and which one a carrier status has reached (0..3).
const SHIP_STAGES = ['Order placed', 'Shipped', 'Out for delivery', 'Delivered'];
function shipStage(s?: string | null): number {
  const t = (s || '').toLowerCase();
  if (!t) return -1;
  if ((t.includes('deliver') && !t.includes('out for') && !t.includes('attempt') && !t.includes('undeliver')) || t.includes('rts_d')) return 3;
  if (t.includes('out for') || t === 'ofd' || t.includes('out_for') || t.includes('dispatch')) return 2;
  if (t.includes('transit') || t.includes('shipped') || t.includes('picked') || t.includes('packed') || t.includes('manifest') || t.includes('bag') || t.includes('hub')) return 1;
  return 0; // placed / confirmed / new / preparing / pending
}
const isCancelledStatus = (s?: string | null) => /cancel|\brto\b|returned|lost/i.test(s || '');
function whenLabel(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const time = d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? `Today, ${time}`
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ShipmentTracker({ order }: { order: Order }) {
  const [trackResult, setTrackResult] = useState<DelhiveryTrackResult | null>(null);
  const [tracking, setTracking] = useState(false);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);

  const doTrack = async () => {
    setTracking(true); setErr('');
    try {
      const r = await trackOrderShipment(order.id);
      setTrackResult(r);
    } catch {
      setErr('Could not fetch tracking. Please try again.');
    }
    setTracking(false);
  };

  const openLiveTracking = async () => {
    setLiveOpen(true);
    await doTrack();
  };

  // Backend normalizes BOTH carriers (Delhivery + Shadowfax) into { status, scans:[{time,event}] }.
  const latestStatus = trackResult?.status || trackResult?.data?.ShipmentData?.[0]?.Shipment?.Status?.Status || null;
  const rawScans = trackResult?.scans ?? [];
  const isShadowfax = order.carrier === 'SHADOWFAX';
  const delivered = order.orderStatus === 'DELIVERED' || shipStage(latestStatus || order.shipmentStatus) >= 3;
  const address = order.address;
  const mapQuery = address
    ? [address.addressLine1, address.addressLine2, address.city, address.state, address.pincode].filter(Boolean).join(', ')
    : order.delhiveryWaybill || 'Bengaluru';
  // Drop scans equal to the current status and collapse duplicates so the timeline shows real progress only.
  const seenScan = new Set<string>();
  const timelineScans = rawScans.filter(s => {
    const t = s?.event || '';
    if (!t || t === latestStatus || seenScan.has(t)) return false;
    seenScan.add(t);
    return true;
  });

  return (
    <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14, marginTop: 10 }}>
      <OrderNextStep orderStatus={order.orderStatus} shipmentStatus={latestStatus || order.shipmentStatus} carrier={order.carrier} paymentStatus={order.paymentStatus} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {order.delhiveryWaybill && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
            Waybill: <span style={{ fontFamily: 'monospace', color: 'var(--text-strong)' }}>{order.delhiveryWaybill}</span>
          </span>
        )}
        {order.delhiveryWaybill && isShadowfax && !delivered ? (
          <button onClick={openLiveTracking} disabled={tracking} style={{ padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'var(--brand-secondary)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 900, fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: tracking ? 'default' : 'pointer' }}>
            <MapPin size={14} /> {tracking ? 'Loading live…' : 'Live tracking'}
          </button>
        ) : order.delhiveryWaybill ? (
          <button onClick={doTrack} disabled={tracking} style={{ padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: tracking ? 'default' : 'pointer', fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Truck size={14} /> {tracking ? 'Tracking…' : 'Track shipment'}
          </button>
        ) : (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Shipment being prepared…</span>
        )}
        <a href="/contact" style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-link)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <LifeBuoy size={13} /> Need help or want to cancel? Contact us
        </a>
      </div>
      {err && <p style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)', marginTop: 8, fontWeight: 700 }}>{err}</p>}
      {isShadowfax && liveOpen && !delivered && (
        <div style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', background: 'var(--surface-card)', border: '1px solid var(--border-soft)' }}>
          <iframe
            title={`Live delivery area for ${order.orderNumber}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ width: '100%', height: 220, border: 0, display: 'block', background: 'var(--surface-sunken)' }}
          />
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--status-success)', boxShadow: '0 0 0 4px var(--green-veg-14)' }} />
              <strong style={{ color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{latestStatus || order.shipmentStatus || 'Tracking order'}</strong>
              <button onClick={doTrack} disabled={tracking} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-link)', fontWeight: 900, fontSize: 'var(--text-xs)', cursor: tracking ? 'default' : 'pointer', fontFamily: 'var(--font-body)' }}>
                {tracking ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            {timelineScans[0] && (
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', lineHeight: 1.45 }}>
                Latest update: <strong style={{ color: 'var(--text-body)' }}>{timelineScans[0].event}</strong>{timelineScans[0].time ? ` · ${whenLabel(timelineScans[0].time)}` : ''}
              </p>
            )}
            <p style={{ margin: '7px 0 0', color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', lineHeight: 1.45 }}>
              Map shows the delivery area. Rider GPS is not exposed by Shadowfax, so live movement updates appear as status scans here.
            </p>
          </div>
        </div>
      )}
      {trackResult && trackResult.tracked && (() => {
        const cancelled = isCancelledStatus(latestStatus) || order.orderStatus === 'CANCELLED';
        const reached = cancelled ? -1 : Math.max(shipStage(latestStatus), shipStage(order.orderStatus), 0);
        const latestScan = timelineScans[0] || null; // newest first
        const expectedDate = order.estimatedDelivery ? friendlyDate(order.estimatedDelivery) : null;
        return (
          <div style={{ marginTop: 12, background: 'var(--surface-sunken)', borderRadius: 14, padding: '16px 16px 14px' }}>
            {cancelled ? (
              <span style={{ padding: '4px 11px', borderRadius: 'var(--radius-pill)', background: 'var(--status-error-bg)', color: 'var(--status-error)', fontSize: 'var(--text-xs)', fontWeight: 900 }}>{latestStatus || 'Cancelled'}</span>
            ) : (
              <>
                {SHIP_STAGES.map((label, i) => {
                  const done = i <= reached;
                  const current = i === reached;
                  const isLast = i === SHIP_STAGES.length - 1;
                  const sub = current && latestScan?.time ? whenLabel(latestScan.time)
                    : isLast && !done && expectedDate ? `Expected by ${expectedDate}`
                    : '';
                  return (
                    <div key={label} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', background: done ? 'var(--status-success)' : 'var(--surface-card)', border: done ? 'none' : '2px solid var(--border-strong)', color: 'var(--white)' }}>
                          {done && <Check size={13} strokeWidth={3} />}
                        </span>
                        {!isLast && <span style={{ width: 2, flex: 1, minHeight: 22, background: i < reached ? 'var(--status-success)' : 'var(--border-strong)' }} />}
                      </div>
                      <div style={{ paddingBottom: isLast ? 0 : 12 }}>
                        <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: done ? 'var(--text-strong)' : 'var(--text-muted)' }}>{label}</div>
                        {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
                      </div>
                    </div>
                  );
                })}
                {timelineScans.length > 0 && (
                  <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 4, border: 'none', background: 'transparent', color: 'var(--text-link)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>
                    {showAll ? 'Hide updates' : 'See all updates ›'}
                  </button>
                )}
                {showAll && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border-soft)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {timelineScans.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-secondary)', marginTop: 5, flex: 'none' }} />
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{s.event}</div>
                          {s.time && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{whenLabel(s.time)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
      {trackResult && !trackResult.tracked && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 8 }}>Tracking not available yet. Try again in a few minutes.</p>
      )}
    </div>
  );
}

function OrderCard({ order, expanded, onToggle, onReorder }: { order: Order; expanded: boolean; onToggle: () => void; onReorder: () => void }) {
  // Cancellation is terminal — if either the order OR the shipment is cancelled/RTO/returned,
  // show CANCELLED, never a stale "Delivered". Keeps the badge, meta line and refund note in sync.
  const cancelled = isCancelledStatus(order.orderStatus) || isCancelledStatus(order.shipmentStatus);
  const displayStatus = cancelled ? 'Cancelled' : order.orderStatus;
  const colors = statusColor(cancelled ? 'cancelled' : order.orderStatus);
  const items = order.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const giftCount = items.filter((item) => hasGift(parseOptions(item.selectedOptions))).length;
  const messages = items.map((item) => giftMessage(item, parseOptions(item.selectedOptions))).filter(Boolean);
  const address = order.address;

  return (
    <article style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ width: 46, height: 46, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--amber-50)', color: 'var(--brand-secondary)', flex: 'none' }}>
          <PackageCheck size={22} />
        </span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
            <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: colors.bg, color: colors.fg, fontSize: 'var(--text-xs)', fontWeight: 900 }}>{displayStatus}</span>
            <span style={{ padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 800 }}>{order.paymentStatus}</span>
            {giftCount > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-xs)', fontWeight: 900 }}><Gift size={12} /> Gift packed</span>}
          </div>
          <h2 style={{ fontSize: 'var(--text-h4)', marginBottom: 5 }}>Order {order.orderNumber}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.45, fontSize: 'var(--text-sm)' }}>{formatDate(order.createdAt)} · {itemCount || items.length} item{(itemCount || items.length) === 1 ? '' : 's'} · {cancelled ? 'Cancelled' : (order.shipmentStatus || 'Preparing shipment')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>{formatMoney(order.totalAmount)}</div>
          <button onClick={onToggle} style={{ marginTop: 10, padding: '8px 13px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 800, color: 'var(--text-body)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>{expanded ? 'Hide details' : 'View full details'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {(expanded ? items : items.slice(0, 2)).map((item) => {
          const options = parseOptions(item.selectedOptions);
          const addOns = optionList(options);
          const message = giftMessage(item, options);
          return (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, padding: '11px 0', borderTop: '1px solid var(--border-soft)' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{item.productName}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>x {item.quantity}</span>
                  {hasGift(options) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand-secondary)', fontSize: 'var(--text-xs)', fontWeight: 900 }}><Gift size={13} /> gift packed</span>}
                </div>
                {addOns.length > 0 && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 5 }}>Add-ons: {addOns.join(', ')}</p>}
                {item.specialNotes && <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 5 }}>Kitchen note: {item.specialNotes}</p>}
                {message && (
                  <p style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-body)', fontSize: 'var(--text-sm)', marginTop: 7, padding: '7px 9px', borderRadius: 14, background: 'var(--amber-50)' }}>
                    <MessageSquare size={14} color="var(--brand-secondary)" /> Gift message: {message}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', color: 'var(--text-strong)', fontWeight: 900, fontSize: 'var(--text-sm)' }}>
                {formatMoney(item.totalPrice ?? item.unitPrice * item.quantity)}
                <div style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', fontWeight: 700, marginTop: 4 }}>{formatMoney(item.unitPrice)} each</div>
              </div>
            </div>
          );
        })}
        {!expanded && items.length > 2 && <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>+ {items.length - 2} more item{items.length - 2 === 1 ? '' : 's'}</div>}
      </div>

      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }} className="account-order-detail-grid">
          <div style={{ padding: 14, borderRadius: 18, background: 'var(--surface-sunken)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-base)', marginBottom: 9, flexWrap: 'wrap' }}>
              <Truck size={17} /> Delivery details
              {order.carrier && (
                <span style={{ padding: '2px 9px', borderRadius: 'var(--radius-pill)', background: order.carrier === 'SHADOWFAX' ? 'var(--amber-100)' : 'var(--surface-card)', border: order.carrier === 'SHADOWFAX' ? 'none' : '1px solid var(--border-default)', color: order.carrier === 'SHADOWFAX' ? 'var(--amber-800)' : 'var(--text-muted)', fontSize: 'var(--text-2xs)', fontWeight: 900 }}>
                  {order.carrier === 'SHADOWFAX' ? 'Intracity · Shadowfax' : 'Pan-India · Delhivery'}
                </span>
              )}
            </h3>
            {address ? (
              <p style={{ color: 'var(--text-body)', lineHeight: 1.6, fontSize: 'var(--text-sm)' }}>{address.fullName} · {address.phone}<br />{[address.addressLine1, address.addressLine2, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Delivery address will appear here once the order is synced.</p>
            )}
            {order.estimatedDelivery && (
              <p style={{ marginTop: 8, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--brand-secondary)' }}>Expected by {friendlyDate(order.estimatedDelivery)}</p>
            )}
            <ShipmentTracker order={order} />
          </div>
          <div style={{ padding: 14, borderRadius: 18, background: 'var(--surface-sunken)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-base)', marginBottom: 9 }}><ReceiptText size={17} /> Bill summary</h3>
            {[
              ['Subtotal', order.subtotal],
              ['Discount', order.discountAmount ? -Number(order.discountAmount) : 0],
              ['Delivery', order.deliveryFee],
              ['Tax', order.taxAmount],
              ['Total paid', order.totalAmount],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', color: label === 'Total paid' ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: label === 'Total paid' ? 900 : 700, marginTop: 6, fontSize: 'var(--text-sm)' }}>
                <span>{label}</span><span>{formatMoney(value as number)}</span>
              </div>
            ))}
            {order.couponCode && <p style={{ color: 'var(--status-success)', fontWeight: 800, marginTop: 8 }}>Coupon applied: {order.couponCode}</p>}
            {order.payment && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4 }}><CreditCard size={13} /> Payment</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {order.payment.provider === 'RAZORPAY' ? 'Razorpay' : order.payment.provider} · {order.payment.status}
                  {order.payment.transactionId && <><br /><span style={{ fontFamily: 'monospace', color: 'var(--text-body)' }}>{order.payment.transactionId}</span></>}
                  {order.payment.paidAt && <><br />Paid on {formatDate(order.payment.paidAt)}</>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={onReorder} style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer', display: 'flex', gap: 7, alignItems: 'center', fontSize: 'var(--text-sm)' }}><RotateCcw size={14} /> Reorder cookies</button>
        {messages.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontWeight: 700 }}><MessageSquare size={15} /> {messages.length} gift message{messages.length === 1 ? '' : 's'} included</span>}
      </div>
    </article>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, updateProfile, logout } = useAuth();

  useEffect(() => { if (!loading && !user) router.replace('/'); }, [loading, user, router]);

  const [editing, setEditing] = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addingAddr, setAddingAddr] = useState(false);
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [spinClaim, setSpinClaim] = useState<SpinClaim | null | undefined>(undefined); // undefined = loading
  const [copiedSpin, setCopiedSpin] = useState(false);

  useEffect(() => {
    if (!user) return;
    getOrders().then(o => setOrders(o ?? [])).catch(() => setOrders([]));
    // Always reflect THIS user's saved addresses (empty if none) — never show sample/other data.
    getAddresses().then(a => setAddresses(a ?? [])).catch(() => setAddresses([]));
    // Any Spin & Win reward they claimed (still within its validity window) — see it here too.
    getSpinStatus().then(r => setSpinClaim(r.active)).catch(() => setSpinClaim(null));
  }, [user]);

  const copySpinCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopiedSpin(true); setTimeout(() => setCopiedSpin(false), 1800); } catch { /* ignore */ }
  };

  if (loading || !user) return null;

  const startEdit = () => { setProfileErr(''); setName(user.name); setPhone(national10(user.phone)); setEditing(true); };
  const saveProfile = async () => {
    setProfileErr(''); setSavingProfile(true);
    try {
      await updateProfile({ name: name.trim() || user.name, phone: phone.trim() || undefined });
      setEditing(false);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };
  const doLogout = () => { logout(); router.push('/'); };

  const handleAddAddress = async (data: Omit<Address, 'id'>) => {
    try {
      const created = await addAddress(data);
      setAddresses(prev => normalizeDefault([...prev, created], data.isDefault ? created.id : undefined));
    } catch {
      const local: Address = { ...data, id: Date.now() };
      setAddresses(prev => normalizeDefault([...prev, local], data.isDefault ? local.id : undefined));
    }
    setAddingAddr(false);
  };

  const handleEditAddress = (id: number, data: Omit<Address, 'id'>) => {
    setAddresses(prev => normalizeDefault(prev.map(a => a.id === id ? { ...data, id } : a), data.isDefault ? id : undefined));
    setEditingAddr(null);
  };
  const deleteAddress = (id: number) => setAddresses(prev => prev.filter(a => a.id !== id));
  const makeDefault = (id: number) => setAddresses(prev => normalizeDefault(prev, id));

  return (
    <main className="adc-pattern-page order-cards" style={{ minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px var(--gutter)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => router.push('/')} aria-label="Back to home" style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><ChevronLeft size={20} /></button>
          <Link href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <Image src="/assets/adc-logo.png" height={66} width={112} alt="a dough cookie" style={{ objectFit: 'contain' }} />
          </Link>
          <span style={{ ...sectionTitle, fontSize: 'var(--text-h4)' }}>My Account</span>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px var(--gutter) 64px' }}>
        <section style={{ display: 'grid', gridTemplateColumns: '330px minmax(0,1fr)', gap: 24, alignItems: 'start' }} className="account-layout">
          <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 92 }} className="account-sidebar">
            <div style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', fontSize: 'var(--text-h3)', fontWeight: 900, flex: 'none' }}>{user.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 'var(--text-h4)', marginBottom: 3 }}>{user.name}</h1>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{user.email}</p>
                  {user.phone && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{formatPhone(user.phone)}</p>}
                </div>
                {!editing && <button onClick={startEdit} aria-label="Edit profile" style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><Pencil size={15} /></button>}
              </div>
              {!editing && !user.phone && (
                <button onClick={startEdit} style={{ marginTop: 13, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px dashed var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <Plus size={15} /> Add your phone number for order updates
                </button>
              )}
              {editing && (
                <div style={{ marginTop: 15, display: 'grid', gap: 9 }}>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" style={{ width: '100%', padding: '11px 13px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" style={{ width: '100%', padding: '11px 13px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>Email cannot be changed from this page.</div>
                  {profileErr && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)' }}>{profileErr}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={saveProfile} disabled={savingProfile} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-button)', border: 'none', background: savingProfile ? 'var(--border-default)' : 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: savingProfile ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Check size={15} /> {savingProfile ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => { setEditing(false); setProfileErr(''); setName(user.name); setPhone(national10(user.phone)); }} style={{ padding: '10px 14px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><X size={15} /> Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {spinClaim && (
              <div style={{ ...card, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Gift size={16} color="var(--white)" /></span>
                  <span style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Your Spin &amp; Win reward</span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 10px' }}>{spinClaim.label}</p>
                <button onClick={() => copySpinCode(spinClaim.code)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-button)', border: '2px dashed var(--brand-secondary)', background: 'var(--amber-50)', cursor: 'pointer', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-base)', letterSpacing: '.06em', color: 'var(--brand-secondary)' }}>{spinClaim.code}</span>
                  {copiedSpin ? <Check size={15} color="var(--status-success)" /> : <Copy size={15} color="var(--text-muted)" />}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                  <Clock size={13} /> Valid until {new Date(spinClaim.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            )}

            <div style={{ ...card, padding: '6px 4px' }}>
              {[
                { icon: <MapPin size={18} />, label: 'Order cookies', href: '/order' },
                { icon: <LifeBuoy size={18} />, label: 'Help & support', href: '/contact' },
                { icon: <Info size={18} />, label: 'About A Dough Cookie', href: '/about' },
              ].map(row => (
                <Link key={row.label} href={row.href} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', textDecoration: 'none' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', background: 'var(--amber-50)', flex: 'none', color: 'var(--brand-secondary)' }}>{row.icon}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{row.label}</span>
                  <ChevronRight size={17} color="var(--text-subtle)" />
                </Link>
              ))}
              <button onClick={doLogout} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', background: 'var(--red-wash-soft)', flex: 'none', color: 'var(--red-danger)' }}><LogOut size={17} /></span>
                <span style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--red-danger)' }}>Log out</span>
              </button>
            </div>
          </aside>

          <div style={{ display: 'grid', gap: 24 }}>
            <section>
              <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 6 }}>Order history</p>
                  <h2 style={sectionTitle}>Full order details</h2>
                </div>
                <button onClick={() => router.push('/order')} style={{ padding: '10px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}><ShoppingBag size={16} /> New order</button>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                {orders === null ? (
                  <div style={{ ...card, padding: 20, color: 'var(--text-muted)' }}>Loading your orders...</div>
                ) : orders.length === 0 ? (
                  <div style={{ ...card, padding: 26, textAlign: 'center' }}>
                    <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--amber-50)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--brand-secondary)' }}><ShoppingBag size={26} /></div>
                    <h2 style={{ fontSize: 'var(--text-h4)', marginBottom: 8 }}>No orders yet</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>Once you place an order, this page will show every cookie, gift pack, message, delivery address, and payment detail.</p>
                    <button onClick={() => router.push('/order')} style={{ padding: '10px 20px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 900, cursor: 'pointer' }}>Start an order</button>
                  </div>
                ) : orders.map(o => (
                  <OrderCard key={o.id} order={o} expanded={expanded === o.id} onToggle={() => setExpanded(expanded === o.id ? null : o.id)} onReorder={() => router.push('/order')} />
                ))}
              </div>
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', marginBottom: 6 }}>Delivery</p>
                  <h2 style={sectionTitle}>Saved addresses</h2>
                </div>
                {!addingAddr && <button onClick={() => setAddingAddr(true)} style={{ padding: '8px 13px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 'var(--text-sm)' }}><Plus size={15} /> Add address</button>}
              </div>

              {addresses.length === 0 && !addingAddr && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 12px' }}>No saved addresses yet — add your delivery address to speed up checkout.</p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }} className="account-address-list">
                {addresses.map(a => editingAddr === a.id ? (
                  <AddressForm key={a.id} initial={a} onSave={d => handleEditAddress(a.id, d)} onCancel={() => setEditingAddr(null)} />
                ) : (
                  <div key={a.id} style={{ ...card, padding: 15, display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{a.isDefault ? <Home size={17} color="var(--brand-secondary)" /> : <Briefcase size={17} color="var(--brand-secondary)" />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 900, color: 'var(--text-strong)' }}>{a.isDefault ? 'Home' : 'Work'}</span>
                        {a.isDefault
                          ? <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 900 }}>Default</span>
                          : <button onClick={() => makeDefault(a.id)} style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-link)', fontSize: 'var(--text-2xs)', fontWeight: 900, cursor: 'pointer' }}>Set default</button>}
                      </div>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{[a.addressLine1, a.addressLine2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 5 }}>{a.fullName} · {a.phone}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                      <button onClick={() => setEditingAddr(a.id)} aria-label="Edit address" style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Pencil size={14} /></button>
                      <button onClick={() => deleteAddress(a.id)} aria-label="Delete address" style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--red-danger)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              {addingAddr && <div style={{ marginTop: 12 }}><AddressForm onSave={handleAddAddress} onCancel={() => setAddingAddr(false)} /></div>}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function normalizeDefault(list: Address[], preferId?: number): Address[] {
  if (preferId != null) return list.map(a => ({ ...a, isDefault: a.id === preferId }));
  if (list.some(a => a.isDefault)) return list;
  return list.map((a, i) => ({ ...a, isDefault: i === 0 }));
}
