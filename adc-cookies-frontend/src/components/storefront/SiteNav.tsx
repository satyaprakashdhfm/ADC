'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, User, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { getProducts, type Product } from '@/lib/api';
import { STORES } from '@/lib/stores';
import { navLinksFor, type NavKey } from '@/lib/navLinks';
import { NavItem } from './nav/NavItem';
import { SearchBox } from './nav/SearchBox';
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

// Desktop navbar shows every link. The labels/hrefs come from lib/navLinks so a rename lands here,
// in the mobile drawer and on the order page at once; the dropdown CONTENTS below stay local
// because each surface fills them from different data.
const DESKTOP_KEYS = ['home', 'cookies', 'tins', 'locations', 'franchise', 'about', 'contact', 'orders'] as const;

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
  useEffect(() => {
    try { const c = localStorage.getItem('adc_products_cache'); if (c) { const arr = JSON.parse(c); if (Array.isArray(arr) && arr.length) setProducts(arr); } } catch { /* ignore */ }
    getProducts().then(ps => setProducts(ps || [])).catch(() => {});
  }, []);
  // Cookies deep-link to that cookie (floats it to the top); tins all jump to the Cookie Tins section.
  const toMenu = (cat: 'COOKIES' | 'TINS') => products.filter(p => p.category === cat && p.isAvailable).map(p => ({ label: p.name, href: cat === 'TINS' ? '/order?cat=tins' : `/order?q=${encodeURIComponent(p.name)}` }));
  const menuFor = (key: NavKey) =>
    key === 'cookies' ? toMenu('COOKIES')
      : key === 'tins' ? toMenu('TINS')
        : key === 'locations' ? STORES.map(s => ({ label: `${s.city} — ${s.name}`, href: `/locations#store-${s.pincode}` }))
          : key === 'franchise' ? [{ label: 'Corporate & Bulk Order', href: '/corporate' }, { label: 'Franchise Enquiry', href: '/franchise' }]
            : undefined;
  // Account icon → login modal (or account/admin page if already signed in).
  const accountClick = () => { if (user) router.push(user.role === 'ADMIN' ? '/admin' : '/account'); else setLoginOpen(true); };
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
            <SearchBox products={products} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <LocationPill />
              {cartButton}
              <button onClick={accountClick} className="nav-round-btn" aria-label={user ? 'My account' : 'Log in'} style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text-strong)' }}><User size={20} /></button>
            </div>
          </div>
          <div>
            <div style={{ maxWidth: 1680, margin: '0 auto', padding: '2px var(--gutter) 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(16px,2.4vw,40px)', flexWrap: 'wrap' }}>
              {navLinksFor(DESKTOP_KEYS).map(n => (
                <NavItem key={n.key} item={n} menu={menuFor(n.key)} />
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
            <SearchBox products={products} compact autoFocus onNavigate={() => setSearchOpen(false)} />
          )}
        </div>
      </div>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLoginOpen={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
