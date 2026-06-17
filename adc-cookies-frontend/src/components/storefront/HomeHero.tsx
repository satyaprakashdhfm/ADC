'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, Cookie, Gift, Briefcase, ArrowRight } from 'lucide-react';

interface HomeHeroProps {
  onMenuOpen: () => void;
}

interface Category {
  key: string;
  label: string;
  desc: string;
  cta: string;
  href: string;
  img: string;
  icon: React.ReactNode;
  tint: string;
}

// The three things people land here to find — each routes straight into the order page,
// pre-selecting its category (see OrderingApp's ?cat= handling).
const CATEGORIES: Category[] = [
  {
    key: 'cookies',
    label: 'Cookies',
    desc: 'Soft-centre, fresh-baked cookies in every flavour — Choc Chip to molten Biscoff & Nutella filled.',
    cta: 'Order Cookies',
    href: '/order?cat=cookies',
    img: '/assets/products/adc-special.jpg',
    icon: <Cookie size={18} />,
    tint: 'linear-gradient(135deg,#FDEBC2,#FAD98A)',
  },
  {
    key: 'tins',
    label: 'Gift Tins',
    desc: 'Premium keepsake tins of filled cookies — ribbon-wrapped and ready to gift.',
    cta: 'Shop Gift Tins',
    href: '/order?cat=tins',
    img: '/assets/products/m-and-m.jpg',
    icon: <Gift size={18} />,
    tint: 'linear-gradient(135deg,#FDDCC2,#FAB988)',
  },
];

const CORPORATE: Category = {
  key: 'corporate',
  label: 'Corporate & Bulk Gifting',
  desc: 'Cookies for teams, clients and celebrations — branded boxes, bulk pricing and delivery, all coordinated for you.',
  cta: 'Enquire / Order in bulk',
  href: '/order?cat=corporate',
  img: '/assets/gallery/ADC1.jpeg',
  icon: <Briefcase size={18} />,
  tint: '',
};

const ctaBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: 'none', cursor: 'pointer',
  borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow-brand)',
};

const descClamp: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

/* --- A handful of cookie photos scattered at hand-picked (spread-out) spots, pushed deep
   into the background: very faint and blurred so they read as soft texture, never content.
   Fixed positions (no Math.random) keep SSR and client markup identical. --- */
const BG_SRCS = ['real-2', 'real-3', 'real-4', 'real-5', 'real-6', 'real-7'];
const BG_COOKIES = [
  { left: '6%',  top: '12%', size: 140, rot: -12 },
  { left: '89%', top: '7%',  size: 120, rot: 14 },
  { left: '20%', top: '40%', size: 100, rot: 8 },
  { left: '77%', top: '33%', size: 150, rot: -18 },
  { left: '3%',  top: '67%', size: 125, rot: 18 },
  { left: '95%', top: '58%', size: 110, rot: -10 },
  { left: '32%', top: '84%', size: 120, rot: 13 },
  { left: '66%', top: '89%', size: 135, rot: -15 },
  { left: '49%', top: '23%', size: 95,  rot: 6 },
];

