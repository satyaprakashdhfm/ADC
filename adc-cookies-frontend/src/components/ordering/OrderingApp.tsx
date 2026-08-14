'use client';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, X, ShoppingBag, Check, ArrowRight, Gift, MapPin, Home, Briefcase, Lock, Tag, Receipt, Clock, Plus, Cookie, Navigation, Truck, Pencil, AlertTriangle } from 'lucide-react';
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
import { useColumnFill } from '@/hooks/checkout/useColumnFill';
import { UPSELL_LADDER } from '@/lib/categories';
// Leaflet needs a window, and this is only ever rendered inside an open address form.
const AddressPinMap = dynamic(() => import('./ui/AddressPinMap'), {
  ssr: false,
  loading: () => <div style={{ height: 190, borderRadius: 'var(--radius-button)', background: 'var(--surface-sunken)' }} />,
});
import { useDeliveryCheck } from '@/hooks/checkout/useDeliveryCheck';
import { useCheckoutCoupons } from '@/hooks/checkout/useCheckoutCoupons';
import { useCheckoutAddresses } from '@/hooks/checkout/useCheckoutAddresses';
import { useCheckoutPayment } from '@/hooks/checkout/useCheckoutPayment';
import { WEEKDAYS as _WD, MONTHS as _MO } from '@/lib/orderFormat';
import { CheckoutStepper, Dot, Dash } from './ui/CheckoutStepper';
import { Thumb, QStepper } from './ui/ProductCards';
import OfferCard from './ui/OfferCard';
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

/* Gap between "Goes great with" tiles. Shared by the layout and by the row-fitting measurement,
   which has to add it back when working out how many tiles a given height holds. */
const UPSELL_GAP = 10;

/* How wide the checkout is allowed to get. Matches the menu grid on the homepage (1680) rather
   than the 1200 it used to be — on a wide screen that left a third of the display empty either
   side while the order summary squeezed its own contents, which is the wrong trade in a two-column
   layout whose whole job is to fit the cart and the delivery form side by side. `var(--gutter)`
   still keeps it off the edge on smaller screens. */
