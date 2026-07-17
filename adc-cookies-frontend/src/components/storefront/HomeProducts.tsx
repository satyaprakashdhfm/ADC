'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Plus, Minus, ArrowRight, Cookie, Gift, Briefcase } from 'lucide-react';
import { getProducts, firstImage, type Product } from '@/lib/api';
import { useCart } from '@/context/CartContext';

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(14px,1.8vw,22px)' };

// One short, precise line about the product — take just the first sentence and trim at a word
// boundary, so the card never shows a mid-sentence cut ending in "and …".
function shortDesc(d?: string): string {
  if (!d) return '';
  const first = d.trim().split(/(?<=[.!?])\s/)[0].replace(/[.\s]+$/, '');
  return first.length > 84 ? first.slice(0, 82).replace(/[\s,]+\S*$/, '') + '…' : first;
}

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
        {p.description && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{shortDesc(p.description)}</p>}
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

function SubHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 'clamp(26px,3.5vw,44px) 0 16px' }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
      <h3 style={{ font: '900 clamp(1.4rem,1.1rem + 1.2vw,2rem)/1 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.02em' }}>{title}</h3>
    </div>
  );
}

export default function HomeProducts() {
  const router = useRouter();
  const { count, total } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const deepLinkScrolled = useRef(false); // scroll a ?q= deep-link to its section only once, after products load
  const [inView, setInView] = useState(false); // the floating checkout bar only shows while browsing products

  useEffect(() => {
    // Show cached products instantly on reload (no waiting for the API), then refresh in the background.
    try { const c = localStorage.getItem('adc_products_cache'); if (c) { const arr = JSON.parse(c); if (Array.isArray(arr) && arr.length) setProducts(arr); } } catch { /* ignore */ }
    getProducts().then(p => {
      if (p?.length) { setProducts(p); try { localStorage.setItem('adc_products_cache', JSON.stringify(p)); } catch { /* ignore */ } }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    // Only reveal the checkout bar once products fill the lower ~45% of the screen
    // (a full card row is visible) — never while the hero is still on screen.
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '0px 0px -45% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Deep-link from nav search / product menus (/order?q= → redirects here): remember the query (it
  // floats a matching cookie to the top) and strip ?q= from the address bar so the home URL stays clean.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    if (!query) return;
    setQ(query);
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  }, []);

  // Once products load, scroll a deep-linked query to the right place: a TIN query (or a tin name)
  // jumps to the Cookie Tins section; anything else scrolls to the (floated) cookies.
  useEffect(() => {
    if (!q || deepLinkScrolled.current || products.length === 0) return;
    deepLinkScrolled.current = true;
    const term = q.trim().toLowerCase();
    const isTin = /tin/.test(term) || products.some(p => p.category === 'TINS' && p.name.toLowerCase().includes(term));
    const id = isTin ? 'tins-section' : 'products';
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    return () => clearTimeout(t);
  }, [q, products]);

  // Nav category deep-link (/order?cat=cookies|tins|corporate → redirects here): scroll to that section.
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get('cat');
    if (!cat) return;
    const id = cat === 'tins' ? 'tins-section' : cat === 'corporate' ? 'corporate-section' : 'products';
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
    return () => clearTimeout(t);
  }, []);

  // Selecting/searching a product floats it to the top but KEEPS every other cookie visible.
  const ql = q.trim().toLowerCase();
  const cookies = products
    .filter(p => p.category === 'COOKIES' && p.isAvailable && !/sundae/i.test(p.name))
    .sort((a, b) => (ql ? (a.name.toLowerCase().includes(ql) ? 0 : 1) - (b.name.toLowerCase().includes(ql) ? 0 : 1) : 0));
  const tins = products.filter(p => p.category === 'TINS' && p.isAvailable);

  return (
    <section ref={sectionRef} id="products" style={{ background: 'var(--gold)', padding: 'clamp(40px,6vw,80px) 0', borderTop: '1px solid var(--border-default)' }}>
      <div style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(6px,1.5vw,14px)' }}>
          <p style={eyebrow}>Order online</p>
          <h2 style={{ font: '900 clamp(1.7rem,1.2rem + 2vw,2.6rem)/1 var(--font-display)', letterSpacing: '-.02em', color: 'var(--text-strong)', margin: '0 0 10px' }}>Fresh from the oven</h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', maxWidth: 520, margin: '0 auto' }}>Pick your favourites and add them to the cart — checkout in a tap.</p>
        </div>

        {/* Cookies */}
        <SubHead icon={<Cookie size={19} />} title="Cookies" />
        {cookies.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Loading fresh cookies…</p>
        ) : (
          <div className="home-products-grid" style={gridStyle}>
            {cookies.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        )}

        {/* Cookie Tins */}
        {tins.length > 0 && (
          <div id="tins-section" style={{ scrollMarginTop: 90 }}>
            <SubHead icon={<Gift size={19} />} title="Cookie Tins" />
            <div className="home-products-grid" style={gridStyle}>
              {tins.map(p => <ProductCard key={p.id} p={p} />)}
            </div>
          </div>
        )}

        {/* Corporate & bulk gifting — last, as a wide card */}
        <button
          id="corporate-section"
          onClick={() => router.push('/contact#get-in-touch')}
          style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', marginTop: 'clamp(28px,4vw,52px)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', background: 'var(--surface-inverse)', color: 'var(--cream-100)', padding: 'clamp(22px,3vw,36px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260, flex: '1 1 320px' }}>
            <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--white-16)', color: 'var(--white)', display: 'grid', placeItems: 'center', flex: 'none' }}><Briefcase size={22} /></span>
            <div>
              <h3 style={{ font: '900 clamp(1.3rem,1rem + 1.2vw,1.9rem)/1.1 var(--font-display)', color: 'var(--white)', margin: '0 0 4px', letterSpacing: '-.02em' }}>Corporate &amp; Bulk Gifting</h3>
              <p style={{ color: 'var(--cream-100-72)', margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5, maxWidth: 460 }}>Cookies for teams, clients &amp; celebrations — branded boxes, bulk pricing and coordinated delivery.</p>
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', flex: 'none', boxShadow: 'var(--shadow-brand)' }}>Enquire / Order in bulk <ArrowRight size={16} /></span>
        </button>
      </div>

      {/* Floating checkout bar — only while the products section is on screen */}
      {count > 0 && inView && (
        <button onClick={() => router.push('/checkout')} className="home-cart-bar"
          style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 45, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', background: 'var(--surface-inverse)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-xl)' }}>
          <ShoppingBag size={19} /> {count} item{count === 1 ? '' : 's'} · ₹{total} <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: .95 }}>Checkout <ArrowRight size={17} /></span>
        </button>
      )}
    </section>
  );
}
