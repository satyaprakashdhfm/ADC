'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, User, BookOpen, X, Search, ShoppingBag, ChevronRight, ChevronDown, Sparkles, Check, ArrowRight, Gift, MapPin, CreditCard, Bike, Home, Briefcase, Lock, ShieldCheck, Tag, Receipt, Clock, Plus, Cookie, Navigation, Truck, Pencil, PackageCheck } from 'lucide-react';
import { STORES } from '@/lib/stores';
import { LocationPill, LocationBanner } from '@/components/storefront/LocationPicker';
import { useCart, GIFT_FEE } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import LoginModal from './LoginModal';
import MascotLoader from '@/components/MascotLoader';
import { getProducts, getAddresses, addAddress, updateAddress, validateCoupon, createOrder, createRazorpayOrder, verifyPayment, submitContact, firstImage, checkDeliveryPin, getAvailableCoupons, type Product, type Address, type OrderItemInput, type DeliveryCheck, type AvailableCoupon } from '@/lib/api';
import { whatsappLink, SITE_PHONE } from '@/lib/site';

// STALL MODE — temporary, for the pop-up-stall launch: online payment is switched off and the
// payment step instead points people at WhatsApp/call/in-person ordering. Nothing below this is
// deleted — every bit of the real checkout/payment flow still exists, just not rendered while
// this is true. Flip back to false (and it all comes straight back) once online payment resumes.
const STALL_MODE = true;
// Fill in with today's actual stall location/time once known — shown on the payment-replacement panel.
const TODAYS_STALL = '';

/* ---- Data ---- */
const CATEGORIES = ['Cookies', 'Cookie Tins', 'Corporate Gifting'];

const CATEGORY_META = {
  Cookies: { icon: Cookie },
  'Cookie Tins': { icon: Gift },
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
          background: selected ? 'var(--teal-50)' : 'var(--panel-74)',
          color: selected ? 'var(--brand-secondary)' : 'var(--text-muted)',
          boxShadow: selected ? 'inset 0 0 0 1px var(--teal-500-14)' : 'inset 0 0 0 1px var(--border-soft)',
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
  { id: 'special', name: 'A Dough Cookie Special', price: 90, cat: 'Cookies', best: true, rating: 4.8, rc: '2.1k', veg: true, img: '/assets/products/adc-special.jpg', desc: 'Our signature — browned butter, sea salt, three chocolates.' },
  { id: 'redvelvet', name: 'Red Velvet With Cheese', price: 90, cat: 'Cookies', rating: 4.6, rc: '910', veg: true, img: '/assets/products/red-velvet.jpg', desc: 'Cocoa-red velvet cookie with a cream-cheese filled core.' },
  { id: 'biscoff', name: 'Biscoff Filled', price: 110, cat: 'Cookies', best: true, rating: 4.9, rc: '4.0k', veg: true, img: '/assets/products/peanut-butter.jpg', desc: 'Molten Biscoff spread inside a caramelised cookie shell.' },
  { id: 'nutella', name: 'Nutella Filled', price: 90, cat: 'Cookies', rec: true, rating: 4.7, rc: '2.6k', veg: true, img: '/assets/products/caramel-cashew.jpg', desc: 'Gooey Nutella centre in a soft chocolate cookie.' },
];

const FALLBACK_TINS = [
  { id: 'nutella-tin', name: 'Nutella Tin', price: 600, count: 6, img: '/assets/products/coffee-almond.jpg', desc: 'Six premium cookies in a keepsake tin.' },
  { id: 'biscoff-tin', name: 'Biscoff Tin', price: 850, count: 9, img: '/assets/products/m-and-m.jpg', desc: 'Nine Biscoff-filled cookies, gift-ready.' },
];

// Search box with a live product-suggestions dropdown. Typing shows matching cookies; an empty,
// focused box shows popular picks (rec/best). Picking one floats it to the top of the menu.
type SuggestItem = { id: string; name: string; price: number; img: string | null; rec?: boolean; best?: boolean };
function SearchSuggest({ value, onChange, onPick, items, placeholder, wrapStyle }: {
  value: string; onChange: (v: string) => void; onPick: (name: string) => void;
  items: SuggestItem[]; placeholder: string; wrapStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = (q ? items.filter(i => i.name.toLowerCase().includes(q)) : items.filter(i => i.rec || i.best)).slice(0, 6);
  return (
    <div style={{ position: 'relative', ...wrapStyle }}>
      <Search size={18} color="var(--text-subtle)" />
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }}
      />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 60, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px 4px', fontSize: 'var(--text-2xs)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 800 }}>{q ? 'Matches' : 'Popular picks'}</div>
          {matches.map(m => (
            <button key={m.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(m.name); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-sunken)', flex: 'none', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {m.img ? <Image src={m.img} alt="" width={38} height={38} style={{ width: 38, height: 38, objectFit: 'cover' }} /> : <Cookie size={18} color="var(--brand-secondary)" />}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--brand-secondary)', flex: 'none' }}>₹{m.price}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---- Razorpay Checkout (popup) ---- */
interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string; }
interface RazorpayOptions {
  key: string; order_id: string; amount: number; currency: string;
  name: string; description?: string; image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (resp: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void; }
declare global { interface Window { Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance; } }

// Inject Razorpay's checkout.js once; resolves true when window.Razorpay is ready.
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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

/* ---- Date helpers — customers want an actual date, not a raw "N days" ---- */
const _WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const _MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (d: Date) => `${_WD[d.getDay()]}, ${d.getDate()} ${_MO[d.getMonth()]}`;
function parseServerDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}
function addDays(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d; }

/* ---- Gift occasions — a short, friendly tag on the gift note ---- */
const GIFT_OCCASIONS = ['Birthday', 'Anniversary', 'Wedding', 'Love', 'Thank you', 'Congrats', 'Other'];

