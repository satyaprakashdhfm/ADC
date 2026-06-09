'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getProducts, firstImage } from '@/lib/api';

interface MenuItem { n: string; tag: string; img: string; desc: string; price: number; bg: string; flip: boolean; }

// Warm backdrop palette, cycled per card (presentation only).
const BG_PALETTE = ['#F5E8C8', '#E8D8B8', '#DCE9D4', '#F8D88A', '#F5DCDA', '#F5C47C', '#E8C49A', '#D8C8B0', '#F0E0C8', '#E8D0A8', '#F5ECD0'];

// Rendered instantly on first paint and if the backend is unreachable (mirrors the real menu).
const FALLBACK: Omit<MenuItem, 'bg' | 'flip'>[] = [
  { n: 'Chocolate Chip', tag: 'Classic', img: '/assets/products/blueberry.jpg', price: 60, desc: 'The original. Buttery dough, browned-butter base and premium dark chocolate chips — crisp at the edges, gooey at the core.' },
  { n: 'Double Choc Chip', tag: 'Bestseller', img: '/assets/products/triple-choc.jpg', price: 65, desc: 'Rich cocoa dough loaded with extra-dark chocolate chunks and a dusting of Dutch cocoa. Fudgy and impossible to resist.' },
  { n: 'Raagi (Gluten Free)', tag: 'Gluten Free', img: '/assets/products/oatmeal-raisin.jpg', price: 60, desc: 'Wholesome finger-millet cookie, naturally gluten free, with a warm nutty depth and just the right chew.' },
  { n: 'Matcha', tag: 'Premium', img: '/assets/products/matcha.jpg', price: 90, desc: 'Stone-ground ceremonial matcha from Uji, Japan folded into buttery dough with cacao-butter white-chocolate chips.' },
  { n: 'ADC Special', tag: 'Signature', img: '/assets/products/adc-special.jpg', price: 90, desc: 'Our crown jewel — slow-browned butter, three kinds of premium chocolate and hand-harvested Maldon sea-salt flakes.' },
  { n: 'Red Velvet With Cheese', tag: 'Premium', img: '/assets/products/red-velvet.jpg', price: 90, desc: 'Deep cocoa-red velvet dough wrapped around a tangy cream-cheese centre that softens as it bakes.' },
  { n: 'Biscoff Filled', tag: 'Bestseller', img: '/assets/products/peanut-butter.jpg', price: 110, desc: 'Caramelised cookie shell around a warm, molten river of Belgian Lotus Biscoff spread.' },
  { n: 'Nutella Filled', tag: 'Recommended', img: '/assets/products/caramel-cashew.jpg', price: 90, desc: 'A gooey Nutella centre tucked inside a soft chocolate cookie. Absolutely irresistible warm.' },
  { n: 'Nutella Tin', tag: 'Gift', img: '/assets/products/coffee-almond.jpg', price: 600, desc: 'Six premium Nutella-filled cookies in a keepsake gift tin. Perfect for gifting and celebrations.' },
  { n: 'Biscoff Tin', tag: 'Gift', img: '/assets/products/m-and-m.jpg', price: 850, desc: 'Nine Biscoff-filled cookies, gift-ready in a premium tin with a ribbon wrap and name tag.' },
];

const decorate = (items: Omit<MenuItem, 'bg' | 'flip'>[]): MenuItem[] =>
  items.map((p, i) => ({ ...p, bg: BG_PALETTE[i % BG_PALETTE.length], flip: i % 2 === 1 }));

