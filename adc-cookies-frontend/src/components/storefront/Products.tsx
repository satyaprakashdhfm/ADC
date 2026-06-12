'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getProducts, firstImage } from '@/lib/api';
import { PRODUCT_DOCS, productPath } from '@/lib/products';

interface MenuItem { n: string; tag: string; img: string; desc: string; price: number; bg: string; flip: boolean; }

// Hover tint per product — each echoes the cookie itself, kept in one deeper,
// on-brand register (light enough for the dark card text). Falls back to a warm
// caramel for any product not listed.
const HOVER_TINT: Record<string, string> = {
  'Chocolate Chip':         '#E6C79A', // warm caramel-tan
  'Double Choc Chip':       '#D9B98C', // deeper cocoa-tan
  'Raagi (Gluten Free)':    '#E0CBA0', // millet beige
  'Matcha':                 '#CFD9A6', // soft matcha green
  'ADC Special':            '#ECC988', // signature honey/gold
  'Red Velvet With Cheese': '#E7BEB0', // soft dusty rose
  'Biscoff Filled':         '#E6C188', // biscoff caramel
  'Nutella Filled':         '#DCB98E', // hazelnut
  'Nutella Tin':            '#D8B488', // hazelnut (tin)
  'Biscoff Tin':            '#E3BE84', // caramel (tin)
};
const DEFAULT_TINT = '#E8C68E';

// A few faint cookie/crumb doodles sprinkled into the menu background — sparse and
// subtle, layered over the floral pattern (not a dense tile). Positioned from the
// page edges so they sit in the margins rather than over the product photos.
// Deterministic pseudo-jitter (Math.sin hash) — identical on server & client, so no
// hydration mismatch (and no Math.random, which would differ between renders).
const dRnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ~50 faint cookie/crumb doodles, evenly spaced down both margins, gently jittered.
const DOODLE_COUNT = 50;
const DOODLES = Array.from({ length: DOODLE_COUNT }, (_, i) => {
  const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
  const isCrumb = i % 3 === 2;
  const src = isCrumb ? (i % 2 ? 'crumb-2' : 'crumb-1') : `cookie-${(i % 4) + 1}`;
  const top = (i * (100 / DOODLE_COUNT) + dRnd(i, 1) * 1.4).toFixed(2) + '%';
  const pos = (4 + dRnd(i, 4) * 12).toFixed(1) + '%';
  const size = isCrumb ? 38 + Math.round(dRnd(i, 2) * 14) : 70 + Math.round(dRnd(i, 3) * 30);
  const rot = Math.round(dRnd(i, 5) * 40 - 20);
  const op = isCrumb ? 0.2 : 0.17;
  return { src, top, side, pos, size, rot, op };
});

// Rendered instantly on first paint and if the backend is unreachable (mirrors the real menu).
const FALLBACK: Omit<MenuItem, 'bg' | 'flip'>[] = PRODUCT_DOCS.map((p) => ({
  n: p.name,
  tag: p.tag,
  img: p.image,
  price: p.price,
  desc: p.description,
}));

const decorate = (items: Omit<MenuItem, 'bg' | 'flip'>[]): MenuItem[] =>
  items.map((p, i) => ({ ...p, bg: HOVER_TINT[p.n] ?? DEFAULT_TINT, flip: i % 2 === 1 }));

function ProductCard({ p }: { p: MenuItem }) {
  const router = useRouter();

  const imageEl = (
    <div style={{ flex: 'none', width: 720, height: 440, borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,.14)' }}>
      <Image
        src={p.img} alt={p.n} width={720} height={440}
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
          onClick={() => router.push(productPath(p.n))}
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
      {/* Warm base colour */}
      <div style={{ position: 'absolute', inset: 0, background: '#F9EDE1' }} />
      {/* Floral pattern — kept faint so it reads as a subtle backdrop, not a loud overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/assets/floral-pattern-only.png')", backgroundSize: '620px auto', backgroundRepeat: 'repeat', opacity: 0.4 }} />

      {/* Faint cookie doodles sprinkled over the pattern */}
      {DOODLES.map((d, i) => (
        <div
          key={'doodle' + i}
          aria-hidden
          style={{
            position: 'absolute', top: d.top, [d.side]: d.pos,
            width: d.size, height: d.size,
            backgroundImage: `url('/assets/doodles/${d.src}.png')`,
            backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            transform: `rotate(${d.rot}deg)`, opacity: d.op,
            pointerEvents: 'none', zIndex: 0,
          }}
        />
      ))}

      {/* Cookie mascots — one per product card, peeking in from alternating edges
         (replaces the old orange blobs). 6 mascots cycle across the cards. */}
      {items.map((prod, i) => {
        const onRight = !prod.flip;
        const src = `/assets/mascots/mascot-${(i % 6) + 1}.png`;
        return (
          <div
            key={'masc' + i}
            aria-hidden
            style={{
              position: 'absolute',
              top: `calc(${i} * (100% / ${items.length}) + 3%)`,
              [onRight ? 'right' : 'left']: 0,
              width: 128, height: 150,
              backgroundImage: `url('${src}')`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: onRight ? 'right center' : 'left center',
              transform: onRight ? 'scaleX(-1)' : 'none',
              opacity: 0.42,
              filter: 'drop-shadow(0 4px 8px rgba(58,37,26,.08))',
              pointerEvents: 'none', zIndex: 0,
            }}
          />
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
      <section id="menu" style={{ padding: '56px 0 96px' }}>
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
