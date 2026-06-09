'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export const PRODUCTS = [
  { n: 'Blueberry Cookie', tag: 'Classic', img: '/assets/products/blueberry.jpg', desc: 'The original. Buttery dough, browned butter base, two types of premium dark chocolate chips, and a pinch of fleur de sel. Crisp at the edges, gooey at the core — every single time.', bg: '#F5E8C8', flip: false },
  { n: 'Triple Chocolate', tag: 'Bestseller', img: '/assets/products/triple-choc.jpg', desc: 'Built for the serious chocolate lover. Our deep cocoa dough is folded with extra-dark Callebaut chocolate chunks and finished with a dusting of Dutch-process cocoa. Fudgy, rich and completely impossible to resist.', bg: '#E8D8B8', flip: true },
  { n: 'Matcha', tag: 'Premium', img: '/assets/products/matcha.jpg', desc: 'Stone-ground ceremonial-grade matcha from Uji, Japan, folded into our signature buttery dough alongside cacao-butter white-chocolate chips. Earthy bitterness balanced with creamy sweetness in every bite.', bg: '#DCE9D4', flip: false },
  { n: 'ADC Special', tag: 'Signature', img: '/assets/products/adc-special.jpg', desc: 'Our crown jewel. We slow-brown the butter until it smells like toffee, fold in three kinds of premium chocolate, then finish each cookie with hand-harvested Maldon sea-salt flakes. No other cookie tells our story better than this one.', bg: '#F8D88A', flip: true },
  { n: 'Red Velvet', tag: 'Premium', img: '/assets/products/red-velvet.jpg', desc: 'A bold, bakery-inspired creation — deep cocoa-red velvet dough wrapped around a tangy cream-cheese centre that softens as it bakes. The contrast of rich dough and silky filling makes it our most dramatic cookie.', bg: '#F5DCDA', flip: false },
  { n: 'Peanut Butter Filled', tag: 'Bestseller', img: '/assets/products/peanut-butter.jpg', desc: 'Golden caramelised cookie dough surrounds a warm, molten river of Belgian Lotus Biscoff spread. We freeze the filling before baking to create a gooey, lava-like centre that flows the moment you break it open.', bg: '#F5C47C', flip: true },
  { n: 'Caramel Cashew', tag: 'Filled', img: '/assets/products/caramel-cashew.jpg', desc: 'Pull it apart and watch the caramel flow. Our soft chocolate dough is wrapped around a generous frozen disc of smooth caramel and roasted cashews which bakes into a warm, silky centre.', bg: '#E8C49A', flip: false },
  { n: 'Oatmeal Raisin', tag: 'Classic', img: '/assets/products/oatmeal-raisin.jpg', desc: 'Crafted with rolled oats, warm cinnamon and plump raisins — wholesome and deeply satisfying. We balance the earthy nuttiness with coconut palm sugar for a cookie that feels like home in every bite.', bg: '#D8C8B0', flip: true },
  { n: 'M&M Cookie', tag: 'Fun', img: '/assets/products/m-and-m.jpg', desc: 'Our playful side. Buttery vanilla dough packed with colourful M&M candies that melt slightly as the cookie bakes, creating little pockets of colour and sweetness throughout.', bg: '#F0E0C8', flip: false },
  { n: 'Coffee Almond', tag: 'Premium', img: '/assets/products/coffee-almond.jpg', desc: 'Espresso-infused dough meets toasted whole almonds in our most sophisticated cookie. The coffee deepens as it bakes, creating a complex, aromatic flavour with a satisfying crunch.', bg: '#E8D0A8', flip: true },
  { n: 'White Chocolate', tag: 'Classic', img: '/assets/products/white-choc.jpg', desc: 'Buttery golden dough folded with generous chunks of Belgian white chocolate and a hint of vanilla bean. Sweet, creamy and utterly indulgent.', bg: '#F5ECD0', flip: false },
];

function ProductCard({ p, i }: { p: typeof PRODUCTS[0]; i: number }) {
  const router = useRouter();

  const onRight = !p.flip;
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

function PatternSection({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Floral background */}
      <div style={{ position: 'absolute', inset: 0, background: '#F9EDE1', backgroundImage: "url('/assets/floral-pattern-only.png')", backgroundSize: '620px auto', backgroundRepeat: 'repeat' }} />

      {/* Orange edge blobs - one per product card on alternating sides */}
      {PRODUCTS.map((prod, i) => {
        const onRight = !prod.flip;
        return onRight ? (
          <svg key={'blob-r'+i} style={{ position: 'absolute', top: `calc(${i} * (100% / ${PRODUCTS.length}) + 2%)`, right: 0, width: 108, height: 160, pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 108 160">
            <path d="M108,0 L108,160 C88,148 78,118 82,80 C86,42 100,12 108,0 Z" fill="#EF7507"/>
            <path d="M82,80 C86,42 100,12 108,0" fill="none" stroke="white" strokeWidth="2.2" strokeDasharray="8 6"/>
          </svg>
        ) : (
          <svg key={'blob-l'+i} style={{ position: 'absolute', top: `calc(${i} * (100% / ${PRODUCTS.length}) + 2%)`, left: 0, width: 100, height: 152, pointerEvents: 'none', zIndex: 0 }} viewBox="0 0 100 152">
            <path d="M0,0 L0,152 C20,140 30,110 26,76 C22,42 8,12 0,0 Z" fill="#EF7507"/>
            <path d="M26,76 C22,42 8,12 0,0" fill="none" stroke="white" strokeWidth="2.2" strokeDasharray="8 6"/>
          </svg>
        );
      })}

      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export default function Products() {
  return (
    <PatternSection>
      <section style={{ padding: '56px 0 96px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Our Menu</p>
            <h2 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.025em' }}>Every Cookie, Every Tin.</h2>
          </div>
          {PRODUCTS.map((p, i) => <ProductCard key={p.n} p={p} i={i} />)}
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
