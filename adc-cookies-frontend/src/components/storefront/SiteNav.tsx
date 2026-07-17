'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, User, Search, ShoppingBag, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { getProducts, type Product } from '@/lib/api';
import { STORES } from '@/lib/stores';
import MenuDrawer from './MenuDrawer';
import LoginModal from '@/components/ordering/LoginModal';
import { LocationPill } from './LocationPicker';

/**
 * Shared sticky site header — the SAME navbar on every page (home + inner pages).
 * Desktop shows the full logo · search · cart · account row plus the nav-links row;
 * mobile shows the compact logo + cart + hamburger (which opens the MenuDrawer).
 * Self-contained: owns its own menu drawer + login modal so any page can just drop
 * in <SiteNav /> with no wiring.
 */

interface NavLink { label: string; href: string; menuKey?: 'cookies' | 'tins' | 'locations' | 'partner' }
const NAV_DESKTOP: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Buy Cookies', href: '/order?cat=cookies', menuKey: 'cookies' },
  { label: 'Cookie Tins', href: '/order?cat=tins', menuKey: 'tins' },
  { label: 'Locations', href: '/locations', menuKey: 'locations' },
  { label: 'Partner with us', href: '/franchise', menuKey: 'partner' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Orders', href: '/account' },
];

const ctaBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', border: 'none', cursor: 'pointer',
  borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)',
  fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap',
  boxShadow: 'var(--shadow-brand)',
};

// A desktop nav link that reveals a dropdown on hover when it has menu items.
function NavItem({ item, menu }: { item: NavLink; menu?: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const hasMenu = !!menu && menu.length > 0;
  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative' }}>
      <a href={item.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--white)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color .18s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-900)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--white)')}>
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

export default function SiteNav({ revealOnScroll = false }: { revealOnScroll?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // mobile: search is an icon that expands, to keep the header short
  // On the home hero, the bar hides until the first scroll, then slides in.
  const [revealed, setRevealed] = useState(!revealOnScroll);
  useEffect(() => {
    if (!revealOnScroll) return;
    const onScroll = () => setRevealed(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [revealOnScroll]);
  // Nav dropdown data: cookie/tin products (fetched) and store locations.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { getProducts().then(ps => setProducts(ps || [])).catch(() => {}); }, []);
  // Cookies deep-link to that cookie (floats it to the top); tins all jump to the Cookie Tins section.
  const toMenu = (cat: 'COOKIES' | 'TINS') => products.filter(p => p.category === cat && p.isAvailable).map(p => ({ label: p.name, href: cat === 'TINS' ? '/order?cat=tins' : `/order?q=${encodeURIComponent(p.name)}` }));
  const menuFor = (key?: NavLink['menuKey']) =>
    key === 'cookies' ? toMenu('COOKIES')
      : key === 'tins' ? toMenu('TINS')
        : key === 'locations' ? STORES.map(s => ({ label: `${s.city} — ${s.name}`, href: `/order?store=${encodeURIComponent(s.city.toLowerCase())}` }))
          : key === 'partner' ? [{ label: 'Corporate & Bulk Order', href: '/contact#get-in-touch' }, { label: 'Franchise Enquiry', href: '/franchise' }]
            : undefined;
  // Account icon → login modal (or account/admin page if already signed in).
  const accountClick = () => { if (user) router.push(user.role === 'ADMIN' ? '/admin' : '/account'); else setLoginOpen(true); };
  // Search → the order page, filtered (OrderingApp reads ?q= and maps category words).
  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') || '').trim();
    router.push(q ? `/order?q=${encodeURIComponent(q)}` : '/order');
  };
  const cartButton = (
    <button onClick={() => router.push('/checkout')} className="nav-round-btn" aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`} style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)', flex: 'none' }}>
      <ShoppingBag size={20} />
      {count > 0 && (
        <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--gradient-warm)', color: 'var(--white)', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>
      )}
    </button>
  );

  return (
    <>
      {/* Sticky header — a distinct warm band (vanilla) so it stands off the page behind it. */}
      <div className="home-sticky-header" style={{ position: revealOnScroll ? 'fixed' : 'sticky', top: 0, left: 0, right: 0, zIndex: 50, background: 'var(--navbar-bg)', boxShadow: 'var(--shadow-md)', borderBottom: '1px solid var(--white-16)', transform: revealed ? 'translateY(0)' : 'translateY(-110%)', transition: 'transform .35s var(--ease-out)' }}>
        {/* Desktop — Row 1: logo · search · cart · account. Row 2: nav links. */}
        <nav className="home-nav--desktop">
          <div style={{ maxWidth: 1680, margin: '0 auto', padding: '10px var(--gutter) 6px', display: 'flex', alignItems: 'center', gap: 'clamp(16px,2vw,32px)' }}>
            <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
              <Image src="/assets/adc-logo.png" width={310} height={224} alt="a dough cookie" priority style={{ height: 84, width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }} />
            </a>
            <form onSubmit={onSearch} role="search" style={{ flex: 1, maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream-bg)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '6px 6px 6px 18px', boxShadow: 'var(--shadow-xs)' }}>
              <Search size={18} color="var(--text-muted)" style={{ flex: 'none' }} />
              <input name="q" placeholder="Search cookies, gift tins…" aria-label="Search products" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-strong)' }} />
              <button type="submit" style={{ ...ctaBtn, flex: 'none', padding: '9px 18px' }}>Search</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <LocationPill />
              {cartButton}
              <button onClick={accountClick} className="nav-round-btn" aria-label={user ? 'My account' : 'Log in'} style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}><User size={20} /></button>
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

        {/* Mobile — compact logo + cart + menu row, with the search bar below it */}
        <div className="home-topbar home-topbar--mobile" style={{
          maxWidth: 1680, margin: '0 auto', padding: 'clamp(8px,1.6vw,12px) var(--gutter) 10px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
              <Image
                src="/assets/adc-logo.png"
                width={232}
                height={168}
                alt="a dough cookie"
                priority
                style={{ height: 'clamp(46px,11vw,66px)', width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }}
              />
            </a>

            {/* location as a compact inline link, not a full-width row */}
            <LocationPill compact />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
              {/* Search is a compact icon that expands the bar — keeps the header short */}
              <button
                onClick={() => setSearchOpen(v => !v)}
                className="nav-round-btn"
                aria-label={searchOpen ? 'Close search' : 'Search'}
                aria-expanded={searchOpen}
                style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: searchOpen ? 'var(--amber-50)' : 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)', boxShadow: 'var(--shadow-xs)', flex: 'none' }}
              >
                <Search size={20} />
              </button>
              {cartButton}
              <button
                onClick={() => setMenuOpen(true)}
                className="nav-round-btn"
                aria-label="Open menu"
                style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)', boxShadow: 'var(--shadow-xs)', flex: 'none' }}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* Search bar only when the icon is tapped */}
          {searchOpen && (
            <form onSubmit={onSearch} role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream-bg)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: '5px 5px 5px 14px', boxShadow: 'var(--shadow-xs)' }}>
              <Search size={17} color="var(--text-muted)" style={{ flex: 'none' }} />
              <input autoFocus name="q" placeholder="Search cookies, gift tins…" aria-label="Search products" style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }} />
              <button type="submit" style={{ ...ctaBtn, flex: 'none', padding: '8px 14px' }}>Search</button>
            </form>
          )}
        </div>
      </div>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLoginOpen={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
