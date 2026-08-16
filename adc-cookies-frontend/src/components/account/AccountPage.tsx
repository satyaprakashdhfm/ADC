'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getOrders, getAddresses, addAddress, updateAddress, deleteAddress as apiDeleteAddress, trackOrderShipment, getSpinStatus, getOrderTracking, type DelhiveryTrackResult, type Address, type Order, type SpinClaim } from '@/lib/api';
import dynamic from 'next/dynamic';

// Leaflet needs a window, and this only renders inside an open address form.
const AddressWizard = dynamic(() => import('@/components/ordering/ui/AddressWizard'), {
  ssr: false,
  loading: () => <div style={{ height: 260, borderRadius: 'var(--radius-card)', background: 'var(--surface-sunken)' }} />,
});
import { OrderNextStep } from '@/lib/orderNextStep';
import OrderProgress, { type ProgressEvent } from './OrderProgress';
import {
  parseOptions, optionList, hasGift, giftMessage, statusColor, formatMoney, formatDate,
  friendlyDate, formatPhone, national10, shipStage, isCancelledStatus, isDeadShipment, whenLabel,
} from '@/lib/orderFormat';
import LoginModal from '@/components/ordering/LoginModal';
import SiteHeader from '@/components/storefront/SiteHeader';
import Footer from '@/components/storefront/Footer';
import {
  Pencil, Check, X, RotateCcw, Home, Briefcase, Plus, Trash2,
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


/* The account page used to carry its own copy of the address form. That second copy is exactly
   what caused the coordinate bug: it had no latitude or longitude in its state, so opening an
   address here and saving it threw the delivery point away, and fixing an address was the way to
   break it. One editor now, shared with checkout — see AddressWizard. */

function ShipmentTracker({ order }: { order: Order }) {
  const [trackResult, setTrackResult] = useState<DelhiveryTrackResult | null>(null);
  const [tracking, setTracking] = useState(false);
  const [err, setErr] = useState('');
  /* Our own record of the order, which the carrier does not have: paid, accepted by the store,
     baked, packed. Half the timeline happens before a courier has ever heard of it. */
  const [ourEvents, setOurEvents] = useState<ProgressEvent[]>([]);
  useEffect(() => { getOrderTracking(order.id).then(setOurEvents).catch(() => {}); }, [order.id]);

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

  // Backend normalizes BOTH carriers (Delhivery + Shiprocket) into { status, scans:[{time,event}] }.
  const latestStatus = trackResult?.status || trackResult?.data?.ShipmentData?.[0]?.Shipment?.Status?.Status || null;
  const rawScans = trackResult?.scans ?? [];
  const delivered = order.orderStatus === 'DELIVERED' || shipStage(latestStatus || order.shipmentStatus) >= 3;
  const address = order.address;
  // Drop scans equal to the current status and collapse duplicates so the timeline shows real progress only.
  /* Two sources, one list. Ours covers everything before a courier existed — paid, accepted at the
     store, packed — and the carrier's covers everything after. Neither alone is the order. */
  const cancelled = isCancelledStatus(order.orderStatus) || isDeadShipment(order.shipmentStatus);
  const allEvents: ProgressEvent[] = [
    ...ourEvents,
    ...rawScans
      .filter(s => s?.event && s?.time)
      .map(s => ({ status: s.event as string, remarks: s.event as string, createdAt: s.time as string })),
  ];

  const seenScan = new Set<string>();
  const timelineScans = rawScans.filter(s => {
    const t = s?.event || '';
    if (!t || t === latestStatus || seenScan.has(t)) return false;
    seenScan.add(t);
    return true;
  });

  return (
    <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14, marginTop: 10 }}>
      {/* The stepper first — "where is it" is the question people open this page to ask, and a
          sentence answers it less quickly than four marks with the line filled in. The sentence is
          still here, under it, because it says the thing a stepper cannot: what happens next. */}
      <OrderProgress
        events={allEvents}
        cancelled={cancelled}
        eta={order.estimatedDelivery ? `Arriving by ${friendlyDate(order.estimatedDelivery)}` : null}
      />
      <OrderNextStep orderStatus={order.orderStatus} shipmentStatus={latestStatus || order.shipmentStatus} bookingStatus={order.shipmentStatus} carrier={order.carrier} paymentStatus={order.paymentStatus} hasStore={!!order.store} storeAccepted={!!order.store?.acceptedAt} style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {order.delhiveryWaybill && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
            Waybill: <span style={{ fontFamily: 'monospace', color: 'var(--text-strong)' }}>{order.delhiveryWaybill}</span>
          </span>
        )}
        {order.delhiveryWaybill ? (
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
      {/* The four-stage ladder and the flat scan list that used to live here are gone: they said
          the same thing OrderProgress says above, twice, one of them behind a "See all updates"
          toggle. Two timelines on one screen is how they drift apart. */}
      {trackResult && !trackResult.tracked && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 8 }}>Tracking not available yet. Try again in a few minutes.</p>
      )}
    </div>
  );
}