/* ---- Checkout progress — Cart › Checkout › Payment, so the page tells you where you are ---- */
function CheckoutStepper({ current, inline = false }: { current: 'review' | 'pay'; inline?: boolean }) {
  const steps = ['Cart', 'Checkout', 'Payment'];
  const activeIndex = current === 'pay' ? 2 : 1; // by the time we're here, the cart step is behind us
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: inline ? 0 : '0 var(--gutter) 12px' }}>
      {steps.map((label, i) => {
        const done = i < activeIndex;
        const isCurrent = i === activeIndex;
        const on = done || isCurrent;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 'clamp(76px,22vw,104px)' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, flex: 'none', background: on ? 'var(--gradient-warm)' : 'transparent', color: on ? 'var(--white)' : 'var(--text-subtle)', border: on ? 'none' : '2px solid var(--border-strong)', boxShadow: isCurrent ? 'var(--shadow-brand)' : 'none' }}>
                {done ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--text-strong)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 'clamp(24px,8vw,56px)', height: 2, marginTop: 13, borderRadius: 2, flexShrink: 0, background: i < activeIndex ? 'var(--gradient-warm)' : 'var(--border-strong)' }} />}
          </div>
        );
      })}
    </div>
  );
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
    'radial-gradient(120% 120% at 35% 28%,var(--amber-300),var(--orange-500))',
    'radial-gradient(120% 120% at 35% 28%,var(--amber-400),var(--orange-600))',
    'radial-gradient(120% 120% at 35% 28%,var(--amber-200),var(--amber-500))',
  ];
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--radius-image)', background: grads[seed % 3], boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden', flex: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 32% 28%,var(--white-40),transparent 42%)' }} />
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

// Short, precise card blurbs (shown in full on the cards) keyed by product name —
// falls back to the product's own description for anything not listed here.
const SHORT_DESC: Record<string, string> = {
  'Chocolate Chip': 'Buttery dough, dark chocolate chips, soft centre.',
  'Double Choc Chip': 'Cocoa dough loaded with dark chocolate chunks.',
  'Raagi (Gluten Free)': 'Wholesome finger-millet cookie, naturally gluten-free.',
  'Matcha': 'Stone-ground matcha with white-chocolate chips.',
  'A Dough Cookie Special': 'Browned butter, sea salt, three chocolates.',
  'Red Velvet With Cheese': 'Cocoa-red velvet with a cream-cheese centre.',
  'Biscoff Filled': 'Molten Biscoff inside a caramelised shell.',
  'Nutella Filled': 'Gooey Nutella centre in a soft chocolate cookie.',
  'Nutella Tin': 'Six Nutella-filled cookies in a gift tin.',
  'Biscoff Tin': 'Nine Biscoff-filled cookies, gift-ready.',
};

