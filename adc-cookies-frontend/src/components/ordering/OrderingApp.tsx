'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User, Menu, X, Search, ShoppingBag, ChevronRight, Sparkles, Check, ArrowRight, Gift, MessageSquare, MapPin, CreditCard, Bike, Home, Briefcase, Lock, ShieldCheck, Tag, Receipt, Clock, RotateCcw, Pencil, Bell, Info, LifeBuoy, LogOut, Plus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import LoginModal from './LoginModal';
import { getProducts, getAddresses, validateCoupon, createOrder, firstImage, type Product, type Address, type OrderItemInput } from '@/lib/api';

/* ---- Data ---- */
const CATEGORIES = ['Recommended', 'Classic Cookies', 'Filled Cookies', 'Premium Cookies', 'Gift Tins'];

const ADDONS = [
  { id: 'nutella', label: 'Extra Nutella', price: 30 },
  { id: 'biscoff', label: 'Extra Biscoff', price: 30 },
  { id: 'chips', label: 'Extra Chocolate Chips', price: 20 },
  { id: 'scoop', label: 'Ice Cream Scoop', price: 60 },
  { id: 'gift', label: 'Gift Packaging', price: 50 },
];

const PAIRINGS = [
  { id: 'shake', name: 'Vanilla Milkshake', price: 120, img: null },
  { id: 'brownie', name: 'Fudge Brownie', price: 90, img: null },
  { id: 'coffee', name: 'Cold Coffee', price: 110, img: null },
  { id: 'icecream', name: 'Ice Cream Scoop', price: 70, img: null },
];

const FALLBACK_MENU = [
  { id: 'choc', name: 'Chocolate Chip', price: 60, cat: 'Classic Cookies', rec: true, rating: 4.6, rc: '3.4k', veg: true, img: '/assets/products/blueberry.jpg', desc: 'The original. Buttery dough, dark chocolate chips, soft centre.' },
  { id: 'double', name: 'Double Choc Chip', price: 65, cat: 'Classic Cookies', best: true, rating: 4.7, rc: '1.2k', veg: true, img: '/assets/products/triple-choc.jpg', desc: 'Rich cocoa dough loaded with dark chocolate chunks.' },
  { id: 'raagi', name: 'Raagi (Gluten Free)', price: 60, cat: 'Classic Cookies', rating: 4.4, rc: '820', veg: true, img: '/assets/products/oatmeal-raisin.jpg', desc: 'Wholesome finger-millet cookie, naturally gluten free.' },
  { id: 'matcha', name: 'Matcha', price: 90, cat: 'Premium Cookies', rec: true, rating: 4.5, rc: '640', veg: true, img: '/assets/products/matcha.jpg', desc: 'Stone-ground matcha folded into buttery white-chocolate dough.' },
  { id: 'special', name: 'ADC Special', price: 90, cat: 'Premium Cookies', best: true, rating: 4.8, rc: '2.1k', veg: true, img: '/assets/products/adc-special.jpg', desc: 'Our signature — browned butter, sea salt, three chocolates.' },
  { id: 'redvelvet', name: 'Red Velvet With Cheese', price: 90, cat: 'Premium Cookies', rating: 4.6, rc: '910', veg: true, img: '/assets/products/red-velvet.jpg', desc: 'Cocoa-red velvet cookie with a cream-cheese filled core.' },
  { id: 'biscoff', name: 'Biscoff Filled', price: 110, cat: 'Filled Cookies', best: true, rating: 4.9, rc: '4.0k', veg: true, img: '/assets/products/peanut-butter.jpg', desc: 'Molten Biscoff spread inside a caramelised cookie shell.' },
  { id: 'nutella', name: 'Nutella Filled', price: 90, cat: 'Filled Cookies', rec: true, rating: 4.7, rc: '2.6k', veg: true, img: '/assets/products/caramel-cashew.jpg', desc: 'Gooey Nutella centre in a soft chocolate cookie.' },
];

const FALLBACK_TINS = [
  { id: 'nutella-tin', name: 'Nutella Tin', price: 600, count: 6, img: '/assets/products/coffee-almond.jpg', desc: 'Six premium cookies in a keepsake tin.' },
  { id: 'biscoff-tin', name: 'Biscoff Tin', price: 850, count: 9, img: '/assets/products/m-and-m.jpg', desc: 'Nine Biscoff-filled cookies, gift-ready.' },
];

