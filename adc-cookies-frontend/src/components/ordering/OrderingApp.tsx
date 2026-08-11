'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, X, ShoppingBag, Check, ArrowRight, Gift, MapPin, CreditCard, Home, Briefcase, Lock, Tag, Receipt, Clock, Plus, Cookie, Navigation, Truck, Pencil, AlertTriangle } from 'lucide-react';
import { productAvailableFor } from '@/lib/stores';
import { useLocation } from '@/context/LocationContext';
import SiteHeader from '@/components/storefront/SiteHeader';
import Footer from '@/components/storefront/Footer';
import { useCart, GIFT_FEE } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import LoginModal from './LoginModal';
import MascotLoader from '@/components/MascotLoader';
import { firstImage } from '@/lib/api';
import { formatRemaining } from '@/lib/spinReward';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { INDIAN_STATES, PIN_RE, PHONE_RE } from '@/lib/indiaAddress';
import { useUpsellCatalog } from '@/hooks/checkout/useUpsellCatalog';
import { useDeliveryCheck } from '@/hooks/checkout/useDeliveryCheck';
import { useCheckoutCoupons } from '@/hooks/checkout/useCheckoutCoupons';
import { useCheckoutAddresses } from '@/hooks/checkout/useCheckoutAddresses';
import { useCheckoutPayment } from '@/hooks/checkout/useCheckoutPayment';
import { WEEKDAYS as _WD, MONTHS as _MO } from '@/lib/orderFormat';
import { CheckoutStepper, Dot, Dash } from './ui/CheckoutStepper';
import { Thumb, QStepper } from './ui/ProductCards';
import OrderSuccessPage from './OrderSuccessPage';

const fmtDay = (d: Date) => `${_WD[d.getDay()]}, ${d.getDate()} ${_MO[d.getMonth()]}`;
import { whatsappLink, SITE_PHONE } from '@/lib/site';

// STALL MODE — temporary, for the pop-up-stall launch: online payment is switched off and the
// payment step instead points people at WhatsApp/call/in-person ordering. Nothing below this is
// deleted — every bit of the real checkout/payment flow still exists, just not rendered while
// this is true. Flip back to false (and it all comes straight back) once online payment resumes.
const STALL_MODE = false;


/* ---- Data ---- */
function parseServerDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}
function addDays(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d; }

/* ---- Gift occasions — a short, friendly tag on the gift note ---- */
const GIFT_OCCASIONS = ['Birthday', 'Anniversary', 'Wedding', 'Love', 'Thank you', 'Congrats', 'Other'];

/* ---- Checkout progress — Cart › Checkout › Payment, so the page tells you where you are ---- */