/* ---- Compact mobile product card — two-up grid, no ratings, ADD goes straight to cart ---- */
function MobileProductCard({ item, qty, onQtyChange }: { item: typeof FALLBACK_MENU[0]; qty: number; onQtyChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-image)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
        <Image src={item.img} alt={item.name} fill sizes="50vw" style={{ objectFit: 'cover' }} />
        {(item as any).best && <span style={{ position: 'absolute', top: 6, left: 6, padding: '2px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Bestseller</span>}
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.veg && <span style={{ width: 13, height: 13, border: '2px solid var(--mark-veg)', borderRadius: 2, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          <h3 style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>{SHORT_DESC[item.name] ?? item.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>₹{item.price}</span>
          {qty === 0 ? (
            <button onClick={() => onQtyChange(1)} style={{ padding: '7px 18px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>ADD</button>
          ) : (
            <QStepper value={qty} onChange={onQtyChange} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Roomier DESKTOP product card — bigger image, full description, ADD/stepper (desktop only) ---- */
function DeskProductCard({ item, qty, onQtyChange, badge }: { item: typeof FALLBACK_MENU[0]; qty: number; onQtyChange: (n: number) => void; badge?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', overflow: 'hidden', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
        <Image src={item.img} alt={item.name} fill sizes="(max-width:1280px) 40vw, 440px" style={{ objectFit: 'cover' }} />
        {(badge || (item as { best?: boolean }).best) && <span style={{ position: 'absolute', top: 10, left: 10, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>{badge || 'Bestseller'}</span>}
      </div>
      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {item.veg && <span style={{ width: 14, height: 14, border: '2px solid var(--mark-veg)', borderRadius: 2, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          <h3 style={{ font: 'var(--weight-bold) var(--text-h4)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{item.name}</h3>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{item.price}</span>
          {qty === 0
            ? <button onClick={() => onQtyChange(1)} style={{ padding: '9px 26px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>ADD</button>
            : <QStepper value={qty} onChange={onQtyChange} />}
        </div>
      </div>
    </div>
  );
}

/* ---- Loading skeleton (static, no animation) — shown until real products arrive so old images never flash ---- */
function SkeletonCard() {
  const bar = (w: string, h: number, mb = 0): React.CSSProperties => ({ width: w, height: h, borderRadius: 6, background: 'var(--surface-raised)', marginBottom: mb });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-soft)', overflow: 'hidden' }}>
      <div style={{ width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-raised)' }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={bar('62%', 16, 10)} />
        <div style={bar('100%', 10, 6)} />
        <div style={bar('84%', 10, 14)} />
        <div style={bar('40%', 18)} />
      </div>
    </div>
  );
}

/* ---- Desktop nav item with hover dropdown (same look as the home page header) ---- */
type NavMenuItem = { label: string; href?: string; onClick?: () => void };
function OrderNavItem({ label, href, menu }: { label: string; href: string; menu?: NavMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const hasMenu = !!menu && menu.length > 0;
  const itemStyle: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-body)', textDecoration: 'none', whiteSpace: 'nowrap', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'var(--amber-50)'; e.currentTarget.style.color = 'var(--brand-secondary)'; };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; };
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
      <a href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-strong)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color .18s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-strong)')}>
        {label}{hasMenu && <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
      </a>
      {hasMenu && open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 8, minWidth: 220, zIndex: 60 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 360, overflowY: 'auto' }}>
            {menu!.map(m => m.onClick
              ? <button key={m.label} onClick={() => { m.onClick!(); setOpen(false); }} style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{m.label}</button>
              : <a key={m.label} href={m.href} style={itemStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{m.label}</a>
            )}
          </div>
        </div>
      )}
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
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--white-90)', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><X size={18} /></button>

            <div className="hide-sb" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Real tin image */}
              <div style={{ width: '100%', height: 190, position: 'relative', overflow: 'hidden' }}>
                {tin.img ? <Image src={tin.img} alt={tin.name} fill style={{ objectFit: 'cover' }} /> : (
                  <div style={{ width: '100%', height: '100%', background: 'radial-gradient(130% 120% at 40% 25%,var(--amber-300),var(--orange-500))' }} />
                )}
                <span style={{ position: 'absolute', left: 14, bottom: 14, padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--panel-92)', color: 'var(--amber-800)', fontSize: 'var(--text-xs)', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}>Premium Gift Tin · {tin.count} cookies</span>
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
              <button onClick={() => onAdd(tin, qty)} style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer' }}>
                Add to Cart · ₹{unit * qty}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// Valid Indian states + UTs — the address form only accepts one of these.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];
const PIN_RE = /^[1-9]\d{5}$/; // Indian PIN: 6 digits, not starting with 0
const PHONE_RE = /^(91)?[6-9]\d{9}$/; // Indian mobile, optional 91 country-code prefix
// Map a free-text (e.g. geocoded) state onto a canonical list entry.
const matchState = (s?: string) => {
  const t = (s || '').toLowerCase().trim();
  if (!t) return '';
  return INDIAN_STATES.find(x => x.toLowerCase() === t)
    || INDIAN_STATES.find(x => t.includes(x.toLowerCase()) || x.toLowerCase().includes(t))
    || '';
};

/* ---- Checkout flow — one page, two steps: 'review' (address + order) then 'pay' (payment) ---- */
function CheckoutFlow({ step }: { step: 'review' | 'pay' }) {
  const router = useRouter();
  const desktop = useIsDesktop(920);
  const { cart, total, setQty, gift, setGift, giftMessage, setGiftMessage, giftOccasion, setGiftOccasion, addrId: addr, setAddrId: setAddr, coupon, setCoupon, applied, setApplied, discount, setDiscount, giftLineId, setGiftLineId, clearAll } = useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [couponErr, setCouponErr] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [adding, setAdding] = useState(false);
  const [aform, setAform] = useState({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', label: 'Home' });
  const [editId, setEditId] = useState<number | null>(null);   // address being edited (null = adding new)
  const [makeDefault, setMakeDefault] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectErr, setDetectErr] = useState('');
  const [placing, setPlacing] = useState(false);
  const [payError, setPayError] = useState('');
  const [payFailMsg, setPayFailMsg] = useState(''); // shown on the review step after a failed payment redirect
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [paid, setPaid] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [delivCheck, setDelivCheck] = useState<DeliveryCheck | null>(null);
  const [delivChecking, setDelivChecking] = useState(false);

  // Addresses are private to the signed-in user — fetch on login, clear on logout.
  useEffect(() => {
    if (user) getAddresses().then(setAddresses).catch(() => setAddresses([]));
    else setAddresses([]);
  }, [user]);

  // General, anyone-can-use coupons for the "Available offers" list — public, so it can render
  // before login (applying one still requires being logged in, same as typing a code manually).
  useEffect(() => {
    getAvailableCoupons().then(setAvailableCoupons).catch(() => setAvailableCoupons([]));
  }, []);

  // Auto-select an address once they load and nothing valid is selected:
  // prefer the default, else fall back to the first address (so users without a
  // default still get a valid address — otherwise the order 400s with "Address not found").
  useEffect(() => {
    if (addr && addresses.some(a => a.id === addr)) return;
    const pick = addresses.find(a => a.isDefault) || addresses[0];
    if (pick) setAddr(pick.id);
  }, [addresses, addr, setAddr]);

  // The cart is client-only (localStorage), so hold cart-derived UI until after mount to avoid a
  // hydration mismatch on first render. Guests are prompted to log in inline / on Pay — no auto-popup.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  // A failed payment bounces back here (/checkout?payment=failed) — surface why, then clean the URL
  // so a refresh doesn't keep showing it.
  useEffect(() => {
    if (step !== 'review' || typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('payment') !== 'failed') return;
    let msg = 'Your payment didn’t go through — no money was taken. Please review and try again.';
    try { const s = sessionStorage.getItem('adc_pay_error'); if (s) msg = s; sessionStorage.removeItem('adc_pay_error'); } catch {}
    setPayFailMsg(msg);
    window.history.replaceState(null, '', '/checkout');
  }, [step]);

  // Real serviceability + TAT from Delhivery when the selected address pincode changes.
  const chosen = addresses.find(a => a.id === addr);
  useEffect(() => {
    const pin = chosen?.pincode?.replace(/\D/g, '') || '';
    if (pin.length !== 6) { setDelivCheck(null); return; }
    let cancelled = false;
    setDelivChecking(true);
    checkDeliveryPin(pin).then(r => { if (!cancelled) { setDelivCheck(r); setDelivChecking(false); } })
      .catch(() => { if (!cancelled) { setDelivCheck(null); setDelivChecking(false); } });
    return () => { cancelled = true; };
  }, [chosen?.pincode]);

  const lines = Object.values(cart);
  // Intra-city (a store-zone pincode → same-day) ships FREE; everywhere else is a flat ₹100.
  const intracity = !!(delivCheck && delivCheck.serviceable && delivCheck.intracity);
  const delivery = total > 0 ? (intracity ? 0 : 100) : 0;
  const gstIncl = total > 0 ? Math.round(total - total / 1.05) : 0;  // 5% GST is already inside the prices
  const giftFee = gift ? GIFT_FEE : 0;
  const grand = total + delivery + giftFee - discount;               // GST included in `total`, not added on top
  const selected = chosen || addresses[0];                           // fallback only for the pay-step display
  // Pan-India arrival date: prefer the carrier's own date, else today + TAT days.
  const deliverBy = delivCheck && delivCheck.serviceable && !delivCheck.intracity
    ? (parseServerDate(delivCheck.expectedDeliveryDate) || (delivCheck.tat != null ? addDays(delivCheck.tat) : null))
    : null;

  const aset = (k: keyof typeof aform) => (e: React.ChangeEvent<HTMLInputElement>) => setAform({ ...aform, [k]: e.target.value });
  const pinOk = PIN_RE.test(aform.pincode.trim());
  const phoneOk = PHONE_RE.test(aform.phone.replace(/\D/g, ''));
  const stateOk = INDIAN_STATES.some(s => s.toLowerCase() === aform.state.trim().toLowerCase());
  // A phone number is required — Delhivery/Shadowfax can't create a shipment without one, so an
  // address saved without a valid one would silently never ship.
  const aValid = !!(aform.fullName.trim() && phoneOk && aform.addressLine1.trim() && aform.city.trim() && pinOk && stateOk);
  // Can't head to payment without a selected, PIN-valid, serviceable address with a real phone
  // number (older saved addresses may predate that requirement — block those too, not just new ones).
  const chosenPinOk = PIN_RE.test((chosen?.pincode || '').trim());
  const chosenPhoneOk = PHONE_RE.test((chosen?.phone || '').replace(/\D/g, ''));
  const canProceed = hydrated && lines.length > 0 && !!chosen && chosenPinOk && chosenPhoneOk && (delivCheck ? delivCheck.serviceable : true);
  const fieldStyle: React.CSSProperties = { flex: '1 1 120px', minWidth: 0, boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' };
  const hintStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 600 };
  const EMPTY_AFORM = { fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', label: 'Home' };
  // New address starts pre-filled with the signed-in user's name & phone (they can edit it, e.g. gifting to someone else).
  const prefillAform = () => ({ ...EMPTY_AFORM, fullName: user?.name || '', phone: user?.phone || '' });
  const closeAddrForm = () => { setAdding(false); setEditId(null); setMakeDefault(false); setDetectErr(''); setAform(EMPTY_AFORM); };

  // Open the form pre-filled to edit an existing saved address.
  const editAddr = (a: Address) => {
    setAform({ fullName: a.fullName, phone: a.phone || '', addressLine1: a.addressLine1, addressLine2: a.addressLine2 || '', city: a.city, state: a.state || '', pincode: a.pincode, label: a.label || 'Home' });
    setMakeDefault(!!a.isDefault); setEditId(a.id); setDetectErr(''); setAdding(true);
  };

  const saveAddr = async () => {
    const data: Omit<Address, 'id'> = { ...aform, isDefault: makeDefault };
    if (editId != null) {
      // Editing an existing address.
      const updated: Address = { ...data, id: editId };
      try { await updateAddress(editId, data); } catch {} // keep the local edit even if the backend lacks the route
      setAddresses(p => p.map(a => (a.id === editId ? updated : (makeDefault ? { ...a, isDefault: false } : a))));
      setAddr(editId);
    } else {
      // Adding a new address.
      let created: Address;
      try { created = await addAddress(data); } catch { created = { ...data, id: Date.now() }; }
      setAddresses(p => [...(makeDefault ? p.map(a => ({ ...a, isDefault: false })) : p), created]);
      setAddr(created.id);
    }
    closeAddrForm();
  };

  // Detect-my-location → reverse-geocode → prefill the address columns we can. Only runs on click.
  const detectLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setDetectErr('Location is not available on this device.'); return; }
    // Browsers only show the permission prompt on a secure origin (localhost or https).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setDetectErr('Location needs a secure connection. Open the site on localhost or its https link — then it will ask permission.');
      return;
    }
    setDetecting(true); setDetectErr('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: 'application/json' } });
          const j = await res.json();
          const a = j.address || {};
          // "Bengaluru Urban" / "Mumbai Suburban" → "Bengaluru" / "Mumbai"
          const cleanDistrict = (s: string | undefined) => (s || '').replace(/\s*(urban|rural|suburban|district|division)\s*$/i, '').trim();
          // Street/cross + locality go into Area/Landmark (not the flat field).
          const area = [a.road, a.neighbourhood || a.suburb || a.residential || a.quarter].filter(Boolean).join(', ');
          setAform(f => ({
            ...f,
            // Flat / House / Building is user-specific — GPS can't know it, so leave it for the user to type.
            addressLine2: f.addressLine2 || area,
            city: a.city || cleanDistrict(a.state_district) || a.town || a.municipality || a.county || a.village || f.city,
            state: matchState(a.state) || f.state,
            pincode: (a.postcode || '').replace(/\D/g, '').slice(0, 6) || f.pincode,
          }));
          if (!a.postcode && !a.city && !a.state_district) setDetectErr('Got your location, but couldn’t read the full address — please complete it.');
          else setDetectErr('');
        } catch {
          setDetectErr('Could not look up your address. Please fill it in manually.');
        } finally { setDetecting(false); }
      },
      err => {
        setDetecting(false);
        setDetectErr(
          err.code === 1 ? 'Location permission denied — allow it in your browser, or just type your address below.'
            : err.code === 3 ? 'Location timed out — try again, or type your address below.'
              : 'Could not read your location — please type your address below.',
        );
      },
      // High-accuracy often times out on desktops/indoors; coarse + a longer window is far more reliable.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  };

  // Coupons are validated on the backend right here at apply-time — so an invalid code is caught
  // now, not later at payment. Only genuinely valid, active codes ever set `applied`.
  const applyCoupon = async (overrideCode?: string) => {
    const code = (overrideCode ?? coupon).trim().toUpperCase();
    if (!code) return;
    if (!user) { setCouponErr('Please log in to apply a coupon.'); setApplied(false); setDiscount(0); return; }
    try {
      const result = await validateCoupon(code, total);
      if (result.valid) {
        if (result.giftProduct) {
          // A "free item" reward: the item itself is the prize (capped at maximumDiscount), not
          // a generic amount off — add it to the cart if they don't already have one.
          const gp = result.giftProduct;
          setDiscount(Math.min(gp.price, result.maximumDiscount ?? gp.price));
          const gid = String(gp.id);
          if (!cart[gid]) {
            setQty(gid, 1, gp.name, gp.price, firstImage(gp.images));
            setGiftLineId(gid);
          } else {
            setGiftLineId(null); // already in their cart on its own merit — don't remove it later
          }
        } else {
          const d = result.discountType === 'PERCENTAGE' ? Math.round(total * result.discountValue / 100) : result.discountValue;
          setDiscount(Math.min(d, result.maximumDiscount || d));
          setGiftLineId(null);
        }
        setApplied(true); setCouponErr('');
      } else { setCouponErr(result.message || 'This code isn’t valid.'); setApplied(false); setDiscount(0); }
    } catch (e) {
      setCouponErr(e instanceof Error ? e.message : 'This code isn’t valid. Please check and try again.');
      setApplied(false); setDiscount(0);
    }
  };

  // Create the order, then open the Razorpay popup. On success the handler verifies the
  // payment on our backend (which marks PAID + auto-creates the Delhivery shipment), then
  // shows the success screen. The user never leaves this page.
  const handlePlace = async () => {
    if (!user) { setLoginOpen(true); return; }
    if (!addr || !addresses.some(a => a.id === addr)) { setPayError('Please select a delivery address first.'); return; }
    if (lines.length === 0) { setPayError('Your cart is empty.'); return; }
    setPayError('');
    setPlacing(true);
    try {
      // Resolve cart items to REAL backend product ids. The cart may hold fallback-menu items
      // whose ids aren't real ids (added before products finished loading) — resolve those by
      // name (the fallback names match the DB exactly), so the order works regardless.
      let catalog: Product[] = [];
      try { catalog = await getProducts(); } catch {}
      const idByName = new Map(catalog.map(p => [p.name.trim().toLowerCase(), p.id]));

      const items: OrderItemInput[] = Object.values(cart)
        .map((e, index) => {
          const opts: Record<string, unknown> = {};
          if (e.addOns && e.addOns.length) opts.addOns = e.addOns;
          if (index === 0 && gift) { opts.giftWrap = true; opts.giftMessage = giftMessage; if (giftOccasion) opts.giftOccasion = giftOccasion; }
          const numericId = Number(e.id);
          const productId = Number.isFinite(numericId) ? numericId : idByName.get(e.name.trim().toLowerCase());
          return {
            productId: productId as number,
            quantity: e.qty,
            selectedOptions: Object.keys(opts).length ? opts : undefined,
            specialNotes: e.note || undefined,
          };
        })
        .filter(it => Number.isFinite(it.productId) && it.quantity > 0);

      if (items.length === 0) {
        setPlacing(false);
        setPayError('Could not match your cart items to the menu. Please refresh the page, add them again, and retry.');
        return;
      }

      const order = await createOrder(addr, applied ? coupon : undefined, items);
      const rp = await createRazorpayOrder(order.id);

      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) throw new Error('Could not load the payment window. Check your connection and try again.');

      const rzp = new window.Razorpay({
        key: rp.keyId,
        order_id: rp.orderId,
        amount: rp.amount,
        currency: rp.currency,
        name: 'A Dough Cookie',
        description: `Order ${rp.orderNumber}`,
        prefill: { name: user.name || '', email: user.email || '', contact: chosen?.phone || '' },
        theme: { color: 'var(--orange-cta)' },
        handler: async (resp) => {
          try {
            await verifyPayment(order.id, {
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpaySignature: resp.razorpay_signature,
            });
            setPaid(grand);
            setOrderId(rp.orderNumber);
            clearAll();
            setDone(true);
          } catch (e) {
            setPlacing(false);
            setPayError(e instanceof Error ? e.message : 'We could not confirm your payment. If money was deducted, contact us with your order number.');
          }
        },
        modal: { ondismiss: () => setPlacing(false) },
      });
      rzp.on('payment.failed', (resp) => {
        setPlacing(false);
        // Don't strand the shopper on the payment screen — take them back to the cart/checkout
        // to review and retry. Carry the reason across so we can show it there.
        try { sessionStorage.setItem('adc_pay_error', resp?.error?.description || 'Payment failed. Please try again.'); } catch {}
        router.push('/checkout?payment=failed');
      });
      rzp.open();
    } catch (e) {
      setPlacing(false);
      setPayError(e instanceof Error ? e.message : 'Something went wrong starting the payment. Please try again.');
    }
  };

  const card$: React.CSSProperties = { background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-soft)', padding: 24 };
  const head = (icon: React.ReactNode, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>{icon}<span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>{label}</span></div>
  );

  // Honest arrival line for the success screen — same-day for intra-city, a real date for courier, else generic.
  const successEta = intracity ? 'Arriving today' : deliverBy ? `Arriving ${fmtDay(deliverBy)}` : 'On its way — we’ll email tracking updates';
  if (done) return <OrderSuccessPage show total={paid} orderId={orderId} eta={successEta} onBackToMenu={() => router.push('/')} onViewOrder={() => router.push('/account')} />;

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
            {l.img
              ? <div onClick={() => router.push(`/?q=${encodeURIComponent(l.name)}`)} title={`View ${l.name}`} style={{ width: 62, height: 62, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flex: 'none', cursor: 'pointer' }}><Image src={l.img} alt={l.name} width={62} height={62} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
              : <Thumb size={62} seed={i} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => router.push(`/?q=${encodeURIComponent(l.name)}`)} role="link" tabIndex={0} title={`View ${l.name}`} style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{l.name}</div>
              {l.addOns && l.addOns.length > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-secondary)', fontWeight: 600 }}>+ {l.addOns.join(', ')}</div>}
              {l.note && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', fontStyle: 'italic' }}>&ldquo;{l.note}&rdquo;</div>}
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>₹{l.price}</div>
              {applied && l.id === giftLineId && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--green-success)', fontWeight: 800, marginTop: 2 }}>🎁 Free — your spin reward</div>}
            </div>
            <QStepper value={l.qty} onChange={n => setQty(l.id, n, l.name, l.price, l.img)} size="sm" />
          </div>
        ))}
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
          {intracity
            ? <span style={{ display: 'inline-flex', gap: 7, alignItems: 'baseline' }}><span style={{ textDecoration: 'line-through', color: 'var(--text-subtle)' }}>₹100</span><span style={{ color: 'var(--green-success)', fontWeight: 800 }}>FREE</span></span>
            : <span>₹{delivery}</span>}
        </div>
        {applied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--green-success)', fontWeight: 700 }}><span>Coupon ({coupon})</span><span>−₹{discount}</span></div>}
        <Dash />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}><span>To pay</span><span>₹{grand}</span></div>
      </div>
    </div>
  );

  return (
    <div className="adc-pattern-page order-cards" style={{ position: 'fixed', inset: 0, zIndex: 72, display: 'flex', flexDirection: 'column' }}>
      <div style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', flex: 'none' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '8px var(--gutter)' }}>
          <button onClick={() => router.push(step === 'pay' ? '/checkout' : '/order')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><ChevronLeft size={20} /></button>
          <div style={{ flex: 'none' }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>{step === 'pay' ? 'Payment' : 'Checkout'}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{step === 'pay' ? 'Choose how to pay' : `${lines.length} item${lines.length !== 1 ? 's' : ''} · ready to order`}</div>
          </div>
          {/* Desktop: the Cart › Checkout › Payment stepper sits inline so the header stays short */}
          {desktop && <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}><CheckoutStepper current={step} inline /></div>}
          <a href="/" aria-label="a dough cookie home" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flex: 'none' }}>
            <Image src="/assets/adc-logo.png" width={232} height={168} priority alt="a dough cookie" style={desktop ? { height: 56, width: 'auto', objectFit: 'contain', display: 'block', marginTop: 0, marginBottom: -20 } : { height: 46, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </a>
        </div>
        {/* Mobile keeps the stepper on its own row */}
        {!desktop && <CheckoutStepper current={step} />}
      </div>

      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '24px var(--gutter) 120px' }}>
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
                      {/* Detect my location — only runs on click; fills the columns we can read */}
                      <button onClick={detectLocation} disabled={detecting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--brand-secondary)', background: 'var(--amber-50)', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: detecting ? 'wait' : 'pointer' }}>
                        <Navigation size={16} /> {detecting ? 'Detecting…' : 'Detect my location'}
                      </button>
                      {detectErr && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 600, lineHeight: 1.4 }}>{detectErr}</div>}

                      {[['fullName', 'Full name'], ['phone', 'Phone'], ['addressLine1', 'Flat / House / Building'], ['addressLine2', 'Area / Landmark']].map(([k, ph]) => (
                        <input key={k} value={aform[k as keyof typeof aform]} onChange={aset(k as keyof typeof aform)} placeholder={ph} inputMode={k === 'phone' ? 'tel' : undefined} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', outline: 'none' }} />
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
                        <button disabled={!aValid} onClick={saveAddr} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-button)', border: 'none', background: aValid ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: aValid ? 'pointer' : 'not-allowed' }}>{editId != null ? 'Save changes' : 'Save & use'}</button>
                        <button onClick={closeAddrForm} style={{ padding: '11px 18px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setEditId(null); setMakeDefault(false); setAform(prefillAform()); setDetectErr(''); setAdding(true); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
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
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{delivCheck.intracity && delivCheck.store ? `Ordering from ${delivCheck.store} · Pincode ${chosen?.pincode}` : `Express delivery (all India) · Pincode ${chosen?.pincode}`}</div>
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
                    We&apos;re not taking online payment just yet — message us on WhatsApp or give us a call to place this order, or come find us in person.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ flex: '1 1 160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 'var(--radius-button)', background: 'var(--whatsapp-green)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                      WhatsApp us
                    </a>
                    <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ flex: '1 1 160px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-strong)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                      Call {SITE_PHONE}
                    </a>
                  </div>
                  {TODAYS_STALL && (
                    <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--amber-50)', border: '1px solid var(--border-default)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)', fontWeight: 700 }}>
                      📍 Today&apos;s stall: {TODAYS_STALL}
                    </div>
                  )}
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

      <div style={{ padding: '14px var(--gutter)', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-card)', flex: 'none' }}>
        {step === 'review' ? (
          <>
            {hydrated && lines.length > 0 && user && !chosen && (
              <div style={{ maxWidth: 720, margin: '0 auto 10px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>
                Add &amp; select a delivery address to continue.
              </div>
            )}
            {hydrated && !user ? (
              // Guests: prompt login before anything else (the address card also shows a log-in prompt).
              <button onClick={() => setLoginOpen(true)} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Lock size={18} /> Log in to continue
              </button>
            ) : (
              <button suppressHydrationWarning onClick={() => router.push('/payment')} disabled={!canProceed} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: canProceed ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: canProceed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {STALL_MODE ? <>Continue <ArrowRight size={18} /></> : <>Proceed to Pay · ₹{grand} <ArrowRight size={18} /></>}
              </button>
            )}
          </>
        ) : STALL_MODE ? (
          // STALL MODE — real payment trigger below (in the `false` branch) is untouched and
          // ready to come straight back the moment STALL_MODE flips off.
          <div style={{ display: 'flex', gap: 10, maxWidth: 720, margin: '0 auto' }}>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', borderRadius: 'var(--radius-button)', background: 'var(--whatsapp-green)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', textDecoration: 'none' }}>
              WhatsApp us
            </a>
            <a href={`tel:${SITE_PHONE.replace(/\s/g, '')}`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-strong)', background: 'var(--surface-card)', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', textDecoration: 'none' }}>
              Call us
            </a>
          </div>
        ) : (
          <>
            {payError && (
              <div style={{ maxWidth: 720, margin: '0 auto 10px', padding: '10px 14px', borderRadius: 'var(--radius-button)', background: 'var(--red-wash)', border: '1.5px solid var(--status-error)', color: 'var(--status-error)', fontSize: 'var(--text-sm)', fontWeight: 700, textAlign: 'center' }}>{payError}</div>
            )}
            <button onClick={() => user ? handlePlace() : setLoginOpen(true)} style={{ width: '100%', maxWidth: 720, margin: '0 auto', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
function OrderSuccessPage({ show, total, orderId, eta, onBackToMenu, onViewOrder }: { show: boolean; total: number; orderId: string; eta: string; onBackToMenu: () => void; onViewOrder: () => void }) {
  const steps = [
    { icon: <Check size={18} />, label: 'Placed', done: true },
    { icon: <span style={{ fontSize: 14 }}>🧑‍🍳</span>, label: 'Baking', done: false },
    { icon: <Bike size={18} />, label: 'On way', done: false },
    { icon: <Home size={18} />, label: 'Delivered', done: false },
  ];
  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center', overflowY: 'auto' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', boxShadow: '0 20px 60px var(--amber-500-38)', animation: 'riseIn .5s var(--ease-spring) both', marginBottom: 28 }}>
          <Check size={62} strokeWidth={3} style={{ color: 'var(--white)' }} />
        </div>
        <div style={{ display: 'inline-block', background: 'var(--green-wash)', color: 'var(--green-success)', fontWeight: 800, fontSize: 'var(--text-sm)', padding: '5px 14px', borderRadius: 'var(--radius-pill)', marginBottom: 16 }}>Payment Successful</div>
        <h1 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 10px' }}>Order Placed!</h1>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', margin: '0 0 6px' }}>Your cookies are being baked fresh.</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', margin: '0 0 32px' }}>Order <strong style={{ color: 'var(--text-strong)' }}>{orderId}</strong> · ₹{total}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', marginBottom: 36 }}>
          <Bike size={22} color="var(--brand-secondary)" />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>{eta}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Estimated delivery</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 16 }}>
          {steps.map((step, i) => (
            <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 64 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: step.done ? 'var(--gradient-warm)' : 'var(--surface-sunken)', boxShadow: step.done ? '0 6px 20px var(--amber-500-35)' : 'none', color: step.done ? 'var(--white)' : 'var(--text-subtle)' }}>{step.icon}</div>
                <span style={{ fontSize: 'var(--text-2xs)', color: step.done ? 'var(--text-strong)' : 'var(--text-subtle)', fontWeight: step.done ? 800 : 500, whiteSpace: 'nowrap' }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && <div style={{ height: 2, width: 24, background: 'var(--border-strong)', marginTop: 19, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-card)', borderTop: '1px solid var(--border-soft)' }}>
        <button onClick={onViewOrder} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><PackageCheck size={18} /> See your order &amp; status</button>
        <button onClick={onBackToMenu} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'transparent', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Order more cookies</button>
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
        <div style={{ font: 'var(--weight-extra) var(--text-h3)/1.1 var(--font-display)', color: 'var(--white)', marginBottom: 8 }}>Corporate &amp; bulk gifting</div>
        <p style={{ color: 'var(--cream-100-72)', lineHeight: 1.6, margin: 0, fontSize: 'var(--text-sm)' }}>Cookies for teams, clients, and celebrations — freshly baked, neatly packed, and delivered together. Pick a package below or request a custom quote for large or branded orders.</p>
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
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Check size={28} strokeWidth={3} style={{ color: 'var(--white)' }} /></div>
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
              <button disabled={!valid || status === 'sending'} onClick={submit} style={{ padding: '14px', borderRadius: 'var(--radius-button)', border: 'none', background: valid && status !== 'sending' ? 'var(--gradient-warm)' : 'var(--border-default)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: valid && status !== 'sending' ? 'pointer' : 'not-allowed' }}>{status === 'sending' ? 'Sending…' : 'Request quote'}</button>
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

  const [menu, setMenu] = useState<typeof FALLBACK_MENU>([]);
  const [tins, setTins] = useState<typeof FALLBACK_TINS>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('Cookies');
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState('');
  const [tin, setTin] = useState<typeof FALLBACK_TINS[0] | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  // Load products from backend — faithful mapping (real images, groups, tags, stable ratings)
  useEffect(() => {
    getProducts().then(products => {
      if (!products?.length) { setMenu(FALLBACK_MENU); setTins(FALLBACK_TINS); return; }
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
    }).catch(() => { setMenu(FALLBACK_MENU); setTins(FALLBACK_TINS); }) // fallback only if the fetch fails
      .finally(() => setLoading(false));
  }, []);

  // Deep-link from the home page: category cards (/order?cat=cookies|tins|corporate) and the
  // home search bar (/order?q=<term>). Category words jump to that tab; any other term filters
  // the Cookies tab by name.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');
    const map: Record<string, string> = { cookies: 'Cookies', tins: 'Cookie Tins', corporate: 'Corporate Gifting' };
    if (cat && map[cat]) setActive(map[cat]);
    const q = params.get('q');
    if (q) {
      const ql = q.trim().toLowerCase();
      if (/tin|gift/.test(ql)) setActive('Cookie Tins');
      else if (/cookie/.test(ql)) setActive('Cookies');
      else { setActive('Cookies'); setSearch(q); }
    }
  }, []);

  const addTin = (t: typeof FALLBACK_TINS[0], qty: number) => {
    setQty(t.id, (cart[t.id]?.qty || 0) + qty, t.name, t.price, t.img);
    setTin(null);
  };

  // Search floats matches to the TOP but keeps every other cookie visible below it (cross-sell —
  // e.g. searching "ADC Special" shows it first, then the rest of the menu). Never hides the menu.
  const _q = search.trim().toLowerCase();
  const filtered = active === 'Cookie Tins'
    ? []
    : (!_q ? menu : [...menu].sort((a, b) => (a.name.toLowerCase().includes(_q) ? 0 : 1) - (b.name.toLowerCase().includes(_q) ? 0 : 1)));
  const cartLines = Object.values(cart);

  // Checkout and payment are their own routes; render the combined flow on those URLs.
  if (pathname === '/checkout') return <CheckoutFlow step="review" />;
  if (pathname === '/payment') return <CheckoutFlow step="pay" />;

  /* Desktop layout */
  if (desktop) {
    return (
      <>
        <div className="adc-pattern-page order-cards" style={{ minHeight: '100vh' }}>
          {/* Header — same two-row style as the home page: logo · search · location · cart · account, then nav links */}
          <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
            <div style={{ maxWidth: 1680, margin: '0 auto', padding: '8px var(--gutter)', display: 'flex', alignItems: 'center', gap: 'clamp(14px,2vw,28px)' }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}>
                <Image src="/assets/adc-logo.png" height={104} width={174} alt="a dough cookie" style={{ height: 140, width: 'auto', objectFit: 'contain', display: 'block', marginTop: 0, marginBottom: -50 }} />
              </a>
              <SearchSuggest value={search} onChange={setSearch} onPick={name => { setActive('Cookies'); setSearch(name); }} items={menu} placeholder="Search cookies…"
                wrapStyle={{ flex: 1, maxWidth: 620, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-card)', borderRadius: 'var(--radius-pill)', padding: '9px 16px', border: '1.5px solid var(--border-default)' }} />
              <LocationPill />
              <button onClick={() => router.push('/checkout')} aria-label={`View cart, ${count} items`} style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)', flex: 'none' }}>
                <ShoppingBag size={20} />
                {count > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--gradient-warm)', color: 'var(--white)', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>}
              </button>
              {user ? (
                <button onClick={() => router.push(user.role === 'ADMIN' ? '/admin' : '/account')} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 10px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><User size={17} /></span>
                  {user.name.split(' ')[0]}
                </button>
              ) : (
                <button onClick={() => setLoginOpen(true)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>
                  <User size={18} /> Login
                </button>
              )}
            </div>
            <div>
              <div style={{ maxWidth: 1680, margin: '0 auto', padding: '8px var(--gutter)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,2.4vw,40px)', flexWrap: 'wrap' }}>
                <OrderNavItem label="Home" href="/" />
                <OrderNavItem label="Buy Cookies" href="/order?cat=cookies" menu={menu.map(m => ({ label: m.name, onClick: () => { setActive('Cookies'); setSearch(m.name); } }))} />
                <OrderNavItem label="Cookie Tins" href="/order?cat=tins" menu={tins.map(t => ({ label: t.name, onClick: () => { setActive('Cookie Tins'); setSearch(''); } }))} />
                <OrderNavItem label="Locations" href="/locations" menu={STORES.map(s => ({ label: `${s.city} — ${s.name}`, href: `/order?store=${encodeURIComponent(s.city.toLowerCase())}` }))} />
                <OrderNavItem label="Partner with us" href="/franchise" menu={[{ label: 'Corporate & Bulk Order', onClick: () => setActive('Corporate Gifting') }, { label: 'Franchise Enquiry', href: '/franchise' }]} />
                <OrderNavItem label="About Us" href="/about" />
                <OrderNavItem label="Contact" href="/contact" />
              </div>
            </div>
          </header>

          {/* 3-col layout: category rail · product grid · live cart panel */}
          <div style={{ maxWidth: 1680, margin: '0 auto', padding: '24px var(--gutter) 60px', display: 'grid', gridTemplateColumns: '210px minmax(0,1fr) 400px', gap: 28, alignItems: 'start' }}>
            {/* Category rail */}
            <aside style={{ position: 'sticky', top: 150, alignSelf: 'start' }}>
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
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', fontWeight: 600 }}>{loading || active === 'Corporate Gifting' ? '' : active === 'Cookie Tins' ? tins.length : filtered.length}</span>
              </div>
              <LocationBanner />
              {active === 'Corporate Gifting' ? (
                <CorporatePanel />
              ) : active === 'Cookie Tins' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
                  {loading
                    ? Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)
                    : tins.map(t => (
                        <DeskProductCard key={t.id} item={t as unknown as typeof FALLBACK_MENU[0]} qty={cart[t.id]?.qty || 0} onQtyChange={n => setQty(t.id, n, t.name, t.price, t.img)} badge={`Tin · ${t.count} cookies`} />
                      ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                    : filtered.map((m) => (
                        <DeskProductCard key={m.id} item={m} qty={cart[m.id]?.qty || 0} onQtyChange={n => setQty(m.id, n, m.name, cart[m.id]?.price ?? m.price, m.img)} />
                      ))}
                </div>
              )}
            </main>

            {/* Live cart panel — always visible so you see what you've added while browsing */}
            <aside style={{ position: 'sticky', top: 150, alignSelf: 'start' }}>
              <div style={{ background: 'var(--cream-lightest)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 172px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px', borderBottom: '1px solid var(--border-soft)' }}>
                  <ShoppingBag size={18} color="var(--brand-secondary)" />
                  <span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>Your cart</span>
                  {count > 0 && <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--text-muted)' }}>{count} item{count !== 1 ? 's' : ''}</span>}
                </div>
                {cartLines.length === 0 ? (
                  <div style={{ padding: '34px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 34, marginBottom: 8 }}>🍪</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>Your cart is empty</div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Add some warm cookies to get started — they&apos;ll show up right here.</p>
                  </div>
                ) : (
                  <>
                    <div className="hide-sb" style={{ overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {cartLines.map(l => (
                        <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ position: 'relative', width: 54, height: 54, borderRadius: 12, overflow: 'hidden', flex: 'none', background: 'var(--surface-raised)' }}>
                            {l.img && <Image src={l.img} alt={l.name} fill sizes="54px" style={{ objectFit: 'cover' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>₹{l.price} × {l.qty}</div>
                          </div>
                          <QStepper value={l.qty} onChange={n => setQty(l.id, n, l.name, l.price, l.img)} size="sm" />
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}><span>Subtotal</span><span>₹{total}</span></div>
                      <button onClick={() => router.push('/checkout')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-button)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-brand)' }}>Checkout · ₹{total} <ArrowRight size={18} /></button>
                      <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>Taxes included. Shipping and discount codes calculated at checkout.</p>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>

        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        </div>
      </>
    );
  }

  /* Mobile layout */
  return (
    <>
      <div className="adc-pattern-page order-cards" style={{ minHeight: '100vh' }}>
        {/* Mobile top nav */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 10px' }}>
            <button onClick={() => router.push('/')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
            <a href="/" aria-label="a dough cookie home" style={{ flex: 1, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <Image src="/assets/adc-logo.png" height={54} width={92} alt="a dough cookie" style={{ objectFit: 'contain' }} />
            </a>
            {user ? (
              <button onClick={() => router.push(user.role === 'ADMIN' ? '/admin' : '/account')} aria-label="Profile" style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><User size={20} /></button>
            ) : (
              <button onClick={() => setLoginOpen(true)} aria-label="Login" style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><User size={20} /></button>
            )}
          </div>
          <div style={{ padding: '0 18px 12px' }}>
            <LocationPill block />
          </div>
          <div style={{ padding: '0 18px 14px' }}>
            <SearchSuggest value={search} onChange={setSearch} onPick={name => { setActive('Cookies'); setSearch(name); }} items={menu} placeholder="Search Cookies…"
              wrapStyle={{ display: 'flex', alignItems: 'center', background: 'var(--surface-raised)', borderRadius: 'var(--radius-input)', padding: '11px 16px', gap: 10, border: '1.5px solid var(--border-default)' }} />
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
          <LocationBanner />
          {active === 'Corporate Gifting' ? (
            <div style={{ paddingBottom: 24 }}><CorporatePanel /></div>
          ) : active === 'Cookie Tins' ? (
            loading
              ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
              : tins.map(t => (
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
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : filtered.map((m) => (
                    <MobileProductCard key={m.id} item={m} qty={cart[m.id]?.qty || 0} onQtyChange={n => setQty(m.id, n, m.name, cart[m.id]?.price ?? m.price, m.img)} />
                  ))}
            </div>
          )}
        </div>
        <div style={{ height: count > 0 ? 150 : 96 }} />

        {/* Floating bottom-right stack: menu on top, cart below it */}
        <div style={{ position: 'fixed', right: 16, bottom: 18, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <button onClick={() => setDrawer(true)} aria-label="Menu" style={{ width: 60, height: 60, borderRadius: 18, border: 'none', background: 'var(--surface-inverse)', color: 'var(--white)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, boxShadow: 'var(--shadow-lg)' }}><BookOpen size={21} /><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em' }}>Menu</span></button>
          {count > 0 && (
            <button onClick={() => router.push('/checkout')} aria-label="View cart" style={{ border: 'none', cursor: 'pointer', background: 'var(--gradient-warm)', color: 'var(--white)', borderRadius: 'var(--radius-pill)', boxShadow: 'var(--shadow-brand)', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', fontFamily: 'var(--font-body)', fontWeight: 800, animation: 'riseIn .3s var(--ease-spring) both' }}>
              <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                <ShoppingBag size={22} />
                <span style={{ position: 'absolute', top: -8, right: -10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--white)', color: 'var(--brand-secondary)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}>{count}</span>
              </span>
              <span style={{ fontSize: 'var(--text-base)' }}>₹{total}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
        <TinModal tin={tin} onClose={() => setTin(null)} onAdd={addTin} />
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>

      {/* Category popup — compact dark menu, opens above the floating menu button */}
      {drawer && (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'var(--black-50)', backdropFilter: 'blur(2px)' }} />
          <div className="hide-sb" style={{ position: 'fixed', right: 16, bottom: 84, zIndex: 47, width: 'min(252px,80vw)', maxHeight: '56vh', overflowY: 'auto', background: 'var(--ink-975)', borderRadius: 'var(--radius-sheet)', boxShadow: 'var(--shadow-xl)', padding: 6, animation: 'riseIn .25s var(--ease-spring) both' }}>
            <div style={{ padding: '8px 12px 5px', fontSize: 'var(--text-2xs)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--cream-100-50)', fontWeight: 800 }}>Menu</div>
            {CATEGORIES.map(c => {
              const on = c === active;
              const cnt = c === 'Cookie Tins' ? tins.length : c === 'Cookies' ? menu.length : null;
              return (
                <button key={c} onClick={() => { setActive(c); setDrawer(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid var(--cream-100-08)', textAlign: 'left' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: on ? 800 : 600, fontSize: 'var(--text-sm)', color: on ? 'var(--amber-400)' : 'var(--cream-100)' }}>{c}</span>
                  {cnt != null && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: on ? 'var(--amber-400)' : 'var(--cream-100-50)' }}>{cnt}</span>}
                </button>
              );
            })}
            <button onClick={() => setDrawer(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 6, padding: '9px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--white-12)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}><X size={14} /> Close</button>
          </div>
        </>
      )}

    </>
  );
}