const DEMO_ADDRESSES: Address[] = [
  { id: 1, fullName: 'Aarav Mehta', phone: '+91 98765 43210', addressLine1: '12B, Lakeview Residency', addressLine2: 'Whitefield', city: 'Bengaluru', state: 'Karnataka', pincode: '560066', isDefault: true },
  { id: 2, fullName: 'Aarav Mehta', phone: '+91 98765 43210', addressLine1: '4th Floor, Prestige Tech Park', addressLine2: 'Marathahalli', city: 'Bengaluru', state: 'Karnataka', pincode: '560103', isDefault: false },
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
function ProductMenuItem({ item, qty, onQtyChange, onOpen }: { item: typeof FALLBACK_MENU[0]; qty: number; onQtyChange: (n: number) => void; onOpen: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: '1px solid var(--border-soft)', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          {item.veg && <span style={{ width: 16, height: 16, border: '2px solid var(--mark-veg)', borderRadius: 3, display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mark-veg)', display: 'block' }} /></span>}
          {(item as any).best && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Bestseller</span>}
          {(item as any).rec && !((item as any).best) && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--teal-50)', color: 'var(--teal-700)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>★ Recommended</span>}
        </div>
        <h3 onClick={onOpen} style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 4px', cursor: 'pointer' }}>{item.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--amber-600)', fontWeight: 700 }}>★ {item.rating}</span>
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>({item.rc})</span>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>{item.desc}</p>
        <span style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>₹{item.price}</span>
      </div>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 120, height: 120, borderRadius: 'var(--radius-image)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }} onClick={onOpen}>
          <Image src={item.img} alt={item.name} width={120} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }} />
        </div>
        {qty === 0 ? (
          <button onClick={() => onQtyChange(1)} style={{ width: 120, padding: '8px 0', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>ADD</button>
        ) : (
          <QStepper value={qty} onChange={onQtyChange} size="sm" />
        )}
      </div>
    </div>
  );
}