/* ---- Checkout flow — one page, two steps: 'review' (address + order) then 'pay' (payment) ---- */
function CheckoutFlow({ step }: { step: 'review' | 'pay' }) {
  const router = useRouter();
  const desktop = useIsDesktop(920);
  const { cart, total, setQty, gift, setGift, giftMessage, setGiftMessage, giftOccasion, setGiftOccasion, addrId: addr, setAddrId: setAddr, coupon, setCoupon, applied, setApplied, discount, setDiscount, giftLineId, setGiftLineId } = useCart();
  const { user } = useAuth();
  const { store: locationStore } = useLocation();
  const {
    addresses, chosen, adding, aform, setAform, editId, makeDefault, setMakeDefault,
    detecting, detectErr, savingAddr, openAddForm, editAddr, closeAddrForm, saveAddr, detectLocation,
  } = useCheckoutAddresses();
  const catalog = useUpsellCatalog();
  const { couponErr, setCouponErr, availableCoupons, mySpinReward, applyCoupon } = useCheckoutCoupons();
  const [loginOpen, setLoginOpen] = useState(false);

  // The cart is client-only (localStorage), so hold cart-derived UI until after mount to avoid a
  // hydration mismatch on first render. Guests are prompted to log in inline / on Pay — no auto-popup.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const { delivCheck, delivChecking } = useDeliveryCheck(chosen?.pincode, chosen?.latitude, chosen?.longitude);

  const lines = Object.values(cart);
  // The real charge, straight from the backend's own quote: Shiprocket's live per-order rate for
  // intracity (varies by address/distance), or the admin-set flat fee for outstation. This is a
  // preview for display only — orders.js recomputes and charges the exact same number
  // authoritatively at order-creation, never trusting whatever the client shows here.
  const intracity = !!(delivCheck && delivCheck.serviceable && delivCheck.intracity);
  const delivery = total > 0 ? (delivCheck?.deliveryFee ?? (intracity ? 0 : 100)) : 0;
  const gstIncl = total > 0 ? Math.round(total - total / 1.05) : 0;  // 5% GST is already inside the prices
  const giftFee = gift ? GIFT_FEE : 0;
  const grand = total + delivery + giftFee - discount;               // GST included in `total`, not added on top
  const {
    placing, payError, payFailMsg, setPayFailMsg, done, orderId, paid,
    placedOrderSummary, pendingPayment, handlePlace,
  } = useCheckoutPayment({ step, chosen, addresses, grand, onNeedLogin: () => setLoginOpen(true) });
  const selected = chosen || addresses[0];                           // fallback only for the pay-step display
  // Pan-India arrival date: prefer the carrier's own date, else today + TAT days.
  const deliverBy = delivCheck && delivCheck.serviceable && !delivCheck.intracity
    ? (parseServerDate(delivCheck.expectedDeliveryDate) || (delivCheck.tat != null ? addDays(delivCheck.tat) : null))
    : null;

  const aset = (k: keyof typeof aform) => (e: React.ChangeEvent<HTMLInputElement>) => setAform({ ...aform, [k]: e.target.value });
  const pinOk = PIN_RE.test(aform.pincode.trim());
  const phoneOk = PHONE_RE.test(aform.phone.replace(/\D/g, ''));
  const stateOk = INDIAN_STATES.some(s => s.toLowerCase() === aform.state.trim().toLowerCase());
  // A phone number is required — Delhivery/Shiprocket can't create a shipment without one, so an
  // address saved without a valid one would silently never ship.
  const aValid = !!(aform.fullName.trim() && phoneOk && aform.addressLine1.trim() && aform.city.trim() && pinOk && stateOk);
  // Can't head to payment without a selected, PIN-valid, serviceable address with a real phone
  // number (older saved addresses may predate that requirement — block those too, not just new ones).
  const chosenPinOk = PIN_RE.test((chosen?.pincode || '').trim());
  const chosenPhoneOk = PHONE_RE.test((chosen?.phone || '').replace(/\D/g, ''));
  // Tier 2 — precise, address-based: once checkDeliveryPin has actually run for the chosen address,
  // this is the real pincode-zone match (see sameDayRestrictions on DeliveryCheck), not the coarse
  // "nearest store" hint the catalog page used before checkout existed. A cart item this address
  // cannot receive blocks proceeding to payment — same guarantee the backend re-checks at order
  // creation, just surfaced here before the customer wastes a trip through Razorpay.
  const restrictionFor = (lineId: string) =>
    delivCheck?.sameDayRestrictions?.find(r => String(r.productId) === String(lineId) && !r.eligible) || null;
  const hasBlockingRestriction = lines.some(l => !!restrictionFor(l.id));
  const canProceed = hydrated && lines.length > 0 && !!chosen && chosenPinOk && chosenPhoneOk
    && (delivCheck ? delivCheck.serviceable : true) && !hasBlockingRestriction;
  const fieldStyle: React.CSSProperties = { flex: '1 1 120px', minWidth: 0, boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
  const hintStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 600 };
  // Coupons are validated on the backend right here at apply-time — so an invalid code is caught
  // now, not later at payment. Only genuinely valid, active codes ever set `applied`.


  // Flat warm-white panels (explicit, so it never picks up the peach --surface-card on this page) —
  // thin border, no chunky shadow, closer to the clean Forever21 / Baudville checkout look.
  const card$: React.CSSProperties = { background: '#fffdf8', borderRadius: 'var(--radius-card)', boxShadow: 'none', border: '1px solid var(--border-default)', padding: 22 };
  const head = (icon: React.ReactNode, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>{icon}<span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>{label}</span></div>
  );

  // Honest arrival line for the success screen — same-day for intra-city, a real date for courier, else generic.
  const successEta = intracity ? 'Arriving today' : deliverBy ? `Arriving ${fmtDay(deliverBy)}` : 'On its way — we’ll email tracking updates';
  if (done) return <OrderSuccessPage show total={paid} orderId={orderId} eta={successEta} summary={placedOrderSummary} pendingPayment={pendingPayment} onBackToMenu={() => router.push('/')} onViewOrder={() => router.push('/account')} />;

  if (placing) return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, textAlign: 'center' }}>
      <MascotLoader label="Processing payment…" size={96} />
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Please don&apos;t close this page</div>
    </div>
  );

  const orderSummary = (
    <div style={card$}>
      {head(<ShoppingBag size={18} color="var(--brand-secondary)" />, 'Order summary')}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lines.map((l, i) => {
          const restriction = restrictionFor(l.id);
          return (
          <div key={l.id} className="co-line" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 0', borderBottom: i < lines.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            {l.img
              ? <div onClick={() => router.push(`/?q=${encodeURIComponent(l.name)}`)} title={`View ${l.name}`} className="co-line__img" style={{ width: 112, height: 112, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flex: 'none', cursor: 'pointer' }}><Image src={l.img} alt={l.name} width={112} height={112} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
              : <Thumb size={112} seed={i} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => router.push(`/?q=${encodeURIComponent(l.name)}`)} role="link" tabIndex={0} title={`View ${l.name}`} style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)', lineHeight: 1.25, cursor: 'pointer' }}>{l.name}</div>
              {/* The catalog blurb, so the summary reads like the product card rather than a bare
                  line item — it also fills the column instead of leaving a tall empty gap. */}
              {(() => {
                const desc = catalog.find(p => String(p.id) === String(l.id) || p.name === l.name)?.description;
                return desc ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</div> : null;
              })()}
              {l.addOns && l.addOns.length > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 600, marginTop: 3 }}>+ {l.addOns.join(', ')}</div>}
              {l.note && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontStyle: 'italic' }}>&ldquo;{l.note}&rdquo;</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 900, color: 'var(--text-strong)' }}>₹{l.price}</span>
                <QStepper value={l.qty} onChange={n => setQty(l.id, n, l.name, l.price, l.img)} size="sm" />
              </div>
              {applied && l.id === giftLineId && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--green-success)', fontWeight: 800, marginTop: 4 }}>🎁 Free — your spin reward</div>}
              {restriction && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#fdecec', color: '#a4231d', fontSize: 'var(--text-xs)', fontWeight: 700, lineHeight: 1.4 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Not deliverable to this address — {restriction.reason} Remove it to continue, or choose a different address.</span>
                </div>
              )}
            </div>
          </div>
          );
        })}
        {lines.length === 0 && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '8px 0' }}>Your cart is empty.</div>}
      </div>
      {/* Delivery promise — EXPRESS badge + a real date, like the big marketplaces */}
      {lines.length > 0 && delivCheck && delivCheck.serviceable && (delivCheck.intracity || deliverBy) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-2xs)', letterSpacing: '.05em', flex: 'none' }}>
            <Truck size={13} /> {delivCheck.intracity ? 'SAME-DAY' : 'EXPRESS'}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>
            {delivCheck.intracity
              ? `Delivery today, ${fmtDay(new Date())}`
              : `Delivery ${delivCheck.tat != null ? `in ${delivCheck.tat} day${delivCheck.tat !== 1 ? 's' : ''}, ` : 'by '}${_WD[deliverBy!.getDay()]}`}
          </span>
        </div>
      )}
    </div>
  );

  const billCard = (
    <div style={card$}>
      {head(<Receipt size={18} color="var(--brand-secondary)" />, 'Bill details')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>
          <span>Price <span style={{ fontWeight: 600, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>(incl. 5% GST · ₹{gstIncl})</span></span>
          <span>₹{total}</span>
        </div>
        {gift && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Gift wrap</span><span>₹{giftFee}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          <span>Delivery fee</span>
          {/* Show what is actually charged. This used to print a struck-through ₹100 and "FREE" for
              every intracity address, while `grand` below still added the real Shiprocket quote —
              so the bill read FREE and the customer was charged ₹109.74 anyway. Only say FREE when
              the fee really is zero. */}
          {delivery > 0
            ? <span>₹{delivery}</span>
            : <span style={{ display: 'inline-flex', gap: 7, alignItems: 'baseline' }}><span style={{ textDecoration: 'line-through', color: 'var(--text-subtle)' }}>₹100</span><span style={{ color: 'var(--green-success)', fontWeight: 800 }}>FREE</span></span>}
        </div>
        {applied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--green-success)', fontWeight: 700 }}><span>Coupon ({coupon})</span><span>−₹{discount}</span></div>}
        <Dash />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}><span>To pay</span><span>₹{grand}</span></div>
      </div>
    </div>
  );

  return (
    /* A normal page (not a fixed full-screen overlay) so it carries the SAME site header and
       footer as every other page — only the announcement ribbon is left off, since checkout
       shouldn't advertise. The Cart › Checkout › Payment flow row sits directly under the nav. */
    <div className="adc-pattern-page order-cards" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <div style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-glass)', flex: 'none' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '10px var(--gutter)' }}>
          <button onClick={() => router.push(step === 'pay' ? '/checkout' : '/order')} aria-label="Go back" style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><ChevronLeft size={20} /></button>
          <div style={{ flex: 'none' }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1.1 var(--font-display)', color: 'var(--text-strong)' }}>{step === 'pay' ? 'Payment' : 'Checkout'}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{step === 'pay' ? 'Choose how to pay' : `${lines.length} item${lines.length !== 1 ? 's' : ''} · ready to order`}</div>
          </div>
          {/* Desktop: the Cart › Checkout › Payment stepper sits inline so the row stays short */}
          {desktop && <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}><CheckoutStepper current={step} inline /></div>}
        </div>
        {/* Mobile keeps the stepper on its own row */}
        {!desktop && <CheckoutStepper current={step} />}
      </div>

      {/* Bottom padding clears the sticky CTA, which floats with no panel behind it — without this
          the last card (bill details / secure-payment note) scrolls under the button. */}
      <div style={{ flex: 1, padding: '24px var(--gutter) 96px' }}>
        {step === 'review' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {payFailMsg && (
              <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', background: 'var(--red-wash)', border: '1.5px solid var(--status-error)' }}>
                <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--status-error)', fontWeight: 700 }}>{payFailMsg}</span>
                <button onClick={() => setPayFailMsg('')} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', color: 'var(--status-error)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><X size={16} /></button>
              </div>
            )}
            <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {orderSummary}
              {(() => {
                // "Goes great with" — a horizontal upsell of available cookies not already in the
                // cart (Zomato "complete your meal with" style). Quick-add straight from here.
                // A same-day-only product (e.g. Red Velvet) is filtered against the REAL dispatch
                // city once an address is chosen (delivCheck.city, the actual zone/pincode match),
                // falling back to the coarser "nearest store" location guess before that.
                const upsellCity = delivCheck?.city ? { city: delivCheck.city } : locationStore;
                const suggestions = catalog.filter(p => p.isAvailable && p.category === 'COOKIES' && !cart[String(p.id)] && !/sundae/i.test(p.name) && productAvailableFor(upsellCity, p)).slice(0, 8);
                if (suggestions.length === 0) return null;
                return (
                  <div style={card$}>
                    {head(<Cookie size={18} color="var(--brand-secondary)" />, 'Goes great with')}
                    <div className="hide-sb" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                      {suggestions.map(p => (
                        <div key={p.id} className="co-upsell-tile" style={{ flex: 'none', width: 132, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                            <Image src={firstImage(p.images)} alt={p.name} fill sizes="132px" style={{ objectFit: 'cover' }} />
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 'auto' }}>
                            <span style={{ fontWeight: 900, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>₹{Number(p.price)}</span>
                            <button onClick={() => setQty(String(p.id), (cart[String(p.id)]?.qty || 0) + 1, p.name, Number(p.price), firstImage(p.images))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '5px 10px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                              <Plus size={13} /> Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ flex: '1.4 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={card$}>
                {head(<MapPin size={18} color="var(--brand-secondary)" />, 'Delivery address')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!user ? (
                    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>Please log in to choose your delivery address.</p>
                      <button onClick={() => setLoginOpen(true)} style={{ padding: '11px 22px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Log in</button>
                    </div>
                  ) : (
                  <>
                  {addresses.length === 0 && !adding && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 2 }}>No saved addresses yet — please add your delivery address below.</p>
                  )}
                  {addresses.map(a => {
                    const on = addr === a.id;
                    return (
                      <div key={a.id} onClick={() => setAddr(a.id)} role="button" tabIndex={0} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-raised)' }}>
                        <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: on ? 'var(--gradient-warm)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{a.label === 'Office' ? <Briefcase size={18} color={on ? 'var(--white)' : 'var(--brand-secondary)'} /> : a.label === 'Other' ? <MapPin size={18} color={on ? 'var(--white)' : 'var(--brand-secondary)'} /> : <Home size={18} color={on ? 'var(--white)' : 'var(--brand-secondary)'} />}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{a.label || 'Home'}</span>
                            {a.isDefault && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Default</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.45 }}>{[a.addressLine1, a.addressLine2, a.city, a.pincode].filter(Boolean).join(', ')}</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                          <button onClick={e => { e.stopPropagation(); editAddr(a); }} aria-label="Edit address" style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}><Pencil size={14} /></button>
                          <Dot on={on} />
                        </span>
                      </div>
                    );
                  })}
                  {adding ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                      {/* Detect my location — runs automatically when the form opens, and again on tap;
                          fills the columns we can read. Coordinates are re-derived from the typed
                          address on save, so editing the fields moves the delivery point with them. */}
                      <button onClick={detectLocation} disabled={detecting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: detecting ? 'wait' : 'pointer' }}>
                        <Navigation size={16} /> {detecting ? 'Detecting…' : 'Detect my location'}
                      </button>
                      {detectErr && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 600, lineHeight: 1.4 }}>{detectErr}</div>}

                      {/* Text fields only — latitude/longitude live on the same form object but are
                          captured from GPS, never typed, so they are deliberately not listed here. */}
                      {([['fullName', 'Full name'], ['phone', 'Phone'], ['addressLine1', 'Flat / House / Building'], ['addressLine2', 'Area / Landmark']] as const).map(([k, ph]) => (
                        <input key={k} value={aform[k]} onChange={aset(k)} placeholder={ph} inputMode={k === 'phone' ? 'tel' : undefined} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
                      ))}
                      {aform.phone.trim().length > 0 && !phoneOk && <div style={hintStyle}>Enter a valid 10-digit mobile number — needed to deliver this order.</div>}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input value={aform.city} onChange={aset('city')} placeholder="City" style={fieldStyle} />
                        <select value={aform.state} onChange={e => setAform(f => ({ ...f, state: e.target.value }))} style={{ ...fieldStyle, cursor: 'pointer', color: aform.state ? 'var(--text-strong)' : 'var(--text-subtle)', appearance: 'none' }}>
                          <option value="">State</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input value={aform.pincode} onChange={e => setAform(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="Pincode" inputMode="numeric" maxLength={6} style={fieldStyle} />
                      </div>
                      {aform.pincode.length > 0 && !pinOk && <div style={hintStyle}>Enter a valid 6-digit PIN code.</div>}
                      {!aform.state && <div style={{ ...hintStyle, color: 'var(--text-muted)', fontWeight: 500 }}>Select your state to continue.</div>}

                      {/* Save this address as … */}
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Save address as</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['Home', 'Office', 'Other'] as const).map(lb => {
                            const on = aform.label === lb;
                            return (
                              <button key={lb} onClick={() => setAform(f => ({ ...f, label: lb }))} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-card)', color: on ? 'var(--orange-800)' : 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>{lb}</button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mark as default */}
                      <button onClick={() => setMakeDefault(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 2px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', border: makeDefault ? 'none' : '2px solid var(--border-strong)', background: makeDefault ? 'var(--gradient-warm)' : 'transparent', color: 'var(--white)', flex: 'none' }}>{makeDefault && <Check size={13} strokeWidth={3} />}</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>Mark as default address</span>
                      </button>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button disabled={!aValid || savingAddr} onClick={saveAddr} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-button)', border: 'none', background: (aValid && !savingAddr) ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: savingAddr ? 'wait' : aValid ? 'pointer' : 'not-allowed' }}>{savingAddr ? 'Saving…' : editId != null ? 'Save changes' : 'Save & use'}</button>
                        <button onClick={closeAddrForm} style={{ padding: '11px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={openAddForm} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
                      <Plus size={16} color="var(--brand-secondary)" />
                      <span style={{ fontWeight: 700, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Add new address</span>
                    </button>
                  )}
                  </>
                  )}
                </div>
                {delivChecking && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <Truck size={16} /> Checking delivery to {chosen?.pincode}…
                  </div>
                )}
                {!delivChecking && delivCheck && (
                  delivCheck.serviceable ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--amber-300)', background: 'var(--amber-50)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Truck size={16} style={{ color: 'var(--white)' }} /></span>
                      <div>
                        {delivCheck.intracity
                          ? <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Same-day delivery — arrives today, {fmtDay(new Date())}</div>
                          : deliverBy
                            ? <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Arrives {fmtDay(deliverBy)}{delivCheck.tat != null ? ` · in ${delivCheck.tat} day${delivCheck.tat !== 1 ? 's' : ''}` : ''}</div>
                            : <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Delivery available{delivCheck.embargo ? ' — minor delays possible' : ''}</div>}
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{delivCheck.intracity && delivCheck.store ? `${delivCheck.etaLabel || 'Same-day'} from ${delivCheck.store} · Pincode ${chosen?.pincode}` : `Express delivery (all India) · Pincode ${chosen?.pincode}`}</div>
                      </div>
                    </div>
                  ) : delivCheck.reason === 'same_day_unavailable' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--amber-300)', background: 'var(--amber-50)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Clock size={16} style={{ color: 'var(--white)' }} /></span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Same-day delivery is paused</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{delivCheck.maintenanceMessage || 'Same-day delivery to this area is temporarily paused.'}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--status-error)', background: 'var(--red-wash)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--status-error)', display: 'grid', placeItems: 'center', flex: 'none' }}><Truck size={16} style={{ color: 'var(--white)' }} /></span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>Delivery not available to {chosen?.pincode}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>Please use a different address</div>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div style={card$}>
                <button onClick={() => setGift(!gift)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Gift size={19} style={{ color: 'var(--white)' }} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Add this as a gift · +₹{GIFT_FEE}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Premium gift wrap with a handwritten message card.</span>
                  </span>
                  <span style={{ width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center', border: gift ? 'none' : '2px solid var(--border-strong)', background: gift ? 'var(--gradient-warm)' : 'transparent', color: 'var(--white)', flex: 'none' }}>{gift && <Check size={15} strokeWidth={3} />}</span>
                </button>
                {gift && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>What&apos;s the occasion?</div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {GIFT_OCCASIONS.map(o => {
                          const on = giftOccasion === o;
                          return (
                            <button key={o} onClick={() => setGiftOccasion(on ? '' : o)} style={{ padding: '7px 13px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-card)', color: on ? 'var(--orange-800)' : 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)' }}>{o}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      {/* Handwritten-style note card so it reads like a real gift message */}
                      <textarea value={giftMessage} onChange={e => setGiftMessage(e.target.value.slice(0, 200))} placeholder="Write your gift message…" rows={3} maxLength={200} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '14px 16px', border: '1.5px solid var(--amber-300)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-hand)', fontSize: '1.2rem', lineHeight: 1.5, color: 'var(--ink-800)', outline: 'none', background: 'var(--amber-50)' }} />
                      <div style={{ textAlign: 'right', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 4 }}>{giftMessage.length}/200</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={card$}>
                {head(<Tag size={18} color="var(--brand-secondary)" />, 'Apply coupon')}
                {applied ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', background: 'var(--green-wash)', border: '1.5px solid var(--green-success)' }}>
                    <Check size={20} style={{ color: 'var(--green-success)' }} />
                    <span style={{ flex: 1, fontWeight: 700, color: 'var(--green-success)', fontSize: 'var(--text-sm)' }}>{coupon} applied!</span>
                    <button onClick={() => {
                      setApplied(false); setCoupon(''); setDiscount(0);
                      if (giftLineId) { setQty(giftLineId, 0); setGiftLineId(null); }
                    }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-sm)' }}>Remove</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      <input value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponErr(''); }} placeholder="Enter coupon code" style={{ flex: 1, minWidth: 0, padding: '13px 16px', borderRadius: 'var(--radius-input)', border: couponErr ? '1.5px solid var(--status-error)' : '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />
                      <button onClick={() => applyCoupon()} disabled={!coupon.trim()} style={{ padding: '13px 20px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Apply</button>
                    </div>
                    {couponErr && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)', marginTop: -6, marginBottom: 10 }}>{couponErr}</div>}

                    {/* This shopper's own spin-wheel win — account-bound, only ever applies to them. */}
                    {mySpinReward && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Your spin &amp; win reward</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--brand-secondary)', background: 'var(--amber-50)' }}>
                          <Gift size={16} color="var(--brand-secondary)" style={{ flex: 'none' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '.04em', color: 'var(--brand-secondary)' }}>{mySpinReward.code}</span>
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{mySpinReward.label}</span>
                            </div>
                            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
                              Expires in {formatRemaining(new Date(mySpinReward.expiresAt).getTime() - Date.now())}
                            </div>
                          </div>
                          <button onClick={() => { setCoupon(mySpinReward.code); setCouponErr(''); void applyCoupon(mySpinReward.code); }}
                            style={{ flex: 'none', padding: '7px 14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                            Apply
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Available offers — Zomato/Swiggy-style tappable list, so shoppers don't have
                        to already know a code to use one. */}
                    {availableCoupons.length > 0 && (
                      <div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Available offers</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {availableCoupons.map(c => (
                            <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--brand-secondary)', background: 'var(--amber-50)' }}>
                              <Tag size={16} color="var(--brand-secondary)" style={{ flex: 'none' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'var(--text-sm)', letterSpacing: '.04em', color: 'var(--brand-secondary)' }}>{c.code}</span>
                                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-strong)' }}>{c.label}</span>
                                </div>
                                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 2 }}>
                                  {c.minimumOrderAmount ? `Min. order ₹${c.minimumOrderAmount}` : 'No minimum order'}
                                </div>
                              </div>
                              <button onClick={() => { setCoupon(c.code); setCouponErr(''); void applyCoupon(c.code); }}
                                style={{ flex: 'none', padding: '7px 14px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 10, fontWeight: 600 }}>Or tap the Spin &amp; Win wheel at the bottom-right of the screen to win a code.</div>
                  </div>
                )}
              </div>

              {billCard}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={card$}>
              {head(<MapPin size={18} color="var(--brand-secondary)" />, 'Delivery address')}
              {selected ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px', borderRadius: 'var(--radius-card)', background: 'var(--surface-raised)', border: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    {selected.label === 'Office' ? <Briefcase size={17} color="var(--white)" /> : selected.label === 'Other' ? <MapPin size={17} color="var(--white)" /> : <Home size={17} color="var(--white)" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{selected.label || 'Home'}</span>
                      {selected.fullName && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>· {selected.fullName}</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{[selected.addressLine1, selected.addressLine2, selected.city, selected.state, selected.pincode].filter(Boolean).join(', ')}</div>
                    {PHONE_RE.test((selected.phone || '').replace(/\D/g, ''))
                      ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: 4 }}>Phone: {selected.phone}</div>
                      : <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, marginTop: 4 }}>No phone on file — tap Change to add one before paying.</div>}
                  </div>
                  <button onClick={() => router.push('/checkout')} style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer', flex: 'none' }}>Change</button>
                </div>
              ) : (
                <button onClick={() => router.push('/checkout')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <MapPin size={17} color="var(--brand-secondary)" />
                  <span style={{ fontWeight: 700, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Add a delivery address</span>
                </button>
              )}
            </div>

            {STALL_MODE ? (
              <div style={card$}>
                {head(<ShoppingBag size={18} color="var(--brand-secondary)" />, 'How to get your order')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    Online payments and delivery are launching soon — about a week away. Meanwhile, please visit our store, or message us on WhatsApp / give us a call to place this order.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ flex: '1 1 160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 'var(--radius-button)', background: 'var(--whatsapp-green)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                      WhatsApp us
                    </a>
                    <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ flex: '1 1 160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-strong)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                      Call {SITE_PHONE}
                    </a>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                    Or visit any of our stores — see all locations on the <a href="/locations" style={{ color: 'var(--text-link)', fontWeight: 700 }}>Locations page</a>.
                  </div>
                </div>
              </div>
            ) : (
              <div style={card$}>
                {head(<CreditCard size={18} color="var(--brand-secondary)" />, 'Payment method')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    Tap <strong style={{ color: 'var(--text-strong)' }}>Pay ₹{grand}</strong> to open the secure payment window. Pick <strong>UPI</strong> (GPay, PhonePe, Paytm), <strong>card</strong>, <strong>netbanking</strong> or <strong>wallet</strong> there — you&apos;ll come right back here once it&apos;s done.
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['UPI', 'Cards', 'Netbanking', 'Wallets'].map(m => (
                      <span key={m} style={{ padding: '7px 13px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-raised)', border: '1.5px solid var(--border-default)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>{m}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)' }}>
                    <Lock size={13} /> Secured by Razorpay · your card / UPI details never touch our servers
                  </div>
                </div>
              </div>
            )}

            {billCard}
          </div>
        )}
      </div>

      {/* Sticky so "Proceed to Pay" stays reachable while the page scrolls normally under the header.
          No panel behind it — the button floats on the page so it reads as a button, not a white bar
          pasted across the bottom (which looked especially odd sitting on top of the footer). */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, padding: '14px var(--gutter) 18px', background: 'transparent', flex: 'none' }}>
        {step === 'review' ? (
          <>
            {hydrated && lines.length > 0 && user && !chosen && (
              <div style={{ maxWidth: 720, margin: '0 auto 10px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                Add &amp; select a delivery address to continue.
              </div>
            )}
            {hydrated && !user ? (
              // Guests: prompt login before anything else (the address card also shows a log-in prompt).
              <button onClick={() => setLoginOpen(true)} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: 'var(--shadow-xl)' }}>
                <Lock size={18} /> Log in to continue
              </button>
            ) : (
              <button suppressHydrationWarning onClick={() => router.push('/payment')} disabled={!canProceed} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-pill)', border: 'none', background: canProceed ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: canProceed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: canProceed ? 'var(--shadow-xl)' : 'var(--shadow-md)' }}>
                {STALL_MODE ? <>Continue <ArrowRight size={18} /></> : <>Proceed to Pay · ₹{grand} <ArrowRight size={18} /></>}
              </button>
            )}
          </>
        ) : STALL_MODE ? (
          // STALL MODE: the "How to get your order" card above already carries the WhatsApp/Call
          // handoff, with the store-visit note and Locations link alongside it. Repeating the same
          // two buttons in this sticky bar stacked a second, identical CTA under the first on
          // mobile — one handoff is enough, and the richer one is the card.
          null
        ) : (
          <>
            {payError && (
              <div style={{ maxWidth: 720, margin: '0 auto 10px', padding: '10px 14px', borderRadius: 'var(--radius-button)', background: 'var(--red-wash)', border: '1.5px solid var(--status-error)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', fontWeight: 700, textAlign: 'center' }}>{payError}</div>
            )}
            <button onClick={() => user ? handlePlace() : setLoginOpen(true)} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {user ? <>Pay ₹{grand} <Lock size={18} /></> : <>Log in to place order <Lock size={18} /></>}
            </button>
            {/* The "secure payments" reassurance lives in the payment-method card above, not here:
                the CTA floats over the page, so a caption under it printed on top of the bill. */}
          </>
        )}
      </div>
      <Footer />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

/* ---- Order Success Page ---- */
export default function OrderingApp() {
  const pathname = usePathname();

  // Checkout and payment are the only routes that render this. /order was retired — it redirects
  // to the home page, where the product grid now lives — so the standalone menu page that used to
  // follow here was unreachable, along with the state and the products fetch that fed it.
  if (pathname === '/checkout') return <CheckoutFlow step="review" />;
  if (pathname === '/payment') return <CheckoutFlow step="pay" />;
  return null;
}
