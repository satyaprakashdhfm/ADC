'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, User, Search, ShoppingBag, ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { getProducts, firstImage, type Product } from '@/lib/api';
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

interface NavLink { label: string; href: string; menuKey?: 'cookies' | 'tins' | 'locations' }
// Corporate and Partner-with-us are now their own top-level links (each its own page), not a
// combined "Partner with us" dropdown — the client wants both visible directly in the navbar.
export const NAV_DESKTOP: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Buy Cookies', href: '/order?cat=cookies', menuKey: 'cookies' },
  { label: 'Cookie Tins', href: '/order?cat=tins', menuKey: 'tins' },
  { label: 'Locations', href: '/locations', menuKey: 'locations' },
  { label: 'Corporate', href: '/corporate' },
  { label: 'Partner with us', href: '/franchise' },
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

// Search bar with a live "products matching what you're typing" dropdown — customers browsing a
// brand-new site don't know our menu names yet, so surfacing matches as they type (not just after
// they hit Enter) is what actually helps them find something.
function SearchBox({ products, compact, autoFocus, onNavigate }: { products: Product[]; compact?: boolean; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const term = query.trim();
  const suggestions = term.length
    ? products.filter(p => p.isAvailable && p.name.toLowerCase().includes(term.toLowerCase())).slice(0, 6)
    : [];

  const go = (q: string) => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    onNavigate?.();
    router.push(q ? `/order?q=${encodeURIComponent(q)}` : '/order');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); go(suggestions[activeIndex].name); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: compact ? undefined : 1, width: compact ? '100%' : undefined, maxWidth: compact ? undefined : 640, margin: compact ? undefined : '0 auto' }}>
      <form onSubmit={e => { e.preventDefault(); go(query.trim()); }} role="search" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream-bg)', border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-pill)', padding: compact ? '5px 5px 5px 14px' : '6px 6px 6px 18px', boxShadow: 'var(--shadow-xs)' }}>
        <Search size={compact ? 17 : 18} color="var(--text-muted)" style={{ flex: 'none' }} />
        <input
          autoFocus={autoFocus}
          name="q"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search cookies, gift tins…"
          aria-label="Search products"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: compact ? 'var(--text-sm)' : 'var(--text-base)', color: 'var(--text-strong)' }}
        />
        <button type="submit" style={{ ...ctaBtn, flex: 'none', padding: compact ? '8px 14px' : '9px 18px' }}>Search</button>
      </form>
      {open && term.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 70 }}>
          {suggestions.length ? suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => go(p.name)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border-default)', background: activeIndex === i ? 'var(--amber-50)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <Image src={firstImage(p.images)} alt="" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flex: 'none', textTransform: 'uppercase', letterSpacing: '.03em' }}>{p.category === 'TINS' ? 'Gift Tin' : 'Cookie'}</span>
            </button>
          )) : (
            <div style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No products found for &ldquo;{term}&rdquo;</div>
          )}
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
  const [searchExpanded, setSearchExpanded] = useState(false); // desktop: search icon expands to a centered search
  // Header is always visible at the top of the page, hides as you scroll DOWN, and reappears the
  // moment you scroll UP — the standard "peek" header. (Same behaviour on every page now.)
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 90) setHidden(false);            // always show near the top
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
  // Cookies deep-link to that cookie (floats it to the top); tins all jump to the Cookie Tins section.
  const toMenu = (cat: 'COOKIES' | 'TINS') => products.filter(p => p.category === cat && p.isAvailable).map(p => ({ label: p.name, href: cat === 'TINS' ? '/order?cat=tins' : `/order?q=${encodeURIComponent(p.name)}` }));
  const menuFor = (key?: NavLink['menuKey']) =>
    key === 'cookies' ? toMenu('COOKIES')
      : key === 'tins' ? toMenu('TINS')
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
      <div className="home-sticky-header" style={{ position: revealOnScroll ? 'fixed' : 'sticky', top: revealOnScroll ? 'var(--ribbon-h)' : 0, left: 0, right: 0, zIndex: 50, background: 'var(--navbar-bg)', boxShadow: 'var(--shadow-md)', borderBottom: '1px solid var(--white-16)', transform: hidden ? 'translateY(-130%)' : 'translateY(0)', transition: 'transform .35s var(--ease-out)' }}>
        {/* Desktop — Row 1: search (left) · logo (centre) · cart + account (right). Row 2: nav links.
            Clicking search swaps row 1 for a centred search field (Dohful-style). */}
        <nav className="home-nav--desktop">
          <div style={{ maxWidth: 1680, margin: '0 auto', padding: '10px var(--gutter) 6px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16, minHeight: 92 }}>
            {searchExpanded ? (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ flex: 1, maxWidth: 640 }}><SearchBox products={products} autoFocus onNavigate={() => setSearchExpanded(false)} /></div>
                <button onClick={() => setSearchExpanded(false)} aria-label="Close search" style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }}><X size={20} /></button>
              </div>
            ) : (
              <>
                <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setSearchExpanded(true)} aria-label="Search" style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Search size={20} /></button>
                </div>
                <a href="/" aria-label="a dough cookie home" style={{ justifySelf: 'center', display: 'flex', alignItems: 'center' }}>
                  <Image src="/assets/adc-logo.png" width={310} height={224} alt="a dough cookie" priority style={{ height: 78, width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }} />
                </a>
                <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Location sits to the left of the account icon (per request). */}
                  <LocationPill />
                  <button onClick={accountClick} className="nav-round-btn" aria-label={user ? 'My account' : 'Log in'} style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)' }}><User size={20} /></button>
                  <button onClick={() => router.push('/checkout')} className="nav-round-btn" aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`} style={{ position: 'relative', width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)' }}>
                    <ShoppingBag size={20} />
                    {count > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--white)', color: 'var(--orange-600)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>}
                  </button>
                </div>
              </>
            )}
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
          {/* Search + location-pin (left) · logo (centre) · cart + menu (right). Location is just a
              small pin here — no full-width row below — so the mobile header stays short. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
            <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setSearchOpen(v => !v)}
                className="nav-round-btn"
                aria-label={searchOpen ? 'Close search' : 'Search'}
                aria-expanded={searchOpen}
                style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: searchOpen ? 'var(--white-16)' : 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}
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

            <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
              <button onClick={() => router.push('/checkout')} className="nav-round-btn" aria-label={`View cart, ${count} item${count === 1 ? '' : 's'}`} style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}>
                <ShoppingBag size={20} />
                {count > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 10, background: 'var(--white)', color: 'var(--orange-600)', fontSize: 11, fontWeight: 900, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{count}</span>}
              </button>
              <button
                onClick={() => setMenuOpen(true)}
                className="nav-round-btn"
                aria-label="Open menu"
                style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px solid var(--white-16)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--white)', flex: 'none' }}
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