/* ---- Detail Sheet ---- */
function DetailSheet({ item, onClose, onAdd }: { item: typeof FALLBACK_MENU[0] | null; onClose: () => void; onAdd: (item: typeof FALLBACK_MENU[0], qty: number) => void }) {
  const [qty, setQty] = useState(1);
  const [adds, setAdds] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const open = !!item;

  useEffect(() => { if (item) { setQty(1); setAdds({}); setNote(''); } }, [item]);

  const addTotal = ADDONS.reduce((s, a) => s + (adds[a.id] ? a.price : 0), 0);
  const unit = (item?.price || 0) + addTotal;
  const toggle = (id: string) => setAdds(a => ({ ...a, [id]: !a[id] }));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity var(--dur-base) var(--ease-out)' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: '88%', zIndex: 81,
        background: 'var(--surface-card)', borderTopLeftRadius: 'var(--radius-sheet)', borderTopRightRadius: 'var(--radius-sheet)',
        boxShadow: 'var(--shadow-xl)', transform: open ? 'translateY(0)' : 'translateY(102%)',
        transition: 'transform var(--dur-slow) var(--ease-spring)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 44, height: 5, borderRadius: 99, background: 'var(--border-strong)', zIndex: 3 }} />
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 3, width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--surface-sunken)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={18} /></button>

        <div className="hide-sb" style={{ flex: 1, overflowY: 'auto' }}>
          {/* Image */}
          <div style={{ width: '100%', height: 230, position: 'relative', overflow: 'hidden' }}>
            {item?.img ? <Image src={item.img} alt={item.name} fill style={{ objectFit: 'cover' }} /> : (
              <div style={{ width: '100%', height: '100%', background: 'radial-gradient(130% 120% at 40% 25%,#F8C24D,#EF7507)' }} />
            )}
          </div>

          <div style={{ padding: '18px 20px 8px' }}>
            <h2 style={{ font: 'var(--weight-bold) var(--text-h2)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{item?.name}</h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', margin: '0 0 4px' }}>{item?.desc}</p>
            <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{item?.price}</div>
          </div>

          <div style={{ padding: '8px 20px 0' }}>
            <div style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)', marginBottom: 4 }}>Make it yours</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', marginBottom: 12 }}>Optional · add as many as you like</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ADDONS.map(a => {
                const on = !!adds[a.id];
                return (
                  <button key={a.id} onClick={() => toggle(a.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: on ? '1.5px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-card)', textAlign: 'left' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', border: on ? 'none' : '2px solid var(--border-strong)', background: on ? 'var(--gradient-warm)' : 'transparent', color: '#fff' }}>{on && <Check size={14} strokeWidth={3} />}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-strong)' }}>{a.label}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>+₹{a.price}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ font: 'var(--weight-bold) var(--text-base) var(--font-body)', color: 'var(--text-strong)', marginBottom: 8 }}>Special request</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. extra soft, less sweet…" rows={2} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '12px 14px', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none', background: 'var(--surface-raised)' }} />
            </div>
          </div>
          <div style={{ height: 24 }} />
        </div>

        <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'center', background: 'var(--surface-card)' }}>
          <QStepper value={qty} onChange={n => setQty(Math.max(1, n))} />
          <button
            onClick={() => item && onAdd(item, qty)}
            style={{ flex: 1, padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer' }}
          >Add to Cart · ₹{unit * qty}</button>
        </div>
      </div>
    </>
  );
}

/* ---- Tin Modal (full page) ---- */
function TinModal({ tin, onClose, onAdd }: { tin: typeof FALLBACK_TINS[0] | null; onClose: () => void; onAdd: (tin: typeof FALLBACK_TINS[0], qty: number) => void }) {
  const [qty, setQty] = useState(1);
  const [wrap, setWrap] = useState(false);
  const [giftOn, setGiftOn] = useState(false);
  const [msg, setMsg] = useState('');
  const open = !!tin;
  const WRAP_PRICE = 50;
  const unit = (tin?.price || 0) + (wrap ? WRAP_PRICE : 0);

  useEffect(() => { if (tin) { setQty(1); setWrap(false); setGiftOn(false); setMsg(''); } }, [tin]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 82, background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity .3s' }} />
      <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 83, transform: open ? 'translateY(0)' : 'translateY(100%)', transition: 'transform .4s var(--ease-spring)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tin && (
          <>
            <div className="hide-sb" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Packaging preview */}
              <div style={{ position: 'relative', height: 340, background: 'linear-gradient(165deg,var(--amber-100),var(--orange-200))', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 16, left: 16, width: 42, height: 42, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.8)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
                <span style={{ position: 'absolute', top: 16, right: 16, padding: '5px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-sm)', fontWeight: 800 }}>Premium Gift Tin</span>
                <div style={{ width: 200, height: 200, borderRadius: 'var(--radius-modal)', background: 'radial-gradient(140% 140% at 38% 26%,#F8C24D,#D2620A)', boxShadow: 'var(--shadow-xl)', position: 'relative', display: 'grid', placeItems: 'center' }}>
                  <Image src="/assets/adc-logo.png" width={100} height={60} alt="ADC" style={{ opacity: .92, objectFit: 'contain' }} />
                </div>
              </div>

              <div style={{ padding: '18px 20px 0' }}>
                <h2 style={{ font: 'var(--weight-bold) var(--text-h2)/1.1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 6px' }}>{tin.name}</h2>
                <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>{tin.desc} Each tin is hand-packed with {tin.count} premium cookies.</p>
                <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}>₹{tin.price}</div>
              </div>

              {/* Gift wrap */}
              <div style={{ padding: '20px 20px 0' }}>
                <button onClick={() => setWrap(w => !w)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: wrap ? '1.5px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: wrap ? 'var(--amber-50)' : 'var(--surface-card)' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><Gift size={20} color="#fff" /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-strong)' }}>Premium gift wrap</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Ribbon &amp; teal accent · +₹{WRAP_PRICE}</span>
                  </span>
                  <span style={{ width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center', border: wrap ? 'none' : '2px solid var(--border-strong)', background: wrap ? 'var(--gradient-warm)' : 'transparent', color: '#fff' }}>{wrap && <Check size={15} strokeWidth={3} />}</span>
                </button>
              </div>

              {/* Gift message */}
              <div style={{ padding: '14px 20px 0' }}>
                <button onClick={() => setGiftOn(g => !g)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: giftOn ? '1.5px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: giftOn ? 'var(--amber-50)' : 'var(--surface-card)' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', background: 'var(--brand-accent)', display: 'grid', placeItems: 'center', flex: 'none' }}><MessageSquare size={20} color="#fff" /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-strong)' }}>Add a gift message</span>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Printed on a kraft card · free</span>
                  </span>
                  <span style={{ width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center', border: giftOn ? 'none' : '2px solid var(--border-strong)', background: giftOn ? 'var(--gradient-warm)' : 'transparent', color: '#fff' }}>{giftOn && <Check size={15} strokeWidth={3} />}</span>
                </button>
                {giftOn && (
                  <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write your message…" rows={3} maxLength={140} style={{ width: '100%', boxSizing: 'border-box', resize: 'none', marginTop: 10, padding: '12px 14px', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-input)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none', background: 'var(--surface-raised)' }} />
                )}
              </div>

              {/* Quantity */}
              <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: 'var(--weight-bold) var(--text-base) var(--font-body)', color: 'var(--text-strong)' }}>Quantity</span>
                <QStepper value={qty} onChange={n => setQty(Math.max(1, n))} />
              </div>
              <div style={{ height: 110 }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 18px', background: 'var(--surface-card)' }}>
              <button onClick={() => onAdd(tin, qty)} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer' }}>
                Add to Cart · ₹{unit * qty}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---- Cart Review Page ---- */
function CartReviewPage({ show, onBack, onProceed }: { show: boolean; onBack: () => void; onProceed: () => void }) {
  const { cart, setQty, total } = useCart();
  const lines = Object.values(cart);
  const delivery = total > 0 ? 29 : 0;
  const grand = total + delivery;

  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-card)' }}>
        <button onClick={onBack} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>Your Cart</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{lines.length} item{lines.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '0 0 100px' }}>
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ShoppingBag size={18} color="var(--brand-secondary)" />
            <span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Order items</span>
          </div>
          {lines.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < lines.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
              {l.img ? (
                <div style={{ width: 68, height: 68, borderRadius: 'var(--radius-image)', overflow: 'hidden', flex: 'none' }}>
                  <Image src={l.img} alt={l.name} width={68} height={68} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : <Thumb size={68} seed={i} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-strong)', marginBottom: 2 }}>{l.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>₹{l.price} each</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹{l.price * l.qty}</span>
                <QStepper value={l.qty} onChange={n => setQty(l.id, n, l.name, l.price, l.img)} size="sm" />
              </div>
            </div>
          ))}
        </div>

        {/* Bill */}
        <div style={{ padding: '20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Receipt size={18} color="var(--brand-secondary)" />
            <span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Bill details</span>
          </div>
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Item total</span><span>₹{total}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Delivery fee</span><span>{delivery === 0 ? 'Free' : '₹' + delivery}</span></div>
              <Dash />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}><span>To pay</span><span>₹{grand}</span></div>
            </div>
          </div>
        </div>
      </div>

      {lines.length > 0 && (
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-card)' }}>
          <button onClick={onProceed} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Proceed to Checkout · ₹{grand} <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---- Checkout Page ---- */
function CheckoutPage({ show, onBack, onPlace }: { show: boolean; onBack: () => void; onPlace: (grand: number) => void }) {
  const { cart, total } = useCart();
  const { user } = useAuth();
  const [addr, setAddr] = useState<number>(1);
  const [addresses, setAddresses] = useState<Address[]>(DEMO_ADDRESSES);
  const [asap, setAsap] = useState(true);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [couponErr, setCouponErr] = useState('');
  const [method, setMethod] = useState('upi');
  const [upiApp, setUpiApp] = useState('gpay');
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState('');
  const [card, setCard] = useState({ num: '', exp: '', cvv: '', name: '' });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (!show) { setPlacing(false); setDone(false); } }, [show]);
  useEffect(() => { if (user) { getAddresses().then(setAddresses).catch(() => {}); } }, [user]);

  const delivery = total > 0 ? 29 : 0;
  const gst = Math.round(total * 0.05);
  const grand = total + delivery + gst - discount;

  const applyCoupon = async () => {
    try {
      const result = await validateCoupon(coupon.trim().toUpperCase(), total);
      if (result.valid) {
        const d = result.discountType === 'PERCENTAGE' ? Math.round(total * result.discountValue / 100) : result.discountValue;
        setDiscount(Math.min(d, result.maximumDiscount || d));
        setApplied(true); setCouponErr('');
      } else {
        setCouponErr(result.message || 'Invalid coupon code'); setApplied(false);
      }
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
          // Send the real cart line-items so the order persists with correct products.
          // Only DB-backed products have numeric ids; filter out any non-DB extras.
          const items: OrderItemInput[] = Object.values(cart)
            .map(e => ({ productId: Number(e.id), quantity: e.qty }))
            .filter(it => Number.isFinite(it.productId) && it.quantity > 0);
          await createOrder(addr, applied ? coupon : undefined, items);
        }
      } catch {}
      setDone(true);
      setTimeout(() => onPlace(grand), 400);
    };
    setTimeout(doOrder, 2200);
  };

  const fmt4 = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();
  const fmtExp = (v: string) => { const d = v.replace(/\D/g,'').slice(0,4); return d.length > 2 ? d.slice(0,2)+'/'+d.slice(2) : d; };

  if (placing || done) return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, transform: show ? 'none' : 'translateX(100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 32, textAlign: 'center' }}>
      {done ? (
        <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', boxShadow: '0 20px 60px rgba(242,159,5,.4)', animation: 'riseIn .45s var(--ease-spring) both' }}><Check size={48} color="#fff" strokeWidth={3} /></div>
      ) : (
        <div style={{ width: 80, height: 80, borderRadius: '50%', border: '5px solid var(--amber-200)', borderTopColor: 'var(--brand-secondary)', animation: 'spin 1s linear infinite' }} />
      )}
      <div>
        <div style={{ font: 'var(--weight-bold) var(--text-h3)/1.1 var(--font-display)', color: 'var(--text-strong)' }}>{done ? 'Payment confirmed!' : 'Processing payment…'}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 8 }}>{done ? 'Placing your order now.' : "Please don't close this page"}</div>
      </div>
    </div>
  );

  return (
    <div className="adc-pattern-page" style={{ position: 'fixed', inset: 0, zIndex: 72, transform: show ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .38s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-card)', flex: 'none' }}>
        <button onClick={onBack} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
        <div>
          <div style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>Checkout</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Review &amp; pay</div>
        </div>
      </div>

      <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '0 0 110px' }}>
        {/* Address */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><MapPin size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Deliver to</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {addresses.map(a => {
              const on = addr === a.id;
              return (
                <button key={a.id} onClick={() => setAddr(a.id)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-card)' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: on ? 'var(--gradient-warm)' : 'var(--surface-sunken)', display: 'grid', placeItems: 'center', flex: 'none' }}>{a.isDefault ? <Home size={18} color={on ? '#fff' : 'var(--brand-secondary)'} /> : <Briefcase size={18} color={on ? '#fff' : 'var(--brand-secondary)'} />}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{a.isDefault ? 'Home' : 'Work'}</span>
                      {a.isDefault && <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-100)', color: 'var(--amber-800)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>Default</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.45 }}>{a.addressLine1}, {a.addressLine2}, {a.city} {a.pincode}</span>
                  </span>
                  <Dot on={on} />
                </button>
              );
            })}
            <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer' }}>
              <Plus size={16} color="var(--brand-secondary)" />
              <span style={{ fontWeight: 700, color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}>Add new address</span>
            </button>
          </div>
        </div>

        {/* Delivery time */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><Clock size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Delivery time</span></div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ v: true, label: 'ASAP', sub: '~30 min' }, { v: false, label: 'Schedule', sub: 'Pick a slot' }].map(opt => {
              const on = asap === opt.v;
              return (
                <button key={opt.label} onClick={() => setAsap(opt.v)} style={{ flex: 1, padding: '13px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', border: on ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: on ? 'var(--amber-50)' : 'var(--surface-card)', textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)' }}>{opt.label}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coupon */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><Tag size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Apply coupon</span></div>
          {applied ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 'var(--radius-card)', background: '#EDF7F0', border: '1.5px solid #1F8A5B' }}>
              <Check size={20} color="#1F8A5B" />
              <span style={{ flex: 1, fontWeight: 700, color: '#1F8A5B', fontSize: 'var(--text-sm)' }}>{coupon} applied!</span>
              <button onClick={() => { setApplied(false); setCoupon(''); setDiscount(0); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-sm)' }}>Remove</button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponErr(''); }} placeholder="Enter coupon code"
                  style={{ flex: 1, padding: '13px 16px', borderRadius: 'var(--radius-input)', border: couponErr ? '1.5px solid var(--status-error)' : '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />
                <button onClick={applyCoupon} disabled={!coupon.trim()} style={{ padding: '13px 20px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, cursor: 'pointer' }}>Apply</button>
              </div>
              {couponErr && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)', marginTop: 6 }}>{couponErr}</div>}
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)', marginTop: 6, fontWeight: 600 }}>Try: ADC10 for 10% off</div>
            </div>
          )}
        </div>

        {/* Payment method */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><CreditCard size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Payment method</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* UPI */}
            <div style={{ borderRadius: 'var(--radius-card)', border: method === 'upi' ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: method === 'upi' ? 'var(--amber-50)' : 'var(--surface-card)', overflow: 'hidden' }}>
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
                  {upiApp === 'other' && (
                    <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi" style={{ marginTop: 12, width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />
                  )}
                </div>
              )}
            </div>

            {/* Card */}
            <div style={{ borderRadius: 'var(--radius-card)', border: method === 'card' ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: method === 'card' ? 'var(--amber-50)' : 'var(--surface-card)', overflow: 'hidden' }}>
              <button onClick={() => setMethod('card')} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg,#1A1AE0,#6C5CE7)', display: 'grid', placeItems: 'center', flex: 'none' }}><CreditCard size={18} color="#fff" /></span>
                <span style={{ flex: 1, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)', textAlign: 'left' }}>Credit / Debit Card</span>
                <Dot on={method === 'card'} />
              </button>
              {method === 'card' && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ paddingTop: 14 }}>
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Card number</label>
                    <input value={fmt4(card.num)} onChange={e => setCard(c => ({...c, num: e.target.value}))} placeholder="0000 0000 0000 0000" maxLength={19} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'monospace', fontSize: 'var(--text-base)', letterSpacing: '.1em', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Expiry</label><input value={card.exp} onChange={e => setCard(c => ({...c, exp: fmtExp(e.target.value)}))} placeholder="MM/YY" maxLength={5} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} /></div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>CVV</label><input value={card.cvv} onChange={e => setCard(c => ({...c, cvv: e.target.value.slice(0,4)}))} placeholder="•••" type="password" maxLength={4} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} /></div>
                  </div>
                  <div><label style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Name on card</label><input value={card.name} onChange={e => setCard(c => ({...c, name: e.target.value}))} placeholder="Full name as on card" style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 'var(--radius-input)', border: '1.5px solid var(--border-default)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', background: 'var(--surface-raised)', color: 'var(--text-strong)', outline: 'none' }} /></div>
                </div>
              )}
            </div>

            {/* COD */}
            <button onClick={() => setMethod('cod')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-card)', cursor: 'pointer', textAlign: 'left', border: method === 'cod' ? '2px solid var(--amber-300)' : '1.5px solid var(--border-default)', background: method === 'cod' ? 'var(--amber-50)' : 'var(--surface-card)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', flex: 'none' }}><span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>₹</span></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-body)' }}>Cash on Delivery</span>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Pay when your order arrives</span>
              </span>
              <Dot on={method === 'cod'} />
            </button>
          </div>
        </div>

        {/* Bill summary */}
        <div style={{ padding: '20px 18px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}><Receipt size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-base)/1 var(--font-body)', color: 'var(--text-strong)' }}>Bill summary</span></div>
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Item total</span><span>₹{total}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>Delivery fee</span><span>₹{delivery}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}><span>GST (5%)</span><span>₹{gst}</span></div>
              {applied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: '#1F8A5B', fontWeight: 700 }}><span>Coupon ({coupon})</span><span>−₹{discount}</span></div>}
              <Dash />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--text-strong)' }}><span>To pay</span><span>₹{grand}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-soft)', background: 'var(--surface-card)', flex: 'none' }}>
        <button onClick={handlePlace} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Place Order · ₹{grand} <Lock size={18} />
        </button>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <ShieldCheck size={13} /> 100% secure &amp; encrypted payments
        </div>
      </div>
    </div>
  );
}

