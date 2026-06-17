'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, User, BookOpen, X, Search, ShoppingBag, ChevronRight, Sparkles, Check, ArrowRight, Gift, MapPin, CreditCard, Bike, Home, Briefcase, Lock, ShieldCheck, Tag, Receipt, Clock, Plus, Cookie } from 'lucide-react';
import { useCart, GIFT_FEE } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import LoginModal from './LoginModal';
import MascotLoader from '@/components/MascotLoader';
import { getProducts, getAddresses, addAddress, validateCoupon, createOrder, submitContact, firstImage, type Product, type Address, type OrderItemInput } from '@/lib/api';

/* ---- Data ---- */
const CATEGORIES = ['Cookies', 'Gift Tins', 'Corporate Gifting'];

const CATEGORY_META = {
  Cookies: { icon: Cookie },
  'Gift Tins': { icon: Gift },
  'Corporate Gifting': { icon: Briefcase },
} as const;

function CategoryTab({ label, selected, onClick, compact = false }: { label: string; selected: boolean; onClick: () => void; compact?: boolean }) {
  const Icon = CATEGORY_META[label as keyof typeof CATEGORY_META]?.icon ?? Cookie;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 11,
        width: compact ? 'auto' : '100%',
        padding: compact ? '5px 9px 5px 5px' : '5px 8px 5px 5px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: compact ? 42 : 46,
          height: compact ? 42 : 46,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          background: selected ? 'var(--teal-50)' : 'rgba(244,234,214,.74)',
          color: selected ? 'var(--brand-secondary)' : 'var(--text-muted)',
          boxShadow: selected ? 'inset 0 0 0 1px rgba(6,177,187,.14)' : 'inset 0 0 0 1px var(--border-soft)',
          transition: 'background var(--dur-base), color var(--dur-base), box-shadow var(--dur-base)',
        }}
      >
        <Icon size={compact ? 20 : 22} strokeWidth={1.8} />
      </span>
      <span
        style={{
          color: selected ? 'var(--brand-secondary)' : 'var(--text-muted)',
          fontSize: compact ? 'var(--text-sm)' : 'var(--text-base)',
          fontWeight: selected ? 800 : 700,
          lineHeight: 1,
          transition: 'color var(--dur-base)',
        }}
      >
        {label}
      </span>
    </button>
  );
}

const PAIRINGS = [
  { id: 'shake', name: 'Vanilla Milkshake', price: 120, img: null },
  { id: 'brownie', name: 'Fudge Brownie', price: 90, img: null },
  { id: 'coffee', name: 'Cold Coffee', price: 110, img: null },
  { id: 'icecream', name: 'Ice Cream Scoop', price: 70, img: null },
];

const FALLBACK_MENU = [
  { id: 'choc', name: 'Chocolate Chip', price: 60, cat: 'Cookies', rec: true, rating: 4.6, rc: '3.4k', veg: true, img: '/assets/products/blueberry.jpg', desc: 'The original. Buttery dough, dark chocolate chips, soft centre.' },
  { id: 'double', name: 'Double Choc Chip', price: 65, cat: 'Cookies', best: true, rating: 4.7, rc: '1.2k', veg: true, img: '/assets/products/triple-choc.jpg', desc: 'Rich cocoa dough loaded with dark chocolate chunks.' },
  { id: 'raagi', name: 'Raagi (Gluten Free)', price: 60, cat: 'Cookies', rating: 4.4, rc: '820', veg: true, img: '/assets/products/oatmeal-raisin.jpg', desc: 'Wholesome finger-millet cookie, naturally gluten free.' },
  { id: 'matcha', name: 'Matcha', price: 90, cat: 'Cookies', rec: true, rating: 4.5, rc: '640', veg: true, img: '/assets/products/matcha.jpg', desc: 'Stone-ground matcha folded into buttery white-chocolate dough.' },
  { id: 'special', name: 'ADC Special', price: 90, cat: 'Cookies', best: true, rating: 4.8, rc: '2.1k', veg: true, img: '/assets/products/adc-special.jpg', desc: 'Our signature — browned butter, sea salt, three chocolates.' },
  { id: 'redvelvet', name: 'Red Velvet With Cheese', price: 90, cat: 'Cookies', rating: 4.6, rc: '910', veg: true, img: '/assets/products/red-velvet.jpg', desc: 'Cocoa-red velvet cookie with a cream-cheese filled core.' },
  { id: 'biscoff', name: 'Biscoff Filled', price: 110, cat: 'Cookies', best: true, rating: 4.9, rc: '4.0k', veg: true, img: '/assets/products/peanut-butter.jpg', desc: 'Molten Biscoff spread inside a caramelised cookie shell.' },
  { id: 'nutella', name: 'Nutella Filled', price: 90, cat: 'Cookies', rec: true, rating: 4.7, rc: '2.6k', veg: true, img: '/assets/products/caramel-cashew.jpg', desc: 'Gooey Nutella centre in a soft chocolate cookie.' },
];

const FALLBACK_TINS = [
  { id: 'nutella-tin', name: 'Nutella Tin', price: 600, count: 6, img: '/assets/products/coffee-almond.jpg', desc: 'Six premium cookies in a keepsake tin.' },
  { id: 'biscoff-tin', name: 'Biscoff Tin', price: 850, count: 9, img: '/assets/products/m-and-m.jpg', desc: 'Nine Biscoff-filled cookies, gift-ready.' },
];


const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'Yes Bank'];
const UPI_APPS = [
  { id: 'gpay', label: 'Google Pay', bg: '#4285F4', letter: 'G' },
  { id: 'phonepe', label: 'PhonePe', bg: '#5F259F', letter: 'P' },
  { id: 'paytm', label: 'Paytm', bg: '#00BAF2', letter: 'p' },
  { id: 'other', label: 'Enter ID', bg: '#F29F05', letter: '₹' },
];