function ProductCard({ p }: { p: MenuItem }) {
  const router = useRouter();

  const imageEl = (
    <div style={{ flex: 'none', width: 580, height: 500, borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,.14)' }}>
      <Image
        src={p.img} alt={p.n} width={580} height={500}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .5s ease' }}
        onMouseEnter={e => ((e.target as HTMLImageElement).style.transform = 'scale(1.06)')}
        onMouseLeave={e => ((e.target as HTMLImageElement).style.transform = 'none')}
      />
    </div>
  );

  const textEl = (
    <div style={{ flex: 1, minWidth: 0, padding: '0 8px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 14px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(8px)', marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '.04em' }}>{p.tag}</span>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1.5rem,1.1rem + 1.8vw,2.4rem)', lineHeight: .96, letterSpacing: '-.025em', color: 'var(--text-strong)', margin: '0 0 10px' }}>{p.n}</h2>
      <p style={{ fontSize: 'var(--text-base)', color: 'rgba(30,18,8,.65)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 520 }}>{p.desc}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => router.push('/order')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '14px 32px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--surface-inverse)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', whiteSpace: 'nowrap', transition: 'transform .2s,box-shadow .2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >Order Now</button>
        <button
          onClick={() => router.push('/order')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '14px 32px', cursor: 'pointer', borderRadius: 'var(--radius-pill)', border: '2px solid rgba(30,18,8,.25)', background: 'transparent', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-strong)', whiteSpace: 'nowrap', transition: 'background .2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >Learn More</button>
      </div>
    </div>
  );

  return (
    <div
      className="prod-card"
      style={{ background: 'transparent', borderRadius: 32, padding: 'clamp(36px,5vw,72px) clamp(36px,6vw,80px)', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap', overflow: 'hidden', transition: 'background .4s ease,transform .3s ease,box-shadow .3s ease', cursor: 'default' }}
      onMouseEnter={e => { e.currentTarget.style.background = p.bg; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,.13)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {p.flip ? <>{textEl}{imageEl}</> : <>{imageEl}{textEl}</>}
    </div>
  );
}

function PatternSection({ items, children }: { items: MenuItem[]; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Floral background */}
      <div style={{ position: 'absolute', inset: 0, background: '#F9EDE1', backgroundImage: "url('/assets/floral-pattern-only.png')", backgroundSize: '620px auto', backgroundRepeat: 'repeat' }} />

      {/* Orange edge blobs - one per product card on alternating sides */}
      {items.map((prod, i) => {
        const onRight = !prod.flip;
        return onRight ? (
          <svg key={'blob-r' + i} style={{ position: 'absolute', top: `calc(${i} * (100% / ${items.length}) + 2%)`, right: 0, width: 108, height: 160, pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 108 160">
            <path d="M108,0 L108,160 C88,148 78,118 82,80 C86,42 100,12 108,0 Z" fill="#EF7507" />
            <path d="M82,80 C86,42 100,12 108,0" fill="none" stroke="white" strokeWidth="2.2" strokeDasharray="8 6" />
          </svg>
        ) : (
          <svg key={'blob-l' + i} style={{ position: 'absolute', top: `calc(${i} * (100% / ${items.length}) + 2%)`, left: 0, width: 100, height: 152, pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 100 152">
            <path d="M0,0 L0,152 C20,140 30,110 26,76 C22,42 8,12 0,0 Z" fill="#EF7507" />
            <path d="M26,76 C22,42 8,12 0,0" fill="none" stroke="white" strokeWidth="2.2" strokeDasharray="8 6" />
          </svg>
        );
      })}

      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export default function Products() {
  const [items, setItems] = useState<MenuItem[]>(() => decorate(FALLBACK));

  // Load the full live menu from the DB (cookies first, then tins — backend order).
  useEffect(() => {
    getProducts().then(products => {
      if (!products?.length) return;
      setItems(decorate(products.map(p => ({
        n: p.name, tag: p.tag || 'Cookie', img: firstImage(p.images),
        desc: p.description || '', price: Number(p.price),
      }))));
    }).catch(() => {}); // keep fallback on error
  }, []);

  return (
    <PatternSection items={items}>
      <section style={{ padding: '56px 0 96px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Our Menu</p>
            <h2 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.025em' }}>Every Cookie, Every Tin.</h2>
          </div>
          {items.map((p) => <ProductCard key={p.n} p={p} />)}
        </div>
      </section>

      {/* Reviews section */}
      <section style={{ padding: '72px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Customer Love</p>
          <h2 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: '0 0 48px', letterSpacing: '-.025em' }}>People can&apos;t stop</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40 }}>
            {[
              { q: 'The Biscoff filled is unreal — gooey, warm, perfect. My weekly ritual now.', a: 'Ananya R.', city: 'Bengaluru' },
              { q: 'Arrived warm and smelled incredible. ADC Special is the best cookie in the city.', a: 'Karthik M.', city: 'Hyderabad' },
              { q: 'Beautiful packaging — gifted a Nutella tin and it was a total hit.', a: 'Sneha P.', city: 'Mumbai' },
            ].map((rv, i) => (
              <div key={i}>
                <div style={{ color: 'var(--amber-500)', fontSize: 18, letterSpacing: 4, marginBottom: 16 }}>★★★★★</div>
                <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-strong)', lineHeight: 1.65, margin: '0 0 20px', fontWeight: 500 }}>&ldquo;{rv.q}&rdquo;</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>{rv.a[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{rv.a}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{rv.city}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PatternSection>
  );
}
