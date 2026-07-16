'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Plus, Minus, ArrowRight, Cookie, Gift, Briefcase } from 'lucide-react';
import { getProducts, firstImage, type Product } from '@/lib/api';
import { useCart } from '@/context/CartContext';

const CATS = [
  { key: 'COOKIES', label: 'Cookies', icon: <Cookie size={16} /> },
  { key: 'TINS', label: 'Cookie Tins', icon: <Gift size={16} /> },
] as const;
type CatKey = typeof CATS[number]['key'];

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };

function ProductCard({ p }: { p: Product }) {
  const { cart, setQty } = useCart();
  const id = String(p.id);
  const qty = cart[id]?.qty || 0;
  const img = firstImage(p.images);
  const price = Number(p.price);
  const change = (n: number) => setQty(id, Math.max(0, n), p.name, price, img);

  return (
    <div style={{ background: 'var(--vanilla)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-sunken)' }}>
        {img && <Image src={img} alt={p.name} fill sizes="(max-width:760px) 50vw, 280px" style={{ objectFit: 'cover' }} />}
      </div>
      <div style={{ padding: 'clamp(12px,1.4vw,16px)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <h3 style={{ font: 'var(--weight-extra) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{p.name}</h3>
        {p.description && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
          <span style={{ fontWeight: 900, color: 'var(--text-strong)', fontSize: 'var(--text-base)' }}>₹{price}</span>
          {qty === 0 ? (
            <button onClick={() => change(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' }}>
              <Plus size={15} /> Add
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gradient-warm)', borderRadius: 'var(--radius-pill)', padding: 3 }}>
              <button onClick={() => change(qty - 1)} aria-label="Remove one" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--white-16)', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Minus size={15} /></button>
              <span style={{ minWidth: 18, textAlign: 'center', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>{qty}</span>
              <button onClick={() => change(qty + 1)} aria-label="Add one" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--white-16)', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={15} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomeProducts() {
  const router = useRouter();
  const { count, total } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [cat, setCat] = useState<CatKey>('COOKIES');
  const [q, setQ] = useState('');

  useEffect(() => { getProducts().then(p => setProducts(p || [])).catch(() => {}); }, []);

  // Deep-link support (replaces the old /order?cat=&q= — those now land here).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('cat');
    const query = params.get('q');
    if (c === 'tins') setCat('TINS'); else if (c === 'cookies') setCat('COOKIES');
    if (query) { setQ(query); if (/tin|gift/i.test(query)) setCat('TINS'); }
    // Arrived from a product/search link → scroll the grid into view.
    if (c || query) {
      const t = setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const list = products
    .filter(p => p.category === cat && p.isAvailable)
    .filter(p => !/sundae/i.test(p.name)) // Cookie Sundae hidden from the menu for now
    .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <section id="products" style={{ background: 'var(--gold)', padding: 'clamp(40px,6vw,80px) 0', borderTop: '1px solid var(--border-default)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(20px,3vw,32px)' }}>
          <p style={eyebrow}>Order online</p>
          <h2 style={{ font: '900 clamp(1.7rem,1.2rem + 2vw,2.6rem)/1 var(--font-display)', letterSpacing: '-.02em', color: 'var(--text-strong)', margin: '0 0 10px' }}>Fresh from the oven</h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', maxWidth: 520, margin: '0 auto' }}>Pick your favourites and add them to the cart — checkout in a tap.</p>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 'clamp(20px,3vw,30px)' }}>
          {CATS.map(c => {
            const on = c.key === cat;
            return (
              <button key={c.key} onClick={() => { setCat(c.key); setQ(''); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: `1.5px solid ${on ? 'var(--brand-secondary)' : 'var(--border-default)'}`, background: on ? 'var(--gradient-warm)' : 'var(--surface-card)', color: on ? 'var(--white)' : 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: on ? 'var(--shadow-brand)' : 'none' }}>
                {c.icon} {c.label}
              </button>
            );
          })}
          <button onClick={() => router.push('/franchise')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>
            <Briefcase size={16} /> Corporate &amp; bulk
          </button>
        </div>

        {/* Grid */}
        {list.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>Loading fresh cookies…</p>
        ) : (
          <div className="home-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(14px,1.8vw,22px)' }}>
            {list.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* Sticky cart bar — appears once something's in the cart */}
      {count > 0 && (
        <button onClick={() => router.push('/checkout')} className="home-cart-bar"
          style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 45, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', background: 'var(--surface-inverse)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-xl)' }}>
          <ShoppingBag size={19} /> {count} item{count === 1 ? '' : 's'} · ₹{total} <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: .95 }}>Checkout <ArrowRight size={17} /></span>
        </button>
      )}
    </section>
  );
}