function OrderCard({ order, onReorder }: { order: Order; onReorder: () => void }) {
  // Cancellation is terminal — if either the order OR the shipment is cancelled/RTO/returned,
  // show CANCELLED, never a stale "Delivered". Keeps the badge, meta line and refund note in sync.
  const cancelled = isCancelledStatus(order.orderStatus) || isDeadShipment(order.shipmentStatus);
  // The courier booking was pulled while the order itself is still live — being rebooked, not
  // cancelled. Saying "Cancelled" to someone whose cookies are still coming is the worse error.
  const rebooking = !cancelled && isCancelledStatus(order.shipmentStatus);
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
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.45, fontSize: 'var(--text-sm)' }}>{formatDate(order.createdAt)} · {itemCount || items.length} item{(itemCount || items.length) === 1 ? '' : 's'} · {cancelled ? 'Cancelled' : rebooking ? 'Arranging a new courier' : (order.shipmentStatus || 'Preparing shipment')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>{formatMoney(order.totalAmount)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {items.map((item) => {
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }} className="account-order-detail-grid">
          <div style={{ padding: 14, borderRadius: 18, background: 'var(--surface-sunken)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-base)', marginBottom: 9, flexWrap: 'wrap' }}>
              <Truck size={17} /> Delivery details
              {order.carrier && (
                <span style={{ padding: '2px 9px', borderRadius: 'var(--radius-pill)', background: order.carrier === 'SHIPROCKET' ? 'var(--amber-100)' : 'var(--surface-card)', border: order.carrier === 'SHIPROCKET' ? 'none' : '1px solid var(--border-default)', color: order.carrier === 'SHIPROCKET' ? 'var(--amber-800)' : 'var(--text-muted)', fontSize: 'var(--text-2xs)', fontWeight: 900 }}>
                  {order.carrier === 'SHIPROCKET' ? 'Intracity · Same-day' : 'Pan-India · Delhivery'}
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

  // Arriving here signed out (e.g. tapping "Orders" in the navbar) used to silently bounce back
  // to the homepage with no explanation. Ask them to log in instead — that's what they came here
  // to do — and open the modal immediately since seeing past orders was the whole point of the click.
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    if (loading || user) return;
    // Deferred by a tick: opening the modal synchronously inside the effect re-renders before the
    // page behind it has painted, so the sheet appears over a blank card for a frame.
    const t = setTimeout(() => setLoginOpen(true), 0);
    return () => clearTimeout(t);
  }, [loading, user]);

  const [editing, setEditing] = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addingAddr, setAddingAddr] = useState(false);
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrErr, setAddrErr] = useState('');
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

  // The header's "Track" button links straight here (/account#orders) so tapping it lands on an
  // order's actual status, not just the account page in general. Waits for `orders` to render
  // (the section is empty/loading beforehand) before scrolling, since the browser's own
  // hash-scroll fires too early against content that hasn't laid out yet.
  useEffect(() => {
    if (orders === null || orders.length === 0) return;
    if (typeof window === 'undefined' || window.location.hash !== '#orders') return;
    document.getElementById('orders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [orders]);

  const copySpinCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopiedSpin(true); setTimeout(() => setCopiedSpin(false), 1800); } catch { /* ignore */ }
  };

  if (loading) return null;

  if (!user) {
    return (
      <main className="adc-pattern-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <SiteHeader />
        {/* The card centres in whatever space is left between header and footer — not in the
            viewport, which would have centred the header and footer along with it. */}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}>
        <div style={{ ...card, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center', display: 'grid', gap: 14, justifyItems: 'center' }}>
          <h1 style={{ ...sectionTitle, fontSize: 'var(--text-h4)' }}>Log in to see your orders</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
            Sign in to view past orders, track deliveries, and manage your saved addresses.
          </p>
          <button onClick={() => setLoginOpen(true)} style={{ marginTop: 4, padding: '11px 22px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
            Log in
          </button>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', cursor: 'pointer', textDecoration: 'underline' }}>
            Back to home
          </button>
        </div>
        </div>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        <Footer />
      </main>
    );
  }

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

  /* These four used to change React state and nothing else — no request left the browser. Editing
     an address in the account looked exactly like it had saved, until a reload put the old one
     back, or until checkout read the row and found the point still missing. An add that failed
     invented an id from the clock and carried on. */
  const handleAddAddress = async (data: Omit<Address, 'id'>) => {
    setAddrBusy(true); setAddrErr('');
    try {
      const created = await addAddress(data);
      setAddresses(prev => normalizeDefault([...prev, created], data.isDefault ? created.id : undefined));
      setAddingAddr(false);
    } catch (e) {
      setAddrErr(e instanceof Error ? e.message : 'Could not save this address. Please try again.');
    } finally { setAddrBusy(false); }
  };

  const handleEditAddress = async (id: number, data: Omit<Address, 'id'>) => {
    setAddrBusy(true); setAddrErr('');
    try {
      const saved = await updateAddress(id, data);
      setAddresses(prev => normalizeDefault(prev.map(a => (a.id === id ? saved : a)), data.isDefault ? id : undefined));
      setEditingAddr(null);
    } catch (e) {
      setAddrErr(e instanceof Error ? e.message : 'Could not save this address. Please try again.');
    } finally { setAddrBusy(false); }
  };

  const deleteAddress = async (id: number) => {
    const before = addresses;
    setAddresses(prev => prev.filter(a => a.id !== id));
    try { await apiDeleteAddress(id); } catch { setAddresses(before); setAddrErr('Could not delete that address.'); }
  };

  const makeDefault = async (id: number) => {
    const target = addresses.find(a => a.id === id);
    if (!target) return;
    setAddresses(prev => normalizeDefault(prev, id));
    try {
      const { id: _drop, ...rest } = target;
      void _drop;
      await updateAddress(id, { ...rest, isDefault: true });
    } catch { setAddrErr('Could not set that as your default address.'); }
  };

  return (
    <main className="adc-pattern-page order-cards" style={{ minHeight: '100vh' }}>
      {/* The shared navbar, not a bespoke one. This page used to carry its own header — back arrow,
          logo, "My Account" — which meant arriving here dropped the customer out of the site's
          navigation entirely. The <h1> in the profile card below already names the page. */}
      <SiteHeader />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px var(--gutter) 64px' }}>
        <section style={{ display: 'grid', gridTemplateColumns: '330px minmax(0,1fr)', gap: 24, alignItems: 'start' }} className="account-layout">
          <aside style={{ display: 'grid', gap: 16, position: 'sticky', top: 96 }} className="account-sidebar">
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
            <section id="orders">
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
                  <OrderCard key={o.id} order={o} onReorder={() => router.push('/order')} />
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
                  <AddressWizard key={a.id} initial={a} saving={addrBusy} error={addrErr} onSave={d => handleEditAddress(a.id, d)} onCancel={() => { setAddrErr(''); setEditingAddr(null); }} />
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
              {addingAddr && <div style={{ marginTop: 12 }}><AddressWizard saving={addrBusy} error={addrErr} onSave={handleAddAddress} onCancel={() => { setAddrErr(''); setAddingAddr(false); }} /></div>}
            </section>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}

function normalizeDefault(list: Address[], preferId?: number): Address[] {
  if (preferId != null) return list.map(a => ({ ...a, isDefault: a.id === preferId }));
  if (list.some(a => a.isDefault)) return list;
  return list.map((a, i) => ({ ...a, isDefault: i === 0 }));
}
