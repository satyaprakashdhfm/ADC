'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getProducts, firstImage } from '@/lib/api';
import { PRODUCT_DOCS, productPath } from '@/lib/products';

interface MenuItem { n: string; tag: string; img: string; desc: string; price: number; bg: string; flip: boolean; }

// Card tint per product — each echoes the cookie, in a light on-brand register that
// keeps the dark card text readable. Falls back to a warm caramel.
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

// Deterministic pseudo-jitter (Math.sin hash) — identical on server & client, so no
// hydration mismatch (no Math.random, which would differ between renders).
const dRnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Real cookie photos scattered as a medium-size background layer (behind the cards),
// tucked into both margins. Cutouts live in /assets/bg-cookies.
const COOKIE_SRCS = ['real-2', 'real-3', 'real-4', 'real-5', 'real-6', 'real-7'];
// Even grid across the WHOLE section (middle + edges + top + bottom), gently jittered,
// so it reads as a full background texture rather than only hugging the side edges.
const BG_COLS = 6;
const BG_ROWS = 18;
const BG_COOKIES = Array.from({ length: BG_COLS * BG_ROWS }, (_, i) => {
  const col = i % BG_COLS, row = Math.floor(i / BG_COLS);
  const src = COOKIE_SRCS[i % COOKIE_SRCS.length];
  const brick = (row % 2) * 0.5;                       // offset alternate rows so columns don't line up
  const left = (((col + 0.5 + brick + (dRnd(i, 4) - 0.5) * 0.9) / BG_COLS) * 100).toFixed(1) + '%';
  const top  = (((row + 0.5 + (dRnd(i, 1) - 0.5) * 0.9) / BG_ROWS) * 100).toFixed(1) + '%';
  const size = 120 + Math.round(dRnd(i, 3) * 60);     // ~120–180px
  const rot  = Math.round(dRnd(i, 5) * 40 - 20);
  const op   = 0.16;                                   // faint — a true background texture
  return { src, left, top, size, rot, op };
});

// Rendered instantly on first paint and if the backend is unreachable (mirrors the real menu).
// Richer marketing copy for the home cards (description + texture + sweetness), keyed by
// name, so the wide cards read full instead of empty.
const LONG_DESC: Record<string, string> = Object.fromEntries(
  PRODUCT_DOCS.map(d => [d.name, `${d.description} ${d.texture} ${d.sweetness}`])
);

const FALLBACK: Omit<MenuItem, 'bg' | 'flip'>[] = PRODUCT_DOCS.map((p) => ({
  n: p.name,
  tag: p.tag,
  img: p.image,
  price: p.price,
  desc: LONG_DESC[p.name] ?? p.description,
}));

const decorate = (items: Omit<MenuItem, 'bg' | 'flip'>[]): MenuItem[] =>
  items.map((p, i) => ({ ...p, bg: HOVER_TINT[p.n] ?? DEFAULT_TINT, flip: i % 2 === 1 }));

function ProductCard({ p }: { p: MenuItem }) {
  const router = useRouter();
  const [hover, setHover] = useState(false);

  const imageEl = (
    <div style={{ flex: 'none', width: 490, height: 490, borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,.14)' }}>
      <Image
        src={p.img} alt={p.n} width={490} height={490}
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
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1.9rem,1.3rem + 2.2vw,2.9rem)', lineHeight: .98, letterSpacing: '-.025em', color: 'var(--text-strong)', margin: '0 0 14px' }}>{p.n}</h2>
      <p style={{ fontSize: 'var(--text-lg)', color: 'rgba(30,18,8,.66)', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 580 }}>{p.desc}</p>
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
        >Learn More</button>
      </div>
    </div>
  );

  return (
    <div
      className="prod-card"
      style={{ background: hover ? p.bg : 'transparent', borderRadius: 32, padding: 'clamp(26px,3.2vw,48px) clamp(36px,6vw,80px)', display: 'flex', alignItems: 'center', gap: 56, flexWrap: 'wrap', overflow: 'hidden', transform: hover ? 'translateY(-3px)' : 'none', boxShadow: hover ? '0 24px 48px rgba(0,0,0,.28)' : 'none', transition: 'background .4s ease, transform .3s ease, box-shadow .3s ease', cursor: 'default' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {p.flip ? <>{textEl}{imageEl}</> : <>{imageEl}{textEl}</>}
    </div>
  );
}

function PatternSection({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Warm base colour */}
      <div style={{ position: 'absolute', inset: 0, background: '#F9EDE1' }} />
      {/* Floral pattern — kept faint so it reads as a subtle backdrop, not a loud overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/assets/floral-pattern-only.png')", backgroundSize: '620px auto', backgroundRepeat: 'repeat', opacity: 0.4 }} />

      {/* Real cookie photos — faint, spread evenly across the whole section as a background */}
      {BG_COOKIES.map((c, i) => (
        <div
          key={'bgc' + i}
          aria-hidden
          style={{
            position: 'absolute', top: c.top, left: c.left,
            width: c.size, height: c.size, marginLeft: -c.size / 2, marginTop: -c.size / 2,
            backgroundImage: `url('/assets/bg-cookies/${c.src}.png')`,
            backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            transform: `rotate(${c.rot}deg)`, opacity: c.op,
            pointerEvents: 'none', zIndex: 0,
          }}
        />
      ))}

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
        desc: LONG_DESC[p.name] ?? (p.description || ''), price: Number(p.price),
      }))));
    }).catch(() => {}); // keep fallback on error
  }, []);

  return (
    <PatternSection>
      <section id="menu" style={{ padding: '56px 0 96px' }}>
        <div style={{ maxWidth: 1520, margin: '0 auto', padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Our Menu</p>
            <h2 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.025em' }}>Every Cookie, Every Tin.</h2>
          </div>
          {items.map((p) => <ProductCard key={p.n} p={p} />)}
        </div>
      </section>

      {/* Reviews section — dark-brown band matching the footer */}
      <section style={{ padding: '88px 0', background: 'var(--surface-inverse)', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--gutter)' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Customer Love</p>
          <h2 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: '#fff', margin: '0 0 48px', letterSpacing: '-.025em' }}>People can&apos;t stop</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40 }}>
            {[
              { q: 'The Biscoff filled is unreal — gooey, warm, perfect. My weekly ritual now.', a: 'Ananya R.', city: 'Bengaluru' },
              { q: 'Arrived warm and smelled incredible. ADC Special is the best cookie in the city.', a: 'Karthik M.', city: 'Hyderabad' },
              { q: 'Beautiful packaging — gifted a Nutella tin and it was a total hit.', a: 'Sneha P.', city: 'Mumbai' },
            ].map((rv, i) => (
              <div key={i}>
                <div style={{ color: 'var(--amber-500)', fontSize: 18, letterSpacing: 4, marginBottom: 16 }}>★★★★★</div>
                <p style={{ fontSize: 'var(--text-lg)', color: 'var(--cream-100)', lineHeight: 1.65, margin: '0 0 20px', fontWeight: 500 }}>&ldquo;{rv.q}&rdquo;</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>{rv.a[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{rv.a}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,248,241,.55)' }}>{rv.city}</div>
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