/* ---- Order Success Page ---- */
function OrderSuccessPage({ show, total, onBackToMenu }: { show: boolean; total: number; onBackToMenu: () => void }) {
  const orderId = `ADC-${20480 + Math.floor(Math.random() * 90)}`;
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

/* ---- Account Sheet ---- */
function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const PAST_ORDERS = [
    { id: 'ADC-20471', date: 'Yesterday · 7:42 PM', status: 'Delivered', total: 280, items: ['ADC Special', 'Biscoff Filled'] },
    { id: 'ADC-20338', date: 'Jun 2 · 5:10 PM', status: 'Delivered', total: 600, items: ['Nutella Tin'] },
  ];

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 84, background: 'var(--surface-overlay)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px,94vw)', maxHeight: '88vh', background: 'var(--surface-page)', borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'riseIn .3s var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-card)', flex: 'none' }}>
          <div style={{ flex: 1, font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>Account</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={20} /></button>
        </div>

        <div className="hide-sb" style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 28px' }}>
          {/* Profile */}
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: 18, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 'var(--text-h3)', fontWeight: 800, flex: 'none' }}>{user?.initials || '?'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: 'var(--weight-bold) var(--text-h4)/1.1 var(--font-display)', color: 'var(--text-strong)' }}>{user?.name || 'Guest'}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{user?.email || 'Not logged in'}</div>
            </div>
            <button style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Pencil size={16} /></button>
          </div>

          {/* Orders */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 4px 10px' }}>
            <span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>My Orders</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-link)', fontWeight: 700, cursor: 'pointer' }}>See all</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {PAST_ORDERS.map(o => (
              <div key={o.id} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '14px 16px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Thumb size={52} seed={1} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--status-success-bg)', color: 'var(--status-success)', fontSize: 'var(--text-2xs)', fontWeight: 800 }}>{o.status}</span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>{o.id}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.items.join(', ')}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{o.date} · ₹{o.total}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}><RotateCcw size={14} /> Reorder</button>
                  <button style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-body)' }}>View details</button>
                </div>
              </div>
            ))}
          </div>

          {/* Settings */}
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '6px 4px', marginBottom: 16, boxShadow: 'var(--shadow-sm)' }}>
            {[{ icon: <CreditCard size={18} />, label: 'Payment methods', value: '2 saved' }, { icon: <Bell size={18} />, label: 'Notifications' }, { icon: <LifeBuoy size={18} />, label: 'Help & support' }, { icon: <Info size={18} />, label: 'About ADC' }].map(row => (
              <button key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', background: 'var(--amber-50)', flex: 'none', color: 'var(--brand-secondary)' }}>{row.icon}</span>
                <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-strong)' }}>{row.label}</span>
                {row.value && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', fontWeight: 600 }}>{row.value}</span>}
                <ChevronRight size={18} color="var(--text-subtle)" />
              </button>
            ))}
          </div>
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '6px 4px', boxShadow: 'var(--shadow-sm)' }}>
            <button onClick={() => { logout(); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '15px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', background: '#FCEEEC', flex: 'none', color: '#D24B36' }}><LogOut size={18} /></span>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: '#D24B36' }}>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Main App ---- */
