'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, User, Search, ShoppingCart, X, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { getProducts, type Product } from '@/lib/api';
import { STORES } from '@/lib/stores';
import { navLinksFor, type NavKey } from '@/lib/navLinks';
import { RouteTrackIcon } from '@/components/icons/RouteTrackIcon';
import { NavItem } from './nav/NavItem';
import { MENU_SECTIONS } from '@/lib/categories';
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

// Desktop navbar shows every link. Labels/hrefs come from lib/navLinks so a rename lands here, in
// the mobile drawer and on the order page at once; the dropdown CONTENTS below stay local because
// each surface fills them from different data.
const DESKTOP_KEYS = ['home', 'menu', 'corporate', 'franchise', 'about', 'locations', 'contact', 'orders'] as const;

export default function SiteNav({ revealOnScroll = false }: { revealOnScroll?: boolean }) {
  /* Publish the bar's real height as --nav-h so the home hero can start exactly below it.
   *
   * The hero used to offset itself by --header-h, which is a hand-written estimate of the DESKTOP
   * header — ribbon plus the nav row plus the links row. On a phone there is no links row and the
   * rows are shorter, so that estimate overshot by a wide margin and left a cream band between the
   * navbar and the photograph. Measuring removes the guess, and a ResizeObserver keeps it right
   * when the bar rewraps (rotation, a long announcement, the search box expanding). */
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const router = useRouter();
  const { user } = useAuth();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // mobile: search is an icon that expands, to keep the header short
  const [searchExpanded, setSearchExpanded] = useState(false); // desktop: search icon expands to a centered search
  // Header is always visible at the top of the page, hides as you scroll DOWN, and reappears the
  // moment you scroll UP — the standard "peek" header. (Same behaviour on every page now.)
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    const onScroll = () => {
      const y = window.scrollY;
      // Reaching the bottom brings it back too: that's where people go looking for the nav again
      // (footer/checkout CTA), and a header that stayed tucked away there felt broken.
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 90;
      if (y < 90 || atBottom) setHidden(false); // always show near the top, and at the very end
      else if (y > lastY + 6) setHidden(true);  // scrolling down → tuck away
      else if (y < lastY - 6) setHidden(false); // scrolling up → reveal
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Close the expanded desktop search on Escape.
  useEffect(() => {
    if (!searchExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSearchExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchExpanded]);
  // Nav dropdown data: cookie/tin products (fetched) and store locations.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    try { const c = localStorage.getItem('adc_products_cache'); if (c) { const arr = JSON.parse(c); if (Array.isArray(arr) && arr.length) setProducts(arr); } } catch { /* ignore */ }
    getProducts().then(ps => setProducts(ps || [])).catch(() => {});
  }, []);
  /* The Menu dropdown lists the CATEGORIES, each jumping to its own section of the menu — not
     every product by name, which at forty-odd items would be a wall rather than a menu. A category
     with nothing in it is left out, so the navbar can never offer a section that isn't there. */
  const categoryMenu = () => MENU_SECTIONS
    .filter(sec => products.some(p => sec.codes.includes(p.category) && p.isAvailable))
    .map(sec => ({ label: sec.label, href: `/order?cat=${sec.codes[0].toLowerCase()}` }));
  const menuFor = (key: NavKey) =>
    key === 'menu' ? categoryMenu()
      : key === 'locations' ? STORES.map(s => ({ label: `${s.city} — ${s.name}`, href: `/locations#store-${s.pincode}` }))
          : undefined;
  // Account icon → login modal (or account/admin page if already signed in).
  const accountClick = () => { if (user) router.push(user.role === 'ADMIN' ? '/admin' : '/account'); else setLoginOpen(true); };

  return (
    <>
      {/* Sticky header — a distinct warm band (vanilla) so it stands off the page behind it. */}
      {/* On the home hero (revealOnScroll) the bar is fixed and offset down by the sticky
          announcement ribbon's height so it slides in just beneath it, not over it. Other pages
          have no ribbon, so the sticky bar sits flush at the top. */}
      <div ref={barRef} className="home-sticky-header" style={{ position: revealOnScroll ? 'fixed' : 'sticky', top: revealOnScroll ? 'var(--ribbon-h)' : 0, left: 0, right: 0, zIndex: 50, background: 'var(--navbar-bg)', boxShadow: 'var(--shadow-md)', borderBottom: '1px solid var(--white-16)', transform: hidden ? 'translateY(-130%)' : 'translateY(0)', transition: 'transform .35s var(--ease-out)' }}>
        {/* Desktop — Row 1: search (left) · logo (centre) · cart + account (right). Row 2: nav links.
            Clicking search swaps row 1 for a centred search field (Dohful-style). */}
        <nav className="home-nav--desktop">
          <div style={{ maxWidth: 1680, margin: '0 auto', padding: '10px var(--gutter) 6px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, minHeight: 92 }}>
            {searchExpanded ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ flex: 1, maxWidth: 640 }}><SearchBox products={products} autoFocus onNavigate={() => setSearchExpanded(false)} /></div>
                <button onClick={() => setSearchExpanded(false)} aria-label="Close search" style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><X size={20} /></button>
              </div>
            ) : (
              <>
                <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setSearchExpanded(true)} aria-label="Search" style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Search size={20} /></button>
                  {/* Our shops — kept distinct from "Deliver to", which is the customer's own address. */}
                  <Link href="/locations" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--white-16)', color: 'var(--white)', textDecoration: 'none', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}><Store size={17} /> Find a store</Link>
                </div>
                <a href="/" aria-label="a dough cookie home" style={{ justifySelf: 'center', display: 'flex', alignItems: 'center' }}>
                  <Image src="/assets/adc-logo.png" width={310} height={224} alt="a dough cookie" priority style={{ height: 78, width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }} />
                </a>
                <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Location sits to the left of the account icon (per request). */}
                  <LocationPill />
                  {/* Track Order — quick access to the account/orders page for delivery tracking. */}
                  <button onClick={() => router.push('/account#orders')} aria-label="Track your order" title="Track order" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 46, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}><RouteTrackIcon size={20} /> Track</button>
                  <button onClick={accountClick} className="nav-round-btn" aria-label={user ? 'My account' : 'Log in'} style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)' }}><User size={20} /></button>
                  <button onClick={() => router.push('/checkout')} className="nav-round-btn" aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`} style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)' }}>
                    <ShoppingCart size={20} />
                    {count > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--white)', color: 'var(--orange-600)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>}
                  </button>
                </div>
              </>
            )}
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
          {/* Search + location-pin (left) · logo (centre) · cart + menu (right). Location is just a
              small pin here — no full-width row below — so the mobile header stays short. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
            <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setSearchOpen(v => !v)}
                className="nav-round-btn"
                aria-label={searchOpen ? 'Close search' : 'Search'}
                aria-expanded={searchOpen}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: searchOpen ? 'var(--white-16)' : 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}
              >
                {searchOpen ? <X size={20} /> : <Search size={20} />}
              </button>
              <LocationPill iconOnly />
            </div>

            <a href="/" aria-label="a dough cookie home" style={{ justifySelf: 'center', display: 'flex', alignItems: 'center' }}>
              <Image
                src="/assets/adc-logo.png"
                width={232}
                height={168}
                alt="a dough cookie"
                priority
                style={{ height: 'clamp(44px,11vw,62px)', width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }}
              />
            </a>

            <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
              <button onClick={() => router.push('/account#orders')} className="nav-round-btn" aria-label="Track your order" title="Track order" style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}><RouteTrackIcon size={20} /></button>
              <button onClick={() => router.push('/checkout')} className="nav-round-btn" aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`} style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}>
                <ShoppingCart size={20} />
                {count > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 10, background: 'var(--white)', color: 'var(--orange-600)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>}
              </button>
              <button
                onClick={() => setMenuOpen(true)}
                className="nav-round-btn"
                aria-label="Open menu"
                style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* Search reveals below the top row when tapped (location is the pin icon above). */}
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