function CookieBackdrop() {
  return (
    <div
      className="home-bg-cookies"
      aria-hidden
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 0.07, filter: 'blur(4px)' }}
    >
      {BG_COOKIES.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: c.left, top: c.top, width: c.size, height: c.size,
            backgroundImage: `url('/assets/bg-cookies/${BG_SRCS[i % BG_SRCS.length]}.png')`,
            backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            transform: `translate(-50%,-50%) rotate(${c.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function CategoryCard({ c, onGo, priority }: { c: Category; onGo: (href: string) => void; priority?: boolean }) {
  return (
    <button
      onClick={() => onGo(c.href)}
      className="home-cat-card"
      style={{
        textAlign: 'left', border: '1px solid var(--border-default)', cursor: 'pointer', padding: 0,
        background: 'var(--surface-card)', borderRadius: 'var(--radius-card)', overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)', transition: 'transform .25s var(--ease-out), box-shadow .25s var(--ease-out)',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ position: 'relative', width: '100%', height: 'clamp(124px,14vw,176px)', background: c.tint }}>
        <Image src={c.img} alt={c.label} fill priority={priority} sizes="(max-width:760px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
      </div>
      <div style={{ padding: 'clamp(13px,1.5vw,20px)', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}>{c.icon}</span>
          <h3 style={{ font: 'var(--weight-extra) clamp(1.2rem,1rem + .7vw,1.55rem)/1 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.02em' }}>{c.label}</h3>
        </div>
        <p style={{ color: 'var(--text-body)', lineHeight: 1.5, margin: 0, fontSize: 'var(--text-sm)', ...descClamp }}>{c.desc}</p>
        <span style={{ ...ctaBtn, marginTop: 'auto', alignSelf: 'flex-start' }}>{c.cta} <ArrowRight size={16} /></span>
      </div>
    </button>
  );
}

export default function HomeHero({ onMenuOpen }: HomeHeroProps) {
  const router = useRouter();
  const go = (href: string) => router.push(href);

  return (
    <header style={{ position: 'relative', overflow: 'hidden' }}>
      <CookieBackdrop />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar — big logo (left) · single menu button (right; opens drawer with nav + login) */}
        <div className="home-topbar" style={{
          maxWidth: 1320, margin: '0 auto', padding: 'clamp(10px,1.4vw,18px) var(--gutter)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/assets/adc-logo.png"
              width={232}
              height={168}
              alt="a dough cookie"
              priority
              style={{ height: 'clamp(110px,18vw,260px)', width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </a>

          <button
            onClick={onMenuOpen}
            aria-label="Open menu"
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 22px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-xs)' }}
          >
            <Menu size={22} /> <span className="home-topbar-menu-label">Menu</span>
          </button>
        </div>

        {/* Compact hero band */}
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(4px,1vw,14px) var(--gutter) clamp(14px,2vw,22px)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Aroma of Freshness</p>
          <h1 style={{ font: '900 clamp(1.6rem,1.2rem + 2.4vw,2.9rem)/1 var(--font-display)', letterSpacing: '-.03em', color: 'var(--text-strong)', margin: '0 0 10px', textWrap: 'balance' }}>
            Fresh-baked cookies, delivered warm.
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.5, maxWidth: 520, margin: '0 auto', fontWeight: 500 }}>
            Pick what you&apos;re craving — cookies, gift tins or bulk gifting — and order in a tap.
          </p>
        </section>

        {/* Category entry points — Cookies & Tins first… */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--gutter) clamp(14px,1.8vw,22px)' }}>
          <div className="home-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'clamp(14px,1.8vw,22px)' }}>
            {CATEGORIES.map((c, i) => <CategoryCard key={c.key} c={c} onGo={go} priority={i === 0} />)}
          </div>
        </section>

        {/* …then Corporate / bulk gifting just below */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--gutter) clamp(36px,5vw,64px)' }}>
          <button
            onClick={() => go(CORPORATE.href)}
            className="home-corp"
            style={{
              position: 'relative', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 0,
              borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', minHeight: 168,
              display: 'block',
            }}
          >
            <Image src={CORPORATE.img} alt="" fill sizes="100vw" style={{ objectFit: 'cover' }} />
            <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(20,12,4,.92) 0%,rgba(20,12,4,.78) 55%,rgba(20,12,4,.64) 100%)' }} />
            <div className="home-corp-body" style={{ position: 'relative', padding: 'clamp(20px,3vw,38px)', maxWidth: 600, color: '#fff', textShadow: '0 1px 14px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(6px)', color: '#fff', display: 'grid', placeItems: 'center' }}>{CORPORATE.icon}</span>
                <h2 style={{ font: '900 clamp(1.4rem,1.1rem + 1.4vw,2.1rem)/1 var(--font-display)', color: '#fff', margin: 0, letterSpacing: '-.02em' }}>{CORPORATE.label}</h2>
              </div>
              <p style={{ color: 'rgba(255,245,230,.88)', lineHeight: 1.5, margin: '0 0 16px', fontSize: 'var(--text-base)', maxWidth: 480 }}>{CORPORATE.desc}</p>
              <span style={ctaBtn}>{CORPORATE.cta} <ArrowRight size={16} /></span>
            </div>
          </button>
        </section>
      </div>
    </header>
  );
}
