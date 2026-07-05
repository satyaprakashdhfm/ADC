'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, User, Cookie, Gift, Briefcase, ArrowRight, ShoppingBag, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { getProducts, type Product } from '@/lib/api';
import { STORES } from '@/lib/stores';

interface HomeHeroProps {
  onMenuOpen: () => void;
  onLoginOpen: () => void;
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
    img: '/assets/home-cookies.png',
    icon: <Cookie size={18} />,
    tint: 'linear-gradient(135deg,#FDEBC2,#FAD98A)',
  },
  {
    key: 'tins',
    label: 'Cookie Tins',
    desc: 'Premium keepsake tins of filled cookies — ribbon-wrapped and ready to gift.',
    cta: 'Shop Cookie Tins',
    href: '/order?cat=tins',
    img: '/assets/home-tins.png',
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
interface NavLink { label: string; href: string; menuKey?: 'cookies' | 'tins' | 'locations' | 'partner' }
const NAV_DESKTOP: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Buy Cookies', href: '/order?cat=cookies', menuKey: 'cookies' },
  { label: 'Cookie Tins', href: '/order?cat=tins', menuKey: 'tins' },
  { label: 'Locations', href: '/locations', menuKey: 'locations' },
  { label: 'Partner with us', href: '/franchise', menuKey: 'partner' },
  { label: 'About Us', href: '/about' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Contact', href: '/contact' },
];

// A desktop nav link that reveals a dropdown on hover when it has menu items.
function NavItem({ item, menu }: { item: NavLink; menu?: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const hasMenu = !!menu && menu.length > 0;
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
      <a href={item.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-strong)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color .18s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-strong)')}>
        {item.label}{hasMenu && <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
      </a>
      {hasMenu && open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, paddingTop: 8, minWidth: 220, zIndex: 60 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-lg)', padding: 8, maxHeight: 360, overflowY: 'auto' }}>
            {menu!.map(m => (
              <a key={m.label} href={m.href} style={{ display: 'block', padding: '8px 12px', borderRadius: 8, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-body)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--amber-50)'; e.currentTarget.style.color = 'var(--brand-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; }}
              >{m.label}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
        background: '#FFF4DE', borderRadius: 'var(--radius-card)', overflow: 'hidden',
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

export default function HomeHero({ onMenuOpen, onLoginOpen }: HomeHeroProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { count } = useCart();
  const go = (href: string) => router.push(href);
  // Nav dropdown data: cookie/tin products (fetched) and store locations.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { getProducts().then(ps => setProducts(ps || [])).catch(() => {}); }, []);
  const toMenu = (cat: 'COOKIES' | 'TINS') => products.filter(p => p.category === cat && p.isAvailable).map(p => ({ label: p.name, href: `/order?q=${encodeURIComponent(p.name)}` }));
  const menuFor = (key?: NavLink['menuKey']) =>
    key === 'cookies' ? toMenu('COOKIES')
      : key === 'tins' ? toMenu('TINS')
        : key === 'locations' ? STORES.map(s => ({ label: `${s.city} — ${s.name}`, href: `/order?store=${encodeURIComponent(s.city.toLowerCase())}` }))
          : key === 'partner' ? [{ label: 'Corporate & Bulk Order', href: '/order?cat=corporate' }, { label: 'Franchise Enquiry', href: '/franchise' }]
            : undefined;
  // Account icon → straight to the centered login modal (or account page if already signed in).
  const accountClick = () => { if (user) router.push(user.role === 'ADMIN' ? '/admin' : '/account'); else onLoginOpen(); };
  // Home search → the order page, filtered (OrderingApp reads ?q= and maps category words).
  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') || '').trim();
    router.push(q ? `/order?q=${encodeURIComponent(q)}` : '/order');
  };
  // Cart bag with live count — same ShoppingBag icon the ordering app uses, for consistency.
  const cartButton = (
    <button onClick={() => router.push('/checkout')} aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`} style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)', flex: 'none' }}>
      <ShoppingBag size={21} />
      {count > 0 && (
        <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--gradient-warm)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>
      )}
    </button>
  );

  return (
    <>
      {/* Sticky header — logo · search · cart · account + nav links; stays pinned while scrolling.
          The announcement/promo bar above it scrolls away (it's rendered separately, above). */}
      <div className="home-sticky-header" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)' }}>
        {/* Desktop header — Row 1: logo · search · cart · account. Row 2: nav links.
            Hidden on mobile via CSS (mobile keeps the compact bar below). */}
        <nav className="home-nav--desktop" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ maxWidth: 1680, margin: '0 auto', padding: '6px var(--gutter)', display: 'flex', alignItems: 'center', gap: 'clamp(16px,2vw,32px)' }}>
            <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
              <Image src="/assets/adc-logo.png" width={310} height={224} alt="a dough cookie" priority style={{ height: 168, width: 'auto', objectFit: 'contain', display: 'block' }} />
            </a>
            <form onSubmit={onSearch} role="search" style={{ flex: 1, maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, background: '#FFF4DF', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '6px 6px 6px 18px', boxShadow: 'var(--shadow-xs)' }}>
              <Search size={18} color="var(--text-muted)" style={{ flex: 'none' }} />
              <input name="q" placeholder="Search cookies, gift tins…" aria-label="Search products" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)' }} />
              <button type="submit" style={{ ...ctaBtn, flex: 'none', padding: '9px 18px' }}>Search</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              {cartButton}
              <button onClick={accountClick} aria-label={user ? 'My account' : 'Log in'} style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}><User size={21} /></button>
            </div>
          </div>
          <div>
            <div style={{ maxWidth: 1680, margin: '0 auto', padding: '2px var(--gutter) 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,2.4vw,40px)', flexWrap: 'wrap' }}>
              {NAV_DESKTOP.map(n => (
                <NavItem key={n.label} item={n} menu={menuFor(n.menuKey)} />
              ))}
            </div>
          </div>
        </nav>

        {/* Top bar (mobile) — compact logo + menu row, with the search bar in the header below it */}
        <div className="home-topbar home-topbar--mobile" style={{
          maxWidth: 1680, margin: '0 auto', padding: 'clamp(8px,1.6vw,12px) var(--gutter) 10px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center' }}>
              <Image
                src="/assets/adc-logo.png"
                width={232}
                height={168}
                alt="a dough cookie"
                priority
                style={{ height: 'clamp(52px,13vw,80px)', width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </a>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {cartButton}
              <button
                onClick={onMenuOpen}
                aria-label="Open menu"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-xs)' }}
              >
                <Menu size={20} /> <span className="home-topbar-menu-label">Menu</span>
              </button>
            </div>
          </div>

          {/* Search — in the header on mobile (was previously in the hero body) */}
          <form onSubmit={onSearch} role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF4DF', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '5px 5px 5px 14px', boxShadow: 'var(--shadow-xs)' }}>
            <Search size={17} color="var(--text-muted)" style={{ flex: 'none' }} />
            <input name="q" placeholder="Search cookies, gift tins…" aria-label="Search products" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }} />
            <button type="submit" style={{ ...ctaBtn, flex: 'none', padding: '8px 14px' }}>Search</button>
          </form>
        </div>
      </div>

      {/* Hero content (below the sticky header; overflow-hidden keeps decorations clipped) */}
      <header style={{ position: 'relative', overflow: 'hidden', background: '#FFCD90' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Compact hero band */}
        <section style={{ maxWidth: 1680, margin: '0 auto', padding: 'clamp(8px,1.6vw,20px) var(--gutter) clamp(14px,2vw,22px)', textAlign: 'center' }}>
          <h1 style={{ font: '900 clamp(1.6rem,1.2rem + 2.4vw,2.9rem)/1 var(--font-display)', letterSpacing: '-.03em', color: 'var(--text-strong)', margin: '0 0 10px', textWrap: 'balance' }}>
            Fresh-baked cookies, delivered warm.
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', lineHeight: 1.5, maxWidth: 520, margin: '0 auto', fontWeight: 500 }}>
            Pick what you&apos;re craving — cookies, gift tins or bulk gifting — and order in a tap.
          </p>
        </section>

        {/* Category entry points — Cookies & Tins first… */}
        <section style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter) clamp(14px,1.8vw,22px)' }}>
          <div className="home-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'clamp(14px,1.8vw,22px)' }}>
            {CATEGORIES.map((c, i) => <CategoryCard key={c.key} c={c} onGo={go} priority={i === 0} />)}
          </div>
        </section>

        {/* …then Corporate / bulk gifting just below */}
        <section style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter) clamp(36px,5vw,64px)' }}>
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
    </>
  );
}