const CHECKOUT_MAX = 1680;

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
    detecting, detectErr, savingAddr, saveErr, pointSource, pointNote, setPin,
    openAddForm, editAddr, closeAddrForm, saveAddr, detectLocation,
  } = useCheckoutAddresses();
  const catalog = useUpsellCatalog();
  // Lets the upsell grid grow until the left column matches the right one. Desktop only — below
  // the breakpoint the two columns stack, so there is no height to match.
  const { leftRef, rightRef, gridRef, fit, cols } = useColumnFill(desktop, UPSELL_GAP);
  const { couponErr, setCouponErr, availableCoupons, mySpinReward, applyCoupon } = useCheckoutCoupons();
  const [loginOpen, setLoginOpen] = useState(false);
  // Taking the last unit off a line deletes it outright, which is a lot to happen on one tap of a
  // small "−" — especially the tap that follows the one that took 2 down to 1. This holds the line
  // being removed so we can ask first; null means nothing is pending.
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string; img?: string } | null>(null);

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

  /* How far under a coupon's minimum this basket is, so an offer that cannot be used says why
     before it is tapped rather than after. Measured against the item total, which is what the
     backend checks — delivery and gift wrap are not part of it, so counting them here would have
     offered a code the server then refused. */
  const shortfallFor = (minimum?: number | null) => {
    const need = Number(minimum || 0);
    return need > total ? Math.ceil(need - total) : 0;
  };

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
  // Why the CTA is disabled, phrased as the next thing to do — and shown ON the button rather than
  // as a line of text above it. The sticky bar deliberately has no panel behind it (so the button
  // reads as a button, not a bar pasted over the footer), which meant a bare line of helper text
  // sat unreadably on top of whatever happened to be scrolling underneath it.
  // Ordered by what the customer can act on first; null once nothing is blocking.
  const blockedReason = !hydrated || lines.length === 0 ? null
    : !chosen ? 'Add a delivery address to continue'
      : !chosenPinOk || !chosenPhoneOk ? 'Complete the delivery address to continue'
        : delivCheck && !delivCheck.serviceable ? 'We don’t deliver to this address yet'
          : hasBlockingRestriction ? 'Some items can’t be delivered to this address'
            : null;
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
  if (done) return <OrderSuccessPage show total={paid} orderId={orderId} eta={successEta} summary={placedOrderSummary} pendingPayment={pendingPayment} onBackToMenu={() => router.push('/#products')} onViewOrder={() => router.push('/account')} />;

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
          /* A line this address can't receive is dimmed and labelled, not alarmed.
             The first version shouted: red panel, red border, red text, struck-through name and
             price. Nothing has gone wrong here — the cookie is fine, the address simply cannot have
             it — and dressing that as an error made the calmest row in the basket the loudest thing
             on the page. So the photo greys with a small label across it, the text quiets, and the
             reason sits underneath in the site's own warm tones. The stepper stays live, since
             removing it is the way out. */
          const blocked = !!restriction;
          return (
          <div key={l.id} className="co-line" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 0', borderBottom: i < lines.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            {l.img
              ? (
                <div onClick={() => router.push(`/?q=${encodeURIComponent(l.name)}`)} title={`View ${l.name}`} className="co-line__img" style={{ position: 'relative', width: 112, height: 112, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flex: 'none', cursor: 'pointer' }}>
                  {/* Desaturated, not faded to nothing. At 40% opacity the photo turned to mush
                      against the card; greyscale alone still reads as a photograph of the thing
                      they wanted, which is what makes the label on top land. */}
                  <Image src={l.img} alt={l.name} width={112} height={112} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: blocked ? 'grayscale(1) contrast(.92)' : undefined, opacity: blocked ? 0.62 : 1 }} />
                  {blocked && (
                    <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 6px', background: 'var(--ink-900-78)', color: 'var(--white)', fontSize: 'var(--text-2xs)', fontWeight: 800, letterSpacing: '.03em', textAlign: 'center' }}>
                      Unavailable
                    </span>
                  )}
                </div>
              )
              : <Thumb size={112} seed={i} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => router.push(`/?q=${encodeURIComponent(l.name)}`)} role="link" tabIndex={0} title={`View ${l.name}`} style={{ fontWeight: 800, color: blocked ? 'var(--text-muted)' : 'var(--text-strong)', fontSize: 'var(--text-base)', lineHeight: 1.25, cursor: 'pointer' }}>{l.name}</div>
              {/* The catalog blurb, so the summary reads like the product card rather than a bare
                  line item — it also fills the column instead of leaving a tall empty gap. */}
              {(() => {
                const desc = catalog.find(p => String(p.id) === String(l.id) || p.name === l.name)?.description;
                return desc ? <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</div> : null;
              })()}
              {l.addOns && l.addOns.length > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 600, marginTop: 3 }}>+ {l.addOns.join(', ')}</div>}
              {l.note && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontStyle: 'italic' }}>&ldquo;{l.note}&rdquo;</div>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 900, color: blocked ? 'var(--text-muted)' : 'var(--text-strong)' }}>₹{l.price}</span>
                {/* Every quantity change goes straight through EXCEPT the one that would empty the
                    line — that asks first. */}
                <QStepper
                  value={l.qty}
                  onChange={n => {
                    if (n <= 0) { setPendingRemove({ id: l.id, name: l.name, img: l.img }); return; }
                    setQty(l.id, n, l.name, l.price, l.img);
                  }}
                  size="sm"
                />
              </div>
              {applied && l.id === giftLineId && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--green-success)', fontWeight: 800, marginTop: 4 }}>🎁 Free — your spin reward</div>}
              {/* Amber, not red. Red is for something broken; this is a fact about the address, and
                  it belongs in the same warm palette as the rest of the page. One line of it, with
                  the admin-written reason — which can say the true thing ("keeps 24 hours, so
                  Bengaluru same-day only") rather than a generic sentence this code would guess at.
                  The instruction to remove it is a quiet second line, not a shouted one. */}
              {restriction && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 9, padding: '9px 12px', borderRadius: 10, background: 'var(--amber-50)', border: '1px solid var(--amber-200)', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber-600)' }} />
                  <span style={{ color: 'var(--orange-800)' }}>
                    <strong style={{ fontWeight: 800 }}>We can&apos;t deliver this to your address.</strong>{' '}
                    <span style={{ fontWeight: 500 }}>{restriction.reason}</span>
                    <span style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)', fontWeight: 500 }}>Remove it to carry on, or choose a different address.</span>
                  </span>
                </div>
              )}
            </div>
          </div>
          );
        })}
        {lines.length === 0 && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '8px 0' }}>Your cart is empty.</div>}
      </div>
      {/* The arrival date used to be repeated here as a SAME-DAY / EXPRESS strip. It now lives in
          the Delivery time card on the right and only there — one screen stating the same date
          twice invites the reader to check whether the two agree. */}
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
        {/* Why the fee is what it is, and how far the cookies are coming — measured to the SELECTED
            ADDRESS, not to wherever the phone happens to be.

            Both lanes say it now. Same-day quotes the carrier's real routing distance, the figure
            its fee is actually priced on. An outstation parcel has no such number — Delhivery
            prices by weight and zone — so that one is straight-line from the warehouse and says
            "about", because the road is always longer than the crow flies and rounding an estimate
            into a precise-looking figure is how a helpful line turns into a complaint. */}
        {delivCheck?.distanceKm != null && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', marginTop: -4, lineHeight: 1.45 }}>
            {delivCheck.intracity ? (
              <>
                Your cookies are <strong style={{ color: 'var(--text-muted)' }}>{Math.round(delivCheck.distanceKm * 10) / 10} km</strong> away
                {delivCheck.store ? <> — riding over from {delivCheck.store}</> : null}
              </>
            ) : (
              <>
                Your cookies have about <strong style={{ color: 'var(--text-muted)' }}>{Math.round(delivCheck.distanceKm).toLocaleString('en-IN')} km</strong> to travel
                {delivCheck.originStore ? <> — packed and posted from {delivCheck.originStore}</> : null}
              </>
            )}
          </div>
        )}
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
        <div style={{ maxWidth: CHECKOUT_MAX, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '10px var(--gutter)' }}>
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
          <div style={{ maxWidth: CHECKOUT_MAX, margin: '0 auto', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {payFailMsg && (
              <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', background: 'var(--red-wash)', border: '1.5px solid var(--status-error)' }}>
                <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--status-error)', fontWeight: 700 }}>{payFailMsg}</span>
                <button onClick={() => setPayFailMsg('')} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', color: 'var(--status-error)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><X size={16} /></button>
              </div>
            )}
            <div ref={leftRef} style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {orderSummary}
              {(() => {
                // "Goes great with" — available cookies not already in the cart, quick-add straight
                // from here. On desktop it is a grid that grows downwards until the column catches
                // up with the address/gift/coupon/bill stack opposite, so a one-item order doesn't
                // leave half a screen of white beside a full right-hand column.
                // A same-day-only product (e.g. Red Velvet) is filtered against the REAL dispatch
                // city once an address is chosen (delivCheck.city, the actual zone/pincode match),
                // falling back to the coarser "nearest store" location guess before that.
                const upsellCity = delivCheck?.city ? { city: delivCheck.city } : locationStore;
                /* Offer the NEXT thing up the ladder, not more of what they already have. Someone
                   holding a bag of cookies wants something to drink with it long before they want a
                   second bag. So a category already in the cart is pushed to the back rather than
                   hidden — if nothing else qualifies, more cookies still beats an empty row. The
                   rung order lives in the category registry, next to the categories themselves. */
                const LADDER: readonly string[] = UPSELL_LADDER;
                const inCart = new Set<string>(
                  lines.flatMap(l => {
                    const cat = catalog.find(p => String(p.id) === String(l.id))?.category;
                    return cat ? [cat as string] : [];
                  })
                );
                const rank = (cat: string) => {
                  const i = LADDER.indexOf(cat);
                  const pos = i === -1 ? LADDER.length : i;   // unknown categories sort after known ones
                  return inCart.has(cat) ? pos + 100 : pos;   // already got it → back of the queue
                };
                /* The menu shows everything to everyone, but a SUGGESTION is different: offering
                   something that would be blacked out the moment it landed in the basket is just
                   setting the shopper up. So once a real address has been checked, its own
                   restriction list is the filter — the precise per-pincode answer, not the coarse
                   nearest-store hint, which is all `productAvailableFor` can give before then. */
                const undeliverable = new Set(
                  (delivCheck?.sameDayRestrictions || []).filter(r => !r.eligible).map(r => String(r.productId))
                );
                const pool = catalog.filter(p => p.isAvailable && !cart[String(p.id)]
                  && !undeliverable.has(String(p.id))
                  && (delivCheck ? true : productAvailableFor(upsellCity, p)));
                if (pool.length === 0) return null;
                /* Deal one product from each category in turn instead of listing a category at a
                   time. The grid is cut off wherever it runs out of height, and a category listed
                   last would be the one that vanishes — dealing round-robin puts every category
                   inside the very first row, so shrinking the grid only ever costs depth within a
                   category, never a whole category. */
                const byCat = new Map<string, typeof pool>();
                for (const p of pool) {
                  const k = String(p.category || 'OTHER');
                  const g = byCat.get(k);
                  if (g) g.push(p); else byCat.set(k, [p]);
                }
                const cats = [...byCat.keys()].sort((a, b) => rank(a) - rank(b));
                const deepest = Math.max(...cats.map(c => byCat.get(c)!.length));
                const ordered: typeof pool = [];
                for (let i = 0; i < deepest; i++) {
                  for (const c of cats) { const p = byCat.get(c)![i]; if (p) ordered.push(p); }
                }
                /* How many rows: whatever the measured gap between the columns has room for,
                   floored at enough to show every category (a two-wide grid with three categories
                   still owes the third one a tile) and capped at what actually exists. Before the
                   first measurement `fit` is 0, so it starts at the floor and grows. */
                const perRow = Math.max(1, cols);
                const minRows = Math.ceil(cats.length / perRow);
                const maxRows = Math.ceil(ordered.length / perRow);
                const rows = Math.min(maxRows, Math.max(minRows, fit || minRows));
                const suggestions = desktop ? ordered.slice(0, rows * perRow) : ordered.slice(0, 8);
                return (
                  <div style={card$}>
                    {head(<Cookie size={18} color="var(--brand-secondary)" />, 'Goes great with')}
                    <div
                      ref={gridRef}
                      className={desktop ? undefined : 'hide-sb co-upsell-row'}
                      style={desktop
                        ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: UPSELL_GAP, alignContent: 'start' }
                        : { display: 'flex', gap: UPSELL_GAP, overflowX: 'auto', paddingBottom: 4 }}
                    >
                      {suggestions.map(p => (
                        <div key={p.id} className="co-upsell-tile" style={{ flex: 'none', width: desktop ? 'auto' : 116, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-sunken)' }}>
                            <Image src={firstImage(p.images)} alt={p.name} fill sizes="150px" style={{ objectFit: 'cover' }} />
                          </div>
                          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 'auto' }}>
                            <span style={{ fontWeight: 900, fontSize: 'var(--text-xs)', color: 'var(--text-strong)' }}>₹{Number(p.price)}</span>
                            <button onClick={() => setQty(String(p.id), (cart[String(p.id)]?.qty || 0) + 1, p.name, Number(p.price), firstImage(p.images))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '4px 8px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-2xs)', cursor: 'pointer' }}>
                              <Plus size={11} /> Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div ref={rightRef} style={{ flex: '1.4 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                      {/* PIN code leads, because it fills the two after it. Typing six digits looks
                          up the city and state (see useCheckoutAddresses) — so the order on screen
                          now matches the order of work, instead of asking for a city we are about
                          to overwrite. Both stay editable; the lookup is a head start, not a lock. */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input value={aform.pincode} onChange={e => setAform(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="Pincode" inputMode="numeric" maxLength={6} style={fieldStyle} />
                        <input value={aform.city} onChange={aset('city')} placeholder="City" style={fieldStyle} />
                        <select value={aform.state} onChange={e => setAform(f => ({ ...f, state: e.target.value }))} style={{ ...fieldStyle, cursor: 'pointer', color: aform.state ? 'var(--text-strong)' : 'var(--text-subtle)', appearance: 'none' }}>
                          <option value="">State</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {aform.pincode.length > 0 && !pinOk && <div style={hintStyle}>Enter a valid 6-digit PIN code.</div>}
                      {saveErr && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, lineHeight: 1.4 }}>{saveErr}</div>}

                      {/* The delivery point, shown rather than assumed.
                          Everything downstream is decided from this pin — which store bakes it,
                          what delivery costs, and the address the rider is actually navigated to —
                          and it is the one part of the address the customer could not previously
                          see or correct. An order typed as Jayanagar once shipped from a pin twelve
                          kilometres away in Varthur, and nothing on any screen said so. */}
                      {pinOk && aform.latitude != null && aform.longitude != null && (
                        <AddressPinMap
                          lat={aform.latitude}
                          lng={aform.longitude}
                          onMove={setPin}
                          pincode={aform.pincode}
                          city={aform.city}
                          onStreet={(street) => setAform(f => ({ ...f, addressLine2: street }))}
                          hint={pointSource === 'pin'
                            ? 'Pinned by you — this exact spot is where the rider is sent.'
                            : `${pointNote || 'Our best guess from the address above.'} Drag the pin to your exact door.`}
                        />
                      )}
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
              </div>

              {/* Delivery time, on its own card. Sitting inside the address box it read as a
                  footnote to the address — so the arrival date, the one thing most people want
                  settled before they pay, was the easiest line on the page to skim past. The card
                  also says something BEFORE an address exists, so the question has a visible place
                  to be answered instead of going unasked. */}
              <div style={card$}>
                {head(<Truck size={18} color="var(--brand-secondary)" />, 'Delivery time')}
                {!chosen || (!delivChecking && !delivCheck) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)' }}>
                    <Clock size={17} color="var(--brand-secondary)" style={{ flex: 'none' }} />
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      {!chosen
                        ? 'Add a delivery address above and we’ll tell you when your order reaches you.'
                        : 'Complete this address with a valid 6-digit PIN code to see the arrival date.'}
                    </div>
                  </div>
                ) : null}
                {delivChecking && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <Truck size={16} /> Checking delivery to {chosen?.pincode}…
                  </div>
                )}
                {!delivChecking && delivCheck && (
                  delivCheck.serviceable ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--amber-300)', background: 'var(--amber-50)' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--amber-300)', background: 'var(--amber-50)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Clock size={16} style={{ color: 'var(--white)' }} /></span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Same-day delivery is paused</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{delivCheck.maintenanceMessage || 'Same-day delivery to this area is temporarily paused.'}</div>
                      </div>
                    </div>
                  ) : delivCheck.reason === 'location_required' ? (
                    /* Recoverable, and it used to read as terminal. The backend is saying it has no
                       coordinates for this address — a thing the customer can fix in ten seconds by
                       opening it and dropping the pin — and we answered "delivery not available,
                       use a different address", which tells them to abandon an address we deliver
                       to perfectly well. Jayanagar 560011 is 2.4 km from our own Jayanagar shop. */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--amber-300)', background: 'var(--amber-50)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><MapPin size={16} style={{ color: 'var(--white)' }} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>We need this address pinned on the map</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>Same-day delivery is priced from your exact location. Open the address and drop the pin — it takes a moment.</div>
                      </div>
                      {chosen && (
                        <button onClick={() => editAddr(chosen)} style={{ flex: 'none', padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>Pin it</button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--status-error)', background: 'var(--red-wash)' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--status-error)', display: 'grid', placeItems: 'center', flex: 'none' }}><Truck size={16} style={{ color: 'var(--white)' }} /></span>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>Delivery not available to {chosen?.pincode}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{delivCheck.message || 'Please use a different address'}</div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Gift wrap is laid out open rather than hidden behind its checkbox. Collapsed, the
                  offer was a single line most people scrolled straight past — there was no way to
                  see that it comes with a handwritten card until after you had agreed to pay for it.
                  Showing the occasion chips and the note card is the offer.

                  Touching either one ticks the box for you, because filling in a gift message and
                  then not getting gift wrap is never what anyone meant. Unticking clears them back
                  out, so a message can't be left behind on an order with no card to write it on. */}
              <div style={card$}>
                {/* An Add / Added button, not a tickbox.
                    A checkbox is for a setting that is part of a form you are already filling in.
                    This is a thing you buy, priced, sitting in its own card — and the rest of the
                    site adds things you buy with a button that says Add. The tickbox also had to
                    carry the price beside its label with a separator dot, which is what made the
                    heading read as "Add this as a gift · +₹30". The price belongs on the button. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Gift size={19} style={{ color: 'var(--white)' }} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Send this as a gift</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Premium gift wrap with a handwritten message card.</div>
                  </div>
                  <button
                    onClick={() => { const next = !gift; setGift(next); if (!next) { setGiftOccasion(''); setGiftMessage(''); } }}
                    aria-pressed={gift}
                    style={{
                      flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 16px',
                      borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)',
                      fontWeight: 800, fontSize: 'var(--text-xs)',
                      border: gift ? 'none' : '1.5px solid var(--brand-secondary)',
                      background: gift ? 'var(--gradient-warm)' : 'var(--amber-50)',
                      color: gift ? 'var(--white)' : 'var(--brand-secondary)',
                    }}
                  >
                    {gift ? <><Check size={13} strokeWidth={3} /> Added</> : <><Plus size={13} /> Add · ₹{GIFT_FEE}</>}
                  </button>
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>What&apos;s the occasion?</div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {GIFT_OCCASIONS.map(o => {
                        const on = giftOccasion === o;
                        return (
                          <button key={o} onClick={() => { const next = on ? '' : o; setGiftOccasion(next); if (next) setGift(true); }} style={{ padding: '7px 13px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-card)', color: on ? 'var(--orange-800)' : 'var(--text-muted)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)' }}>{o}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    {/* Handwritten-style note card so it reads like a real gift message */}
                    <textarea value={giftMessage} onChange={e => { const v = e.target.value.slice(0, 200); setGiftMessage(v); if (v.trim()) setGift(true); }} placeholder="Write your gift message…" rows={3} maxLength={200} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '14px 16px', border: '1.5px solid var(--amber-300)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-hand)', fontSize: '1.2rem', lineHeight: 1.5, color: 'var(--ink-800)', outline: 'none', background: 'var(--amber-50)' }} />
                    <div style={{ textAlign: 'right', fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 4 }}>{giftMessage.length}/200</div>
                  </div>
                </div>
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
                        <OfferCard
                          icon={<Gift size={16} color="var(--brand-secondary)" />}
                          code={mySpinReward.code}
                          label={mySpinReward.label}
                          minimumOrderAmount={mySpinReward.minimumOrderAmount}
                          expiresInMs={new Date(mySpinReward.expiresAt).getTime() - Date.now()}
                          expiresLabel={formatRemaining(new Date(mySpinReward.expiresAt).getTime() - Date.now())}
                          terms={mySpinReward.terms}
                          shortfall={shortfallFor(mySpinReward.minimumOrderAmount)}
                          onApply={() => { setCoupon(mySpinReward.code); setCouponErr(''); void applyCoupon(mySpinReward.code); }}
                        />
                      </div>
                    )}

                    {/* Available offers — Zomato/Swiggy-style tappable list, so shoppers don't have
                        to already know a code to use one. */}
                    {availableCoupons.length > 0 && (
                      <div>
                        <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Available offers</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {availableCoupons.map(c => (
                            <OfferCard
                              key={c.code}
                              icon={<Tag size={16} color="var(--brand-secondary)" />}
                              code={c.code}
                              label={c.label}
                              minimumOrderAmount={c.minimumOrderAmount}
                              terms={c.terms}
                              shortfall={shortfallFor(c.minimumOrderAmount)}
                              onApply={() => { setCoupon(c.code); setCouponErr(''); void applyCoupon(c.code); }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Only worth saying to somebody who has not already won one. With a reward
                        sitting right above it, "go and win a code" reads as though the code they
                        have does not count — and the wheel is a single spin, so there is nothing
                        for them to go and do. */}
                    {!mySpinReward && (
                      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 10, fontWeight: 600 }}>Or tap the Spin &amp; Win wheel at the bottom-right of the screen to win a code.</div>
                    )}
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
              /* The payment-method card is gone. It listed UPI, cards, netbanking and wallets as
                 chips and explained that a secure window would open — all of which the Razorpay
                 window itself says, a tap later, in its own words. Naming the methods here only
                 risked disagreeing with what Razorpay actually offers on the day.

                 What the last screen before paying should carry instead is the terms being agreed
                 to. Short, in plain words, each linking to the full page — a shopper deciding
                 whether to pay is exactly who needs to know that an order cannot be cancelled, and
                 the moment after they have paid is exactly when it is too late to tell them. */
              <div style={card$}>
                {head(<Lock size={18} color="var(--brand-secondary)" />, 'Before you pay')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    ['We bake to order', 'Your cookies go into the oven as soon as this is paid, so an order can’t be cancelled or changed once placed. Do check your basket and address above.', '/terms', 'Terms of Service'],
                    ['If anything is wrong, we fix it', 'Damaged, wrong or missing items, or an order that never arrives — tell us within 24 hours and you get it remade or refunded, back to the account you paid from.', '/refund-policy', 'Refund Policy'],
                    ['How it reaches you', 'Same-day from the shop nearest your address inside our cities, courier elsewhere. The fee and the arrival date shown above are the real ones.', '/shipping-policy', 'Shipping Policy'],
                    ['Your details stay yours', 'We never see your card or UPI details — they go straight to Razorpay. We keep only what’s needed to bake and deliver the order.', '/privacy', 'Privacy Policy'],
                  ] as [string, string, string, string][]).map(([title, text, href, linkLabel]) => (
                    <div key={href} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <Check size={15} strokeWidth={3} style={{ flex: 'none', marginTop: 3, color: 'var(--green-success)' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>{title}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 2 }}>
                          {text} <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', fontWeight: 700, whiteSpace: 'nowrap' }}>{linkLabel} ↗</a>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', lineHeight: 1.6, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
                    By paying, you agree to our Terms of Service, Refund, Shipping and Privacy policies.
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
            {hydrated && !user ? (
              // Guests: prompt login before anything else (the address card also shows a log-in prompt).
              <button onClick={() => setLoginOpen(true)} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: 'var(--shadow-xl)' }}>
                <Lock size={18} /> Log in to continue
              </button>
            ) : (
              <button suppressHydrationWarning onClick={() => router.push('/payment')} disabled={!canProceed} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-pill)', border: 'none', background: canProceed ? 'var(--gradient-warm)' : 'var(--border-default)', color: canProceed ? 'var(--white)' : 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: canProceed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: canProceed ? 'var(--shadow-xl)' : 'var(--shadow-md)' }}>
                {blockedReason ? blockedReason
                  : STALL_MODE ? <>Continue <ArrowRight size={18} /></> : <>Proceed to Pay · ₹{grand} <ArrowRight size={18} /></>}
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

      {/* Confirm before a line disappears. Shows the actual cookie — name and picture — because
          "remove this item?" on its own makes you scroll back to check WHICH item you were on.
          Cancel is the wide, plain button and Remove the destructive one, so the safe choice is the
          easy one to hit. */}
      {pendingRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Remove ${pendingRemove.name} from your order?`}
          onClick={() => setPendingRemove(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--black-18)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 'var(--gutter)' }}
        >
          {/* Sized for the screen it is on. At a fixed 380px this sat as a postage stamp in the
              middle of a 1680px checkout, which reads as a toast that happens to have buttons
              rather than a question that has taken over the page and wants an answer. */}
          <div onClick={e => e.stopPropagation()} style={{ width: desktop ? 'min(520px, 100%)' : 'min(380px, 100%)', background: 'var(--surface-card)', borderRadius: 'var(--radius-modal)', padding: desktop ? 36 : 24, boxShadow: 'var(--shadow-xl)', textAlign: 'center' }}>
            {pendingRemove.img && (
              <Image src={pendingRemove.img} alt="" width={160} height={160}
                style={{ width: desktop ? 140 : 96, height: desktop ? 140 : 96, objectFit: 'cover', borderRadius: 'var(--radius-sm)', margin: '0 auto 18px' }} />
            )}
            <div style={{ font: `var(--weight-extra) ${desktop ? 'var(--text-h3)' : 'var(--text-h4)'}/1.25 var(--font-display)`, color: 'var(--text-strong)' }}>
              Remove {pendingRemove.name}?
            </div>
            <p style={{ fontSize: desktop ? 'var(--text-base)' : 'var(--text-sm)', color: 'var(--text-muted)', margin: '10px 0 24px', lineHeight: 1.55 }}>
              It&apos;ll come straight out of your order. You can always add it back.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setPendingRemove(null)}
                style={{ flex: 1, padding: desktop ? '15px' : '13px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-strong)', background: 'transparent', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: desktop ? 'var(--text-base)' : 'var(--text-sm)', cursor: 'pointer' }}
              >
                Keep it
              </button>
              <button
                onClick={() => { setQty(pendingRemove.id, 0, pendingRemove.name, 0, pendingRemove.img); setPendingRemove(null); }}
                style={{ flex: 1, padding: desktop ? '15px' : '13px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--status-error)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: desktop ? 'var(--text-base)' : 'var(--text-sm)', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
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