export default function OrderingApp() {
  const router = useRouter();
  const desktop = useIsDesktop(920);
  const { cart, count, total, setQty, clearAll } = useCart();
  const { user } = useAuth();

  const [menu, setMenu] = useState(FALLBACK_MENU);
  const [tins, setTins] = useState(FALLBACK_TINS);
  const [active, setActive] = useState('Recommended');
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<typeof FALLBACK_MENU[0] | null>(null);
  const [tin, setTin] = useState<typeof FALLBACK_TINS[0] | null>(null);
  const [screen, setScreen] = useState<'menu' | 'cart' | 'checkout' | 'success'>('menu');
  const [payTotal, setPayTotal] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

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
          cat: p.menuGroup || 'Classic Cookies',
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

  const addFromSheet = (item: typeof FALLBACK_MENU[0], qty: number) => {
    setQty(item.id, (cart[item.id]?.qty || 0) + qty, item.name, item.price, item.img);
    setSheet(null);
  };

  const addTin = (t: typeof FALLBACK_TINS[0], qty: number) => {
    setQty(t.id, (cart[t.id]?.qty || 0) + qty, t.name, t.price, t.img);
    setTin(null);
  };

  const filtered = active === 'Gift Tins' ? [] : menu.filter(m => {
    if (active === 'Recommended') return (m as any).rec;
    return m.cat === active;
  }).filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  const placeOrder = (grand: number) => { setPayTotal(grand); clearAll(); setScreen('success'); };

  /* Desktop layout */
  if (desktop) {
    return (
      <>
        <div className="adc-pattern-page" style={{ minHeight: '100vh' }}>
          {/* Desktop header */}
          <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ maxWidth: 1240, margin: '0 auto', padding: '14px var(--gutter)', display: 'flex', alignItems: 'center', gap: 22 }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flex: 'none' }}>
                <Image src="/assets/adc-logo.png" height={48} width={80} alt="a dough cookie" style={{ objectFit: 'contain' }} />
              </a>
              <div style={{ flex: 1, maxWidth: 460 }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-raised)', borderRadius: 'var(--radius-input)', padding: '11px 16px', gap: 10, border: '1.5px solid var(--border-default)' }}>
                  <Search size={18} color="var(--text-subtle)" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Cookies…" style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }} />
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-body)', fontWeight: 600, fontSize: 'var(--text-sm)' }}><MapPin size={18} color="var(--brand-secondary)" /> Bengaluru</span>
              <button onClick={() => user ? setAccountOpen(true) : setLoginOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-button)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text-strong)' }}>
                <User size={18} /> {user ? user.name.split(' ')[0] : 'Account'}
              </button>
            </div>
          </header>

          {/* 3-col layout */}
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '26px var(--gutter) 64px', display: 'grid', gridTemplateColumns: '224px minmax(0,1fr) 340px', gap: 30, alignItems: 'start' }}>
            {/* Category rail */}
            <aside style={{ position: 'sticky', top: 92, alignSelf: 'start' }}>
              <div style={{ fontSize: 'var(--text-2xs)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--brand-secondary)', fontWeight: 700, margin: '4px 12px 12px' }}>Categories</div>
              {CATEGORIES.map(c => {
                const on = c === active;
                const cnt = c === 'Gift Tins' ? tins.length : menu.filter(m => c === 'Recommended' ? (m as any).rec : m.cat === c).length;
                return (
                  <button key={c} onClick={() => setActive(c)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: 'none', background: on ? 'var(--amber-50)' : 'transparent', color: on ? 'var(--amber-800)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: on ? 800 : 600, textAlign: 'left', boxShadow: on ? 'inset 3px 0 0 var(--brand-secondary)' : 'none' }}>
                    <span>{c}</span><span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>{cnt}</span>
                  </button>
                );
              })}
            </aside>

            {/* Menu */}
            <main style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                <span style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>{active}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-subtle)', fontWeight: 600 }}>{active === 'Gift Tins' ? tins.length : filtered.length}</span>
              </div>
              {active === 'Gift Tins' ? (
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
                filtered.map((m, i) => (
                  <div key={m.id}>
                    <ProductMenuItem item={m} qty={cart[m.id]?.qty || 0} onQtyChange={n => setQty(m.id, n, m.name, m.price, m.img)} onOpen={() => setSheet(m as any)} />
                    {count > 0 && i === 0 && (
                      <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-section)', margin: '6px 0 18px', padding: '16px 0 18px' }}>
                        <div style={{ padding: '0 18px 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>Goes great with</span></div>
                        <div className="hide-sb" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 18px' }}>
                          {PAIRINGS.map((p, pi) => (
                            <div key={p.id} style={{ flex: 'none', width: 120 }}>
                              <div style={{ position: 'relative' }}><Thumb size={120} seed={pi + 1} />
                                <div style={{ position: 'absolute', right: 6, bottom: -14 }}>
                                  <QStepper value={cart[p.id]?.qty || 0} onChange={n => setQty(p.id, n, p.name, p.price)} size="sm" />
                                </div>
                              </div>
                              <div style={{ marginTop: 18, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{p.name}</div>
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>₹{p.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </main>

            {/* Cart panel */}
            <aside style={{ position: 'sticky', top: 92, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '18px 20px', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ShoppingBag size={18} color="var(--brand-secondary)" />
                  <span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>Your Cart</span>
                </div>
                {count === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>🍪</div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>Add cookies to get started. Fresh from the oven in ~30 min.</p>
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    {Object.values(cart).map((l, i) => (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < count - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        {l.img ? <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flex: 'none' }}><Image src={l.img} alt={l.name} width={48} height={48} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div> : <Thumb size={48} seed={1} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>₹{l.price}</div>
                        </div>
                        <QStepper value={l.qty} onChange={n => setQty(l.id, n, l.name, l.price, l.img)} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {count > 0 && (
                <>
                  <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
                    {[['Item total', total], ['Delivery', total > 0 ? 29 : 0]].map(([k, v]) => (
                      <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 8 }}><span>{k}</span><span>₹{v}</span></div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-strong)', paddingTop: 10, marginTop: 2, fontWeight: 800, color: 'var(--text-strong)' }}><span>To pay</span><span>₹{total + 29}</span></div>
                  </div>
                  <button onClick={() => setScreen('cart')} style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-button)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Proceed to Pay · ₹{total + 29} <ArrowRight size={18} /></button>
                </>
              )}
            </aside>
          </div>
        </div>

        <DetailSheet item={sheet} onClose={() => setSheet(null)} onAdd={addFromSheet} />
        <TinModal tin={tin} onClose={() => setTin(null)} onAdd={addTin} />
        <CartReviewPage show={screen === 'cart'} onBack={() => setScreen('menu')} onProceed={() => setScreen('checkout')} />
        <CheckoutPage show={screen === 'checkout'} onBack={() => setScreen('cart')} onPlace={placeOrder} />
        <OrderSuccessPage show={screen === 'success'} total={payTotal} onBackToMenu={() => setScreen('menu')} />
        <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  /* Mobile layout */
  return (
    <>
      <div className="adc-pattern-page" style={{ minHeight: '100vh' }}>
        {/* Mobile top nav */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 10px' }}>
            <button onClick={() => router.push('/')} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20} /></button>
            <div style={{ flex: 1 }}>
              <Image src="/assets/adc-logo.png" height={40} width={70} alt="a dough cookie" style={{ objectFit: 'contain' }} />
            </div>
            <button onClick={() => user ? setAccountOpen(true) : setLoginOpen(true)} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><User size={20} /></button>
            <button onClick={() => setDrawer(true)} style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Menu size={20} /></button>
          </div>
          <div style={{ padding: '0 18px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-raised)', borderRadius: 'var(--radius-input)', padding: '11px 16px', gap: 10, border: '1.5px solid var(--border-default)' }}>
              <Search size={18} color="var(--text-subtle)" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Cookies…" style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)', outline: 'none' }} />
            </div>
          </div>
        </div>

        {/* Category strip */}
        <div className="hide-sb" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '14px 18px', position: 'sticky', top: 0 }}>
          {CATEGORIES.map(c => {
            const on = c === active;
            return (
              <button key={c} onClick={() => setActive(c)} style={{ flex: 'none', padding: '8px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', fontWeight: 700, whiteSpace: 'nowrap', border: on ? 'none' : '1.5px solid var(--border-default)', background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', boxShadow: on ? 'var(--shadow-brand)' : 'var(--shadow-xs)', transition: 'all var(--dur-base) var(--ease-out)' }}>
                {c}
              </button>
            );
          })}
        </div>

        {/* Menu content */}
        <div style={{ padding: '0 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ font: 'var(--weight-bold) var(--text-h3)/1 var(--font-display)', color: 'var(--text-strong)' }}>{active}</span>
          </div>
          {active === 'Gift Tins' ? (
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
            filtered.map((m, i) => (
              <div key={m.id}>
                <ProductMenuItem item={m} qty={cart[m.id]?.qty || 0} onQtyChange={n => setQty(m.id, n, m.name, m.price, m.img)} onOpen={() => setSheet(m as any)} />
                {count > 0 && i === 0 && (
                  <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-section)', margin: '6px 0 18px', padding: '16px 0 18px' }}>
                    <div style={{ padding: '0 18px 12px', display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} color="var(--brand-secondary)" /><span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>Goes great with</span></div>
                    <div className="hide-sb" style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 18px' }}>
                      {PAIRINGS.map((p, pi) => (
                        <div key={p.id} style={{ flex: 'none', width: 120 }}>
                          <div style={{ position: 'relative' }}><Thumb size={120} seed={pi + 1} />
                            <div style={{ position: 'absolute', right: 6, bottom: -14 }}><QStepper value={cart[p.id]?.qty || 0} onChange={n => setQty(p.id, n, p.name, p.price)} size="sm" /></div>
                          </div>
                          <div style={{ marginTop: 18, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)' }}>{p.name}</div>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>₹{p.price}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div style={{ height: count > 0 ? 110 : 28 }} />

        {/* Sticky cart bar */}
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, transform: count > 0 ? 'translateY(0)' : 'translateY(120%)', transition: 'transform var(--dur-slow) var(--ease-spring)', padding: '14px 18px' }}>
          <button onClick={() => setScreen('cart')} style={{ width: '100%', height: 60, border: 'none', cursor: 'pointer', background: 'var(--gradient-warm)', color: '#fff', borderRadius: 'var(--radius-button)', boxShadow: 'var(--shadow-brand)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', fontFamily: 'var(--font-body)', fontWeight: 800 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
              <span style={{ fontSize: 'var(--text-xs)', opacity: .92, fontWeight: 600 }}>{count} item{count > 1 ? 's' : ''} added</span>
              <span style={{ fontSize: 'var(--text-lg)' }}>₹{total}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-base)' }}>View Cart <ArrowRight size={20} /></span>
          </button>
        </div>
      </div>

      {/* Category drawer */}
      <>
        <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'var(--surface-overlay)', backdropFilter: 'blur(2px)', opacity: drawer ? 1 : 0, pointerEvents: drawer ? 'auto' : 'none', transition: 'opacity .3s' }} />
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(300px,82vw)', zIndex: 46, background: 'var(--surface-card)', borderTopLeftRadius: 'var(--radius-modal)', borderBottomLeftRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-xl)', padding: '22px 20px', transform: drawer ? 'translateX(0)' : 'translateX(110%)', transition: 'transform var(--dur-slow) var(--ease-spring)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ font: 'var(--weight-bold) var(--text-h4)/1 var(--font-display)', color: 'var(--text-strong)' }}>Menu</span>
            <button onClick={() => setDrawer(false)} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--surface-sunken)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={20} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CATEGORIES.map(c => {
              const on = c === active;
              const cnt = c === 'Gift Tins' ? tins.length : menu.filter(m => c === 'Recommended' ? (m as any).rec : m.cat === c).length;
              return (
                <button key={c} onClick={() => { setActive(c); setDrawer(false); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: 'none', background: on ? 'var(--amber-50)' : 'transparent', color: on ? 'var(--amber-800)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', fontWeight: on ? 800 : 600, textAlign: 'left' }}>
                  <span>{c}</span><span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>

      <DetailSheet item={sheet} onClose={() => setSheet(null)} onAdd={addFromSheet} />
      <TinModal tin={tin} onClose={() => setTin(null)} onAdd={addTin} />
      <CartReviewPage show={screen === 'cart'} onBack={() => setScreen('menu')} onProceed={() => setScreen('checkout')} />
      <CheckoutPage show={screen === 'checkout'} onBack={() => setScreen('cart')} onPlace={placeOrder} />
      <OrderSuccessPage show={screen === 'success'} total={payTotal} onBackToMenu={() => setScreen('menu')} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
