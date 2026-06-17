'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, User, Cookie, Gift, Briefcase, ArrowRight } from 'lucide-react';

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

// Desktop-only top-nav links (the mobile bar keeps the logo + hamburger, untouched).
const NAV_DESKTOP = [
  { label: 'Cookies', href: '/order?cat=cookies' },
  { label: 'Gift Tins', href: '/order?cat=tins' },
  { label: 'Corporate', href: '/order?cat=corporate' },
  { label: 'Our Stores', href: '#about' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Contact', href: '/contact' },
];

const ctaBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: 'none', cursor: 'pointer',
  borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow-brand)',
};

const descClamp: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};

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
      <div style={{ position: 'relative', width: '100%', height: 'clamp(130px,15vw,200px)', background: c.tint }}>
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
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Desktop top nav — fuller menu bar; hidden on mobile via CSS (mobile keeps the bar below) */}
        <nav className="home-nav--desktop" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '14px var(--gutter)', display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
              <Image src="/assets/adc-logo.png" width={232} height={168} alt="a dough cookie" priority style={{ height: 88, width: 'auto', objectFit: 'contain', display: 'block' }} />
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px,2.2vw,34px)', margin: '0 auto' }}>
              {NAV_DESKTOP.map(n => (
                <a
                  key={n.label}
                  href={n.href}
                  style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-strong)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color .18s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-strong)')}
                >{n.label}</a>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <button onClick={onMenuOpen} aria-label="Account &amp; menu" style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}><User size={20} /></button>
              <a href="/order" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', textDecoration: 'none', boxShadow: 'var(--shadow-brand)', whiteSpace: 'nowrap' }}>Order Now</a>
            </div>
          </div>
        </nav>

        {/* Top bar (mobile) — big logo (left) · single menu button (right; opens drawer with nav + login) */}
        <div className="home-topbar home-topbar--mobile" style={{
          maxWidth: 1180, margin: '0 auto', padding: 'clamp(10px,1.4vw,18px) var(--gutter)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/assets/adc-logo.png"
              width={232}
              height={168}
              alt="a dough cookie"
              priority
              style={{ height: 'clamp(124px,20vw,290px)', width: 'auto', objectFit: 'contain', display: 'block' }}
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
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(8px,1.6vw,20px) var(--gutter) clamp(14px,2vw,22px)', textAlign: 'center' }}>
          <h1 style={{ font: '900 clamp(1.6rem,1.2rem + 2.4vw,2.9rem)/1 var(--font-display)', letterSpacing: '-.03em', color: 'var(--text-strong)', margin: '0 0 10px', textWrap: 'balance' }}>
            Fresh-baked cookies, delivered warm.
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.5, maxWidth: 520, margin: '0 auto', fontWeight: 500 }}>
            Pick what you&apos;re craving — cookies, gift tins or bulk gifting — and order in a tap.
          </p>
        </section>

        {/* Category entry points — Cookies & Tins first… */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 var(--gutter) clamp(14px,1.8vw,22px)' }}>
          <div className="home-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'clamp(14px,1.8vw,22px)' }}>
            {CATEGORIES.map((c, i) => <CategoryCard key={c.key} c={c} onGo={go} priority={i === 0} />)}
          </div>
        </section>

        {/* …then Corporate / bulk gifting just below */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 var(--gutter) clamp(36px,5vw,64px)' }}>
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