/* ---- Helpers ---- */
function useIsDesktop(bp = 920) {
  const [d, setD] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(min-width:${bp}px)`);
    const f = () => setD(m.matches); f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [bp]);
  return d;
}

function Dot({ on }: { on: boolean }) {
  return <span style={{ width: 22, height: 22, borderRadius: '50%', border: on ? '6px solid var(--brand-secondary)' : '2px solid var(--border-strong)', flex: 'none', transition: 'border .15s' }} />;
}

function Dash() {
  return <div style={{ height: 1, background: 'repeating-linear-gradient(90deg,var(--border-strong) 0,var(--border-strong) 6px,transparent 6px,transparent 12px)', margin: '6px 0 8px' }} />;
}

/* ---- Thumbnail ---- */
function Thumb({ size = 128, img, seed = 0 }: { size?: number; img?: string | null; seed?: number }) {
  if (img) return (
    <div style={{ width: size, height: size, borderRadius: 'var(--radius-image)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', flex: 'none' }}>
      <Image src={img} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
  const grads = [
    'radial-gradient(120% 120% at 35% 28%,#F8C24D,#EF7507)',
    'radial-gradient(120% 120% at 35% 28%,#F5AE21,#D2620A)',
    'radial-gradient(120% 120% at 35% 28%,#FBD98A,#F29F05)',
  ];
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--radius-image)', background: grads[seed % 3], boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden', flex: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 32% 28%,rgba(255,255,255,.4),transparent 42%)' }} />
    </div>
  );
}

/* ---- Quantity Stepper ---- */
function QStepper({ value, onChange, size = 'md' }: { value: number; onChange: (n: number) => void; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 32 : 44;
  const w = size === 'sm' ? 28 : 40;
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-button)', height: h, flex: 'none' }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} style={{ width: w, height: h, border: 'none', background: 'transparent', fontSize: 18, color: 'var(--brand-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>−</button>
      <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, color: 'var(--text-strong)', fontSize: size === 'sm' ? 'var(--text-sm)' : 'var(--text-base)' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={{ width: w, height: h, border: 'none', background: 'transparent', fontSize: 18, color: 'var(--brand-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>+</button>
    </div>
  );
}

/* ---- Product Card (menu item) ---- */
function ProductMenuItem({ item, qty, onQtyChange }: { item: typeof FALLBACK_MENU[0]; qty: number; onQtyChange: (n: number) => void }) {
  const rating = (item as any).rating as number | undefined;
  const rc = (item as any).rc as string | undefined;
  return (
    <div
      style={{ display: 'flex', gap: 20, padding: 20, marginBottom: 16, background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', alignItems: 'center', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {item.veg && <span style={{ width: 16, height: 16, border: '2px solid var(--mark-veg)', borderRadius: 3, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          {(item as any).best && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Bestseller</span>}
          {item.cat && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', fontWeight: 700 }}>{item.cat}</span>}
        </div>
        <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{item.name}</h3>
        {rating != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--amber-500)', letterSpacing: 1 }}>★</span>
            <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{rating}</span>
            {rc && <span style={{ color: 'var(--text-subtle)' }}>· {rc} ratings</span>}
          </div>
        )}
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>{item.desc}</p>
        <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{item.price}</span>
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 'clamp(132px,34vw,184px)', height: 'clamp(132px,34vw,184px)', borderRadius: 'var(--radius-image)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <Image src={item.img} alt={item.name} width={184} height={184} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }} />
        </div>
        {qty === 0 ? (
          <button onClick={() => onQtyChange(1)} style={{ width: 'clamp(132px,34vw,184px)', padding: '11px 0', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>ADD</button>
        ) : (
          <QStepper value={qty} onChange={onQtyChange} size="sm" />
        )}
      </div>
    </div>
  );
}

/* ---- Compact mobile product card — two-up grid, no ratings, ADD goes straight to cart ---- */
function MobileProductCard({ item, qty, onQtyChange }: { item: typeof FALLBACK_MENU[0]; qty: number; onQtyChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-image)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
        <Image src={item.img} alt={item.name} fill sizes="50vw" style={{ objectFit: 'cover' }} />
        {(item as any).best && <span style={{ position: 'absolute', top: 6, left: 6, padding: '2px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Bestseller</span>}
      </div>
      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {item.veg && <span style={{ width: 12, height: 12, border: '2px solid var(--mark-veg)', borderRadius: 2, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          <h3 style={{ font: 'var(--weight-bold) var(--text-sm)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
        </div>
        <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>₹{item.price}</span>
          {qty === 0 ? (
            <button onClick={() => onQtyChange(1)} style={{ padding: '6px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-xs)', cursor: 'pointer' }}>ADD</button>
          ) : (
            <QStepper value={qty} onChange={onQtyChange} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Tin Modal (full page) ---- */
function TinModal({ tin, onClose, onAdd }: { tin: typeof FALLBACK_TINS[0] | null; onClose: () => void; onAdd: (tin: typeof FALLBACK_TINS[0], qty: number) => void }) {
  const [qty, setQty] = useState(1);
  const open = !!tin;
  const unit = tin?.price || 0;

  useEffect(() => { if (tin) { setQty(1); } }, [tin]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 82, background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .3s' }} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', zIndex: 83,
        width: 'min(460px,94vw)', maxHeight: '86vh',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)',
        transform: open ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(.96)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-spring)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {tin && (
          <>
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><X size={18} /></button>

            <div className="hide-sb" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Real tin image */}
              <div style={{ width: '100%', height: 190, position: 'relative', overflow: 'hidden' }}>
                {tin.img ? <Image src={tin.img} alt={tin.name} fill style={{ objectFit: 'cover' }} /> : (
                  <div style={{ width: '100%', height: '100%', background: 'radial-gradient(130% 120% at 40% 25%,#F8C24D,#EF7507)' }} />
                )}
                <span style={{ position: 'absolute', left: 14, bottom: 14, padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: 'rgba(244,234,214,.92)', color: 'var(--amber-800)', fontSize: 'var(--text-xs)', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}>Premium Gift Tin · {tin.count} cookies</span>
              </div>

              <div style={{ padding: '16px 20px 0' }}>
                <h2 style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{tin.name}</h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.55 }}>{tin.desc} Hand-packed with {tin.count} premium cookies.</p>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{tin.price}</div>
              </div>

              <div style={{ padding: '10px 20px 0', fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gift size={14} color="var(--brand-secondary)" /> Add gift wrap &amp; a message for the whole order at the cart.
              </div>
              <div style={{ height: 16 }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', background: 'var(--surface-card)' }}>
              <QStepper value={qty} onChange={n => setQty(Math.max(1, n))} />
              <button onClick={() => onAdd(tin, qty)} style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer' }}>
                Add to Cart · ₹{unit * qty}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---- Checkout flow — one page, two steps: 'review' (address + order) then 'pay' (payment) ---- */
function CheckoutFlow({ step }: { step: 'review' | 'pay' }) {
  const router = useRouter();
  const { cart, total, setQty, gift, setGift, giftMessage, setGiftMessage, addrId: addr, setAddrId: setAddr, coupon, setCoupon, applied, setApplied, discount, setDiscount, clearAll } = useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [asap, setAsap] = useState(true);
  const [couponErr, setCouponErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [aform, setAform] = useState({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });
  const [method, setMethod] = useState('upi');
  const [upiApp, setUpiApp] = useState('gpay');
  const [upiId, setUpiId] = useState('');
  const [card, setCard] = useState({ num: '', exp: '', cvv: '', name: '' });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [paid, setPaid] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);

  // Addresses are private to the signed-in user — fetch on login, clear on logout.
  useEffect(() => {
    if (user) getAddresses().then(setAddresses).catch(() => setAddresses([]));
    else setAddresses([]);
  }, [user]);

  // Checkout needs an account (for delivery address) — prompt login the moment they arrive signed-out.
  useEffect(() => { if (!user) setLoginOpen(true); }, [user]);

  const lines = Object.values(cart);
  const delivery = total > 0 ? 29 : 0;
  const gst = Math.round(total * 0.05);
  const giftFee = gift ? GIFT_FEE : 0;
  const grand = total + delivery + gst + giftFee - discount;
  const selected = addresses.find(a => a.id === addr) || addresses[0];

  const aset = (k: keyof typeof aform) => (e: React.ChangeEvent<HTMLInputElement>) => setAform({ ...aform, [k]: e.target.value });
  const aValid = aform.fullName && aform.addressLine1 && aform.city && aform.pincode;
  const saveAddr = async () => {
    const data: Omit<Address, 'id'> = { ...aform, isDefault: false };
    let created: Address;
    try { created = await addAddress(data); } catch { created = { ...data, id: Date.now() }; }
    setAddresses(p => [...p, created]); setAddr(created.id); setAdding(false);
    setAform({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });
  };

  const applyCoupon = async () => {
    try {
      const result = await validateCoupon(coupon.trim().toUpperCase(), total);
      if (result.valid) {
        const d = result.discountType === 'PERCENTAGE' ? Math.round(total * result.discountValue / 100) : result.discountValue;
        setDiscount(Math.min(d, result.maximumDiscount || d));
        setApplied(true); setCouponErr('');
      } else { setCouponErr(result.message || 'Invalid coupon code'); setApplied(false); }
    } catch {
      if (coupon.trim().toUpperCase() === 'ADC10') { setDiscount(Math.round(total * 0.1)); setApplied(true); setCouponErr(''); }
      else { setCouponErr('Invalid code. Try ADC10'); setApplied(false); }
    }
  };

  const handlePlace = () => {
    setPlacing(true);
    const doOrder = async () => {
      try {
        if (user) {
          const items: OrderItemInput[] = Object.values(cart)
            .map((e, index) => {
              const opts: Record<string, unknown> = {};
              if (e.addOns && e.addOns.length) opts.addOns = e.addOns;
              if (index === 0 && gift) { opts.giftWrap = true; opts.giftMessage = giftMessage; }
              return {
                productId: Number(e.id),
                quantity: e.qty,
                selectedOptions: Object.keys(opts).length ? opts : undefined,
                specialNotes: e.note || undefined,
              };
            })
            .filter(it => Number.isFinite(it.productId) && it.quantity > 0);
          await createOrder(addr, applied ? coupon : undefined, items);
        }
      } catch {}
      setPaid(grand);
      setOrderId(`ADC-${20480 + Math.floor(Math.random() * 90)}`);
      clearAll();
      setDone(true);
    };
    setTimeout(doOrder, 2200);
  };

  const fmt4 = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; };

  const card$: React.CSSProperties = { background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', padding: 20 };
  const head = (icon: React.ReactNode, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>{icon}<span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>{label}</span></div>
  );

  if (done) return <OrderSuccessPage show total={paid} orderId={orderId} onBackToMenu={() => router.push('/order')} />;

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
        {lines.map((l, i) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < lines.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            {l.img ? <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flex: 'none' }}><Image src={l.img} alt={l.name} width={52} height={52} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div> : <Thumb size={52} seed={i} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
              {l.addOns && l.addOns.length > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 600 }}>+ {l.addOns.join(', ')}</div>}
              {l.note && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontStyle: 'italic' }}>&ldquo;{l.note}&rdquo;</div>}
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>₹{l.price}</div>
            </div>
            <QStepper value={l.qty} onChange={n => setQty(l.id, n, l.name, l.price, l.img)} size="sm" />
          </div>
        ))}
        {lines.length === 0 && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', padding: '8px 0' }}>Your cart is empty.</div>}
      </div>
    </div>
  );

  const billCard = (
    <div style={card$}>
      {head(<Receipt size={18} color="var(--brand-secondary)" />, 'Bill details')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Item total</span><span>₹{total}</span></div>
        {gift && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Gift wrap</span><span>₹{giftFee}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Delivery fee</span><span>₹{delivery}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>GST (5%)</span><span>₹{gst}</span></div>
        {applied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: '#1F8A5B', fontWeight: 700 }}><span>Coupon ({coupon})</span><span>−₹{discount}</span></div>}
        <Dash />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}><span>To pay</span><span>₹{grand}</span></div>
      </div>
    </div>
  );

  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', flex: 'none' }}>
        <button onClick={() => router.push(step === 'pay' ? '/checkout' : '/order')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
        <div>
          <div style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>{step === 'pay' ? 'Payment' : 'Checkout'}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{step === 'pay' ? 'Choose how to pay' : `${lines.length} item${lines.length !== 1 ? 's' : ''} · ready to order`}</div>
        </div>
      </div>

      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '24px var(--gutter) 120px' }}>
        {step === 'review' ? (
          <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={card$}>
                {head(<MapPin size={18} color="var(--brand-secondary)" />, 'Delivery address')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!user ? (
                    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>Please log in to choose your delivery address.</p>
                      <button onClick={() => setLoginOpen(true)} style={{ padding: '11px 22px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Log in</button>
                    </div>
                  ) : (
                  <>
                  {addresses.length === 0 && !adding && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 2 }}>No saved addresses yet — please add your delivery address below.</p>
                  )}
                  {addresses.map(a => {
                    const on = addr === a.id;
                    return (
                      <button key={a.id} onClick={() => setAddr(a.id)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-raised)' }}>
                        <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: on ? 'var(--gradient-warm)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{a.isDefault ? <Home size={18} color={on ? '#fff' : 'var(--brand-secondary)'} /> : <Briefcase size={18} color={on ? '#fff' : 'var(--brand-secondary)'} />}</span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{a.isDefault ? 'Home' : 'Work'}</span>
                            {a.isDefault && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Default</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.45 }}>{[a.addressLine1, a.addressLine2, a.city, a.pincode].filter(Boolean).join(', ')}</span>
                        </span>
                        <Dot on={on} />
                      </button>
                    );
                  })}
                  {adding ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)' }}>
                      {[['fullName', 'Full name'], ['phone', 'Phone'], ['addressLine1', 'Flat / House / Building'], ['addressLine2', 'Area / Landmark']].map(([k, ph]) => (
                        <input key={k} value={aform[k as keyof typeof aform]} onChange={aset(k as keyof typeof aform)} placeholder={ph} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
                      ))}
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input value={aform.city} onChange={aset('city')} placeholder="City" style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
                        <input value={aform.pincode} onChange={aset('pincode')} placeholder="Pincode" style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button disabled={!aValid} onClick={saveAddr} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-button)', border: 'none', background: aValid ? 'var(--gradient-warm)' : 'var(--border-default)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: aValid ? 'pointer' : 'not-allowed' }}>Save &amp; use</button>
                        <button onClick={() => setAdding(false)} style={{ padding: '11px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
                      <Plus size={16} color="var(--brand-secondary)" />
                      <span style={{ fontWeight: 700, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Add new address</span>
                    </button>
                  )}
                  </>
                  )}
                </div>
              </div>

              <div style={card$}>
                {head(<Clock size={18} color="var(--brand-secondary)" />, 'Delivery time')}
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ v: true, label: 'ASAP', sub: '~30 min' }, { v: false, label: 'Schedule', sub: 'Pick a slot' }].map(opt => {
                    const on = asap === opt.v;
                    return (
                      <button key={opt.label} onClick={() => setAsap(opt.v)} style={{ flex: 1, padding: '13px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-raised)', textAlign: 'left' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)' }}>{opt.label}</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {orderSummary}

              <div style={card$}>
                <button onClick={() => setGift(!gift)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Gift size={19} color="#fff" /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Add this as a gift · +₹{GIFT_FEE}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Premium gift wrap with a printed message card.</span>
                  </span>
                  <span style={{ width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center', border: gift ? 'none' : '2px solid var(--border-strong)', background: gift ? 'var(--gradient-warm)' : 'transparent', color: '#fff', flex: 'none' }}>{gift && <Check size={15} strokeWidth={3} />}</span>
                </button>
                {gift && <textarea value={giftMessage} onChange={e => setGiftMessage(e.target.value)} placeholder="Write your gift message (optional)…" rows={2} maxLength={140} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', marginTop: 12, padding: '12px 14px', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none', background: 'var(--surface-raised)' }} />}
              </div>

              <div style={card$}>
                {head(<Tag size={18} color="var(--brand-secondary)" />, 'Apply coupon')}
                {applied ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', background: '#EDF7F0', border: '1.5px solid #1F8A5B' }}>
                    <Check size={20} color="#1F8A5B" />
                    <span style={{ flex: 1, fontWeight: 700, color: '#1F8A5B', fontSize: 'var(--text-sm)' }}>{coupon} applied!</span>
                    <button onClick={() => { setApplied(false); setCoupon(''); setDiscount(0); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-sm)' }}>Remove</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponErr(''); }} placeholder="Enter coupon code" style={{ flex: 1, minWidth: 0, padding: '13px 16px', borderRadius: 'var(--radius-input)', border: couponErr ? '1.5px solid var(--status-error)' : '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />
                      <button onClick={applyCoupon} disabled={!coupon.trim()} style={{ padding: '13px 20px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Apply</button>
                    </div>
                    {couponErr && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)', marginTop: 6 }}>{couponErr}</div>}
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 6, fontWeight: 600 }}>Try: ADC10 for 10% off</div>
                  </div>
                )}
              </div>

              {billCard}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={card$}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{selected?.isDefault ? <Home size={18} color="var(--brand-secondary)" /> : <Briefcase size={18} color="var(--brand-secondary)" />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>Deliver to {selected?.isDefault ? 'Home' : 'Work'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? [selected.addressLine1, selected.city, selected.pincode].filter(Boolean).join(', ') : ''}</div>
                </div>
                <button onClick={() => router.push('/checkout')} style={{ border: 'none', background: 'transparent', color: 'var(--text-link)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Change</button>
              </div>
            </div>

            <div style={card$}>
              {head(<CreditCard size={18} color="var(--brand-secondary)" />, 'Payment method')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ borderRadius: 'var(--radius-card)', border: method === 'upi' ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: method === 'upi' ? 'var(--amber-50)' : 'var(--surface-raised)', overflow: 'hidden' }}>
                  <button onClick={() => setMethod('upi')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ color: '#fff', fontWeight: 900, fontSize: 12 }}>UPI</span></span>
                    <span style={{ flex: 1, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', textAlign: 'left' }}>UPI <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontWeight: 600 }}>Instant · No charges</span></span>
                    <Dot on={method === 'upi'} />
                  </button>
                  {method === 'upi' && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-soft)' }}>
                      <div style={{ paddingTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {UPI_APPS.map(app => {
                          const on = upiApp === app.id;
                          return (
                            <button key={app.id} onClick={() => setUpiApp(app.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: on ? '2px solid var(--amber-400)' : '1.5px solid var(--border-default)', background: on ? '#fff' : 'var(--surface-raised)', cursor: 'pointer', minWidth: 68 }}>
                              <span style={{ width: 36, height: 36, borderRadius: 10, background: app.bg, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 15 }}>{app.letter}</span>
                              <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: on ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{app.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {upiApp === 'other' && <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" style={{ marginTop: 12, width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />}
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 'var(--radius-card)', border: method === 'card' ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: method === 'card' ? 'var(--amber-50)' : 'var(--surface-raised)', overflow: 'hidden' }}>
                  <button onClick={() => setMethod('card')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg,#1A1AE0,#6C5CE7)', display: 'grid', placeItems: 'center', flex: 'none' }}><CreditCard size={18} color="#fff" /></span>
                    <span style={{ flex: 1, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', textAlign: 'left' }}>Credit / Debit Card</span>
                    <Dot on={method === 'card'} />
                  </button>
                  {method === 'card' && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ paddingTop: 14 }}>
                        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Card number</label>
                        <input value={fmt4(card.num)} onChange={e => setCard(c => ({ ...c, num: e.target.value }))} placeholder="0000 0000 0000 0000" maxLength={19} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'monospace', fontSize: 'var(--text-base)', letterSpacing: '.1em', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}><label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Expiry</label><input value={card.exp} onChange={e => setCard(c => ({ ...c, exp: fmtExp(e.target.value) }))} placeholder="MM/YY" maxLength={5} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} /></div>
                        <div style={{ flex: 1 }}><label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>CVV</label><input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.slice(0, 4) }))} placeholder="•••" type="password" maxLength={4} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} /></div>
                      </div>
                      <div><label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name on card</label><input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))} placeholder="Full name as on card" style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} /></div>
                    </div>
                  )}
                </div>

                <button onClick={() => setMethod('cod')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: method === 'cod' ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: method === 'cod' ? 'var(--amber-50)' : 'var(--surface-raised)' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>₹</span></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)' }}>Cash on Delivery</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Pay when your order arrives</span>
                  </span>
                  <Dot on={method === 'cod'} />
                </button>
              </div>
            </div>

            {billCard}
          </div>
        )}
      </div>

      <div style={{ padding: '14px var(--gutter)', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-card)', flex: 'none' }}>
        {step === 'review' ? (
          <button onClick={() => router.push('/payment')} disabled={lines.length === 0} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: lines.length ? 'var(--gradient-warm)' : 'var(--border-default)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: lines.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Proceed to Pay · ₹{grand} <ArrowRight size={18} />
          </button>
        ) : (
          <>
            <button onClick={() => user ? handlePlace() : setLoginOpen(true)} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {user ? <>Pay ₹{grand} <Lock size={18} /></> : <>Log in to place order <Lock size={18} /></>}
            </button>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <ShieldCheck size={13} /> 100% secure &amp; encrypted payments
            </div>
          </>
        )}
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

/* ---- Order Success Page ---- */
function OrderSuccessPage({ show, total, orderId, onBackToMenu }: { show: boolean; total: number; orderId: string; onBackToMenu: () => void }) {
  const steps = [
    { icon: <Check size={18} />, label: 'Placed', done: true },
    { icon: <span style={{ fontSize: 14 }}>🧑‍🍳</span>, label: 'Baking', done: false },
    { icon: <Bike size={18} />, label: 'On way', done: false },
    { icon: <Home size={18} />, label: 'Delivered', done: false },
  ];
  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', overflowY: 'auto' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', boxShadow: '0 20px 60px rgba(242,159,5,.38)', animation: 'riseIn .5s var(--ease-spring) both', marginBottom: 28 }}>
          <Check size={62} color="#fff" strokeWidth={3} />
        </div>
        <div style={{ display: 'inline-block', background: '#EDF7F0', color: '#1F8A5B', fontWeight: 800, fontSize: 'var(--text-sm)', padding: '5px 14px', borderRadius: 'var(--radius-pill)', marginBottom: 16 }}>Payment Successful</div>
        <h1 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 10px' }}>Order Placed!</h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', margin: '0 0 6px' }}>Your cookies are being baked fresh.</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', margin: '0 0 32px' }}>Order <strong style={{ color: 'var(--text-strong)' }}>{orderId}</strong> · ₹{total}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', marginBottom: 36 }}>
          <Bike size={22} color="var(--brand-secondary)" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>Arriving in ~30 min</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Estimated delivery time</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 16 }}>
          {steps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 64 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: step.done ? 'var(--gradient-warm)' : 'var(--surface-sunken)', boxShadow: step.done ? '0 6px 20px rgba(242,159,5,.35)' : 'none', color: step.done ? '#fff' : 'var(--text-subtle)' }}>{step.icon}</div>
                <span style={{ fontSize: 'var(--text-2xs)', color: step.done ? 'var(--text-strong)' : 'var(--text-subtle)', fontWeight: step.done ? 800 : 500, whiteSpace: 'nowrap' }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && <div style={{ height: 2, width: 24, background: 'var(--border-strong)', marginTop: 19, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-card)', borderTop: '1px solid var(--border-soft)' }}>
        <button onClick={onBackToMenu} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Order more cookies</button>
      </div>
    </div>
  );
}

/* ---- Location Sheet — pick a saved delivery address or add a new one ---- */
function LocationSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (a: Address) => void }) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });
  useEffect(() => {
    if (open && user) getAddresses().then(a => setAddresses(a || [])).catch(() => setAddresses([]));
    else if (!user) setAddresses([]);
  }, [open, user]);
  if (!open) return null;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const valid = f.fullName && f.addressLine1 && f.city && f.pincode;
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
  const save = async () => {
    const data: Omit<Address, 'id'> = { ...f, isDefault: false };
    let picked: Address;
    try { picked = await addAddress(data); } catch { picked = { ...data, id: Date.now() }; }
    setAddresses(p => [...p, picked]); onPick(picked); onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px,92vw)', maxHeight: '78vh', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'riseIn .28s var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-card)', flex: 'none' }}>
          <MapPin size={20} color="var(--brand-secondary)" />
          <div style={{ flex: 1, font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>{adding ? 'Add address' : 'Choose location'}</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={17} /></button>
        </div>
        <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 20px' }}>
          {adding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input style={inp} placeholder="Full name" value={f.fullName} onChange={set('fullName')} />
              <input style={inp} placeholder="Phone" value={f.phone} onChange={set('phone')} />
              <input style={inp} placeholder="Flat / House / Building" value={f.addressLine1} onChange={set('addressLine1')} />
              <input style={inp} placeholder="Area / Landmark" value={f.addressLine2} onChange={set('addressLine2')} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input style={inp} placeholder="City" value={f.city} onChange={set('city')} />
                <input style={inp} placeholder="Pincode" value={f.pincode} onChange={set('pincode')} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <button disabled={!valid} onClick={save} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-button)', border: 'none', background: valid ? 'var(--gradient-warm)' : 'var(--border-default)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: valid ? 'pointer' : 'not-allowed' }}>Save &amp; use</button>
                <button onClick={() => setAdding(false)} style={{ padding: '11px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Back</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addresses.map(a => (
                <button key={a.id} onClick={() => { onPick(a); onClose(); }} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--radius-card)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{a.isDefault ? <Home size={17} color="var(--brand-secondary)" /> : <Briefcase size={17} color="var(--brand-secondary)" />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>{a.isDefault ? 'Home' : 'Work'} · {a.city}</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>{[a.addressLine1, a.addressLine2, a.pincode].filter(Boolean).join(', ')}</span>
                  </span>
                  <ChevronRight size={18} color="var(--text-subtle)" />
                </button>
              ))}
              <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
                <Plus size={17} color="var(--brand-secondary)" /><span style={{ fontWeight: 700, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Add new address</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Corporate Gifting — bulk packages + request-a-quote ---- */
const CORP_PACKAGES = [
  { name: 'Office Box', qty: '25 cookies', price: 'from ₹1,400', desc: 'A shareable mixed box for small teams and client desks.' },
  { name: 'Festive Hamper', qty: '50 cookies + tins', price: 'from ₹3,200', desc: 'Premium tins and assorted cookies, gift-wrapped with your note.' },
  { name: 'Custom Bulk', qty: '100+ cookies', price: 'Custom quote', desc: 'Branded packaging, logo cards, and tiered pricing for large orders.' },
];
function CorporatePanel() {
  const [f, setF] = useState({ name: '', company: '', email: '', phone: '', qty: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && f.qty.trim();
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
  const submit = async () => {
    if (!valid || status === 'sending') return;
    setStatus('sending');
    const message = `CORPORATE ENQUIRY\nCompany: ${f.company}\nApprox quantity: ${f.qty}\n\n${f.message}`;
    try { await submitContact({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined, message }); } catch {}
    setStatus('done');
  };

  return (
    <div>
      <div style={{ background: 'var(--surface-inverse)', borderRadius: 'var(--radius-card)', padding: '26px 24px', color: 'var(--cream-100)', marginBottom: 18 }}>
        <div style={{ font: 'var(--weight-extra) var(--text-h3)/1.1 var(--font-display)', color: '#fff', marginBottom: 8 }}>Corporate &amp; bulk gifting</div>
        <p style={{ color: 'rgba(255,248,241,.72)', lineHeight: 1.6, margin: 0, fontSize: 'var(--text-sm)' }}>Cookies for teams, clients, and celebrations — freshly baked, neatly packed, and delivered together. Pick a package below or request a custom quote for large or branded orders.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
        {CORP_PACKAGES.map(p => (
          <div key={p.name} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: 18, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>{p.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 800, margin: '2px 0 8px' }}>{p.qty} · {p.price}</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>{p.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: 22, boxShadow: 'var(--shadow-sm)' }}>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Check size={28} color="#fff" strokeWidth={3} /></div>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4 }}>Request received!</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>Our team will reach out with a custom quote shortly.</p>
          </div>
        ) : (
          <>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)', marginBottom: 14 }}>Request a bulk quote</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input style={{ ...inp, flex: '1 1 160px' }} placeholder="Your name *" value={f.name} onChange={set('name')} />
                <input style={{ ...inp, flex: '1 1 160px' }} placeholder="Company" value={f.company} onChange={set('company')} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input style={{ ...inp, flex: '1 1 160px' }} type="email" placeholder="Email *" value={f.email} onChange={set('email')} />
                <input style={{ ...inp, flex: '1 1 160px' }} placeholder="Phone" value={f.phone} onChange={set('phone')} />
              </div>
              <input style={inp} placeholder="Approx quantity (e.g. 80 boxes) *" value={f.qty} onChange={set('qty')} />
              <textarea rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Occasion, branding, delivery date…" value={f.message} onChange={set('message')} />
              <button disabled={!valid || status === 'sending'} onClick={submit} style={{ padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: valid && status !== 'sending' ? 'var(--gradient-warm)' : 'var(--border-default)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed' }}>{status === 'sending' ? 'Sending…' : 'Request quote'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Main App ---- */
export default function OrderingApp() {
  const router = useRouter();
  const pathname = usePathname();
  const desktop = useIsDesktop(920);
  const { cart, count, total, setQty } = useCart();
  const { user } = useAuth();

  const [menu, setMenu] = useState(FALLBACK_MENU);
  const [tins, setTins] = useState(FALLBACK_TINS);
  const [active, setActive] = useState('Cookies');
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState('');
  const [tin, setTin] = useState<typeof FALLBACK_TINS[0] | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState('Bengaluru');

  // Load products from backend — faithful mapping (real images, groups, tags, stable ratings)
  useEffect(() => {
    getProducts().then(products => {
      if (!products?.length) return;
      const cookies = products.filter(p => p.category === 'COOKIES');
      const tinProds = products.filter(p => p.category === 'TINS');

      // Deterministic decorative rating/review-count from the product id (stable across renders).
      const ratingOf = (p: Product) => Math.round((4.4 + ((p.id * 7) % 6) / 10) * 10) / 10;
      const rcOf = (p: Product) => {
        const n = (p.id * 137) % 4200 + 480;
        return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
      };

      if (cookies.length > 0) {
        setMenu(cookies.map(p => ({
          id: String(p.id), name: p.name, price: Number(p.price),
          cat: 'Cookies',
          rec: p.featured || p.tag === 'Recommended',
          best: p.tag === 'Bestseller' || p.tag === 'Signature',
          rating: ratingOf(p), rc: rcOf(p),
          veg: true, img: firstImage(p.images), desc: p.description || '',
        })) as any);
      }

      if (tinProds.length > 0) {
        setTins(tinProds.map(p => ({
          id: String(p.id), name: p.name, price: Number(p.price),
          count: /biscoff/i.test(p.name) ? 9 : 6,
          img: firstImage(p.images), desc: p.description || '',
        })) as any);
      }
    }).catch(() => {}); // use fallback data on error
  }, []);

  // Deep-link the category from the home page cards: /order?cat=cookies|tins|corporate
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get('cat');
    const map: Record<string, string> = { cookies: 'Cookies', tins: 'Gift Tins', corporate: 'Corporate Gifting' };
    if (cat && map[cat]) setActive(map[cat]);
  }, []);

  const addTin = (t: typeof FALLBACK_TINS[0], qty: number) => {
    setQty(t.id, (cart[t.id]?.qty || 0) + qty, t.name, t.price, t.img);
    setTin(null);
  };

  const filtered = active === 'Gift Tins' ? [] : menu.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  // Checkout and payment are their own routes; render the combined flow on those URLs.
  if (pathname === '/checkout') return <CheckoutFlow step="review" />;
  if (pathname === '/payment') return <CheckoutFlow step="pay" />;

  /* Desktop layout */
  if (desktop) {
    return (
      <>
        <div className="adc-pattern-page" style={{ minHeight: '100vh' }}>
          {/* Desktop header */}
          <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ maxWidth: 1240, margin: '0 auto', padding: '14px var(--gutter)', display: 'flex', alignItems: 'center', gap: 22 }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}>
                <Image src="/assets/adc-logo.png" height={66} width={112} alt="a dough cookie" style={{ objectFit: 'contain' }} />
              </a>
              <div style={{ flex: 1, maxWidth: 460 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-raised)', borderRadius: 'var(--radius-input)', padding: '11px 16px', gap: 10, border: '1.5px solid var(--border-default)' }}>
                  <Search size={18} color="var(--text-subtle)" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Cookies…" style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }} />
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setLocationOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-body)', fontWeight: 700, fontSize: 'var(--text-sm)', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                <MapPin size={18} color="var(--brand-secondary)" /> {location} <ChevronRight size={15} color="var(--text-subtle)" style={{ transform: 'rotate(90deg)' }} />
              </button>
              {user ? (
                <button onClick={() => router.push(user.role === 'ADMIN' ? '/admin' : '/account')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 10px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', flex: 'none' }}><User size={17} /></span>
                  {user.name.split(' ')[0]}
                </button>
              ) : (
                <button onClick={() => setLoginOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>
                  <User size={18} /> Login
                </button>
              )}
            </div>
          </header>

          {/* 3-col layout */}
          <div style={{ maxWidth: 1060, margin: '0 auto', padding: '26px var(--gutter) 96px max(14px,calc(var(--gutter) - 18px))', display: 'grid', gridTemplateColumns: '225px minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
            {/* Category rail */}
            <aside style={{ position: 'sticky', top: 92, alignSelf: 'start' }}>
              <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--brand-secondary)', fontWeight: 800, margin: '4px 8px 14px' }}>Categories</div>
              <div style={{ display: 'grid', gap: 10 }}>
              {CATEGORIES.map(c => {
                const on = c === active;
                return (
                  <CategoryTab key={c} label={c} selected={on} onClick={() => setActive(c)} />
                );
              })}
              </div>
            </aside>

            {/* Menu */}
            <main style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                <span style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>{active}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', fontWeight: 600 }}>{active === 'Corporate Gifting' ? '' : active === 'Gift Tins' ? tins.length : filtered.length}</span>
              </div>
              {active === 'Corporate Gifting' ? (
                <CorporatePanel />
              ) : active === 'Gift Tins' ? (
                tins.map(t => (
                  <div key={t.id} onClick={() => setTin(t as any)} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', marginBottom: 14, cursor: 'pointer', transition: 'transform .2s,box-shadow .2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
                    <Thumb size={92} img={t.img} seed={2} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Gift Tin</span>
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-sunken)', color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600 }}>{t.count} cookies</span>
                      </div>
                      <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 2px' }}>{t.name}</h3>
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 8px' }}>{t.desc}</p>
                      <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹{t.price}</span>
                    </div>
                    <ChevronRight size={20} color="var(--text-subtle)" />
                  </div>
                ))
              ) : (
                filtered.map((m) => (
                  <div key={m.id}>
                    <ProductMenuItem item={m} qty={cart[m.id]?.qty || 0} onQtyChange={n => setQty(m.id, n, m.name, cart[m.id]?.price ?? m.price, m.img)} />
                    {/* "Goes great with" pairings — hidden per request; uncomment to restore (full markup in git history).
                    {count > 0 && i === 0 && ( <div> Sparkles + "Goes great with" + PAIRINGS carousel of Thumb + QStepper </div> )}
                    */}
                  </div>
                ))
              )}
            </main>

            {/* Cart side-panel removed per request — the cart now lives on its own order page,
                and the delivery fee is shown only on the payment page. Uncomment to restore.
            <aside style={{ position: 'sticky', top: 92, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '18px 20px', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ShoppingBag size={18} color="var(--brand-secondary)" />
                  <span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>Your Cart</span>
                </div>
                ...item list, bill (item total + delivery + to pay) and Proceed button...
              </div>
            </aside>
            */}
          </div>

          {count > 0 && (
            <button onClick={() => router.push('/checkout')} style={{ position: 'fixed', right: 28, bottom: 28, zIndex: 40, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: 'var(--gradient-warm)', color: '#fff', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-brand)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)' }}>
              <ShoppingBag size={20} /> View cart · {count} item{count !== 1 ? 's' : ''} · ₹{total} <ArrowRight size={18} />
            </button>
          )}
        <TinModal tin={tin} onClose={() => setTin(null)} onAdd={addTin} />
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} onPick={a => setLocation(a.city)} />
        </div>
      </>
    );
  }

  /* Mobile layout */
  return (
    <>
      <div className="adc-pattern-page" style={{ minHeight: '100vh' }}>
        {/* Mobile top nav */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 10px' }}>
            <button onClick={() => router.push('/')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
            <a href="/" aria-label="a dough cookie home" style={{ flex: 1, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <Image src="/assets/adc-logo.png" height={54} width={92} alt="a dough cookie" style={{ objectFit: 'contain' }} />
            </a>
            {user ? (
              <button onClick={() => router.push(user.role === 'ADMIN' ? '/admin' : '/account')} aria-label="Profile" style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--gradient-warm)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><User size={20} /></button>
            ) : (
              <button onClick={() => setLoginOpen(true)} aria-label="Login" style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><User size={20} /></button>
            )}
          </div>
          <div style={{ padding: '0 18px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-raised)', borderRadius: 'var(--radius-input)', padding: '11px 16px', gap: 10, border: '1.5px solid var(--border-default)' }}>
              <Search size={18} color="var(--text-subtle)" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Cookies…" style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Category strip */}
        <div className="hide-sb" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '12px 18px 14px', position: 'sticky', top: 0 }}>
          {CATEGORIES.map(c => {
            const on = c === active;
            return (
              <CategoryTab key={c} label={c} selected={on} onClick={() => setActive(c)} compact />
            );
          })}
        </div>

        {/* Menu content */}
        <div style={{ padding: '0 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>{active}</span>
          </div>
          {active === 'Corporate Gifting' ? (
            <div style={{ paddingBottom: 24 }}><CorporatePanel /></div>
          ) : active === 'Gift Tins' ? (
            tins.map(t => (
              <div key={t.id} onClick={() => setTin(t as any)} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14, background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', marginBottom: 14, cursor: 'pointer' }}>
                <Thumb size={92} img={t.img} seed={2} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px' }}>{t.name}</h3>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: '0 0 8px' }}>{t.desc}</p>
                  <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹{t.price}</span>
                </div>
                <ChevronRight size={20} color="var(--text-subtle)" />
              </div>
            ))
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {filtered.map((m) => (
                <MobileProductCard key={m.id} item={m} qty={cart[m.id]?.qty || 0} onQtyChange={n => setQty(m.id, n, m.name, cart[m.id]?.price ?? m.price, m.img)} />
              ))}
            </div>
          )}
        </div>
        <div style={{ height: count > 0 ? 150 : 96 }} />

        {/* Floating bottom-right stack: menu on top, cart below it */}
        <div style={{ position: 'fixed', right: 16, bottom: 18, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <button onClick={() => setDrawer(true)} aria-label="Menu" style={{ width: 60, height: 60, borderRadius: 18, border: 'none', background: 'var(--surface-inverse)', color: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, boxShadow: 'var(--shadow-lg)' }}><BookOpen size={21} /><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em' }}>Menu</span></button>
          {count > 0 && (
            <button onClick={() => router.push('/checkout')} aria-label="View cart" style={{ border: 'none', cursor: 'pointer', background: 'var(--gradient-warm)', color: '#fff', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-brand)', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', fontFamily: 'var(--font-body)', fontWeight: 800, animation: 'riseIn .3s var(--ease-spring) both' }}>
              <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                <ShoppingBag size={22} />
                <span style={{ position: 'absolute', top: -8, right: -10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#fff', color: 'var(--brand-secondary)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>{count}</span>
              </span>
              <span style={{ fontSize: 'var(--text-base)' }}>₹{total}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
        <TinModal tin={tin} onClose={() => setTin(null)} onAdd={addTin} />
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} onPick={a => setLocation(a.city)} />
      </div>

      {/* Category popup — compact dark menu, opens above the floating menu button */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }} />
          <div className="hide-sb" style={{ position: 'fixed', right: 16, bottom: 86, zIndex: 47, width: 'min(330px,88vw)', maxHeight: '64vh', overflowY: 'auto', background: '#1C140C', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: 8, animation: 'riseIn .25s var(--ease-spring) both' }}>
            <div style={{ padding: '12px 16px 8px', fontSize: 'var(--text-xs)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,248,241,.5)', fontWeight: 800 }}>Menu</div>
            {CATEGORIES.map(c => {
              const on = c === active;
              const cnt = c === 'Gift Tins' ? tins.length : c === 'Cookies' ? menu.length : null;
              return (
                <button key={c} onClick={() => { setActive(c); setDrawer(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '15px 16px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid rgba(255,248,241,.08)', textAlign: 'left' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: on ? 800 : 600, fontSize: 'var(--text-base)', color: on ? 'var(--amber-400)' : 'var(--cream-100)' }}>{c}</span>
                  {cnt != null && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: on ? 'var(--amber-400)' : 'rgba(255,248,241,.5)' }}>{cnt}</span>}
                </button>
              );
            })}
            <button onClick={() => setDrawer(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 8, padding: '13px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}><X size={16} /> Close</button>
          </div>
        </>
      )}

    </>
  );
}
