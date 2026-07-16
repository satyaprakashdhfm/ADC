'use client';
import Image from 'next/image';
import { X, Home, MapPin, Briefcase, Info, Image as ImageIcon, Mail, ShoppingBag, ChevronRight, LogOut, User } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// Mirrors the desktop navbar, minus the product menus (Buy Cookies / Cookie Tins) —
// those live behind the search + Order CTA on mobile.
const NAV_LINKS = [
  { label: 'Home', icon: <Home size={16} />, href: '/' },
  { label: 'Locations', icon: <MapPin size={16} />, href: '/locations' },
  { label: 'Partner with us', icon: <Briefcase size={16} />, href: '/franchise' },
  { label: 'About Us', icon: <Info size={16} />, href: '/about' },
  { label: 'Gallery', icon: <ImageIcon size={16} />, href: '/gallery' },
  { label: 'Contact', icon: <Mail size={16} />, href: '/contact' },
];

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onLoginOpen: () => void;
}

export default function MenuDrawer({ open, onClose, onLoginOpen }: MenuDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'var(--espresso-45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 14, right: 14, bottom: 14, zIndex: 71,
        width: 'min(300px,calc(100vw - 36px))',
        background: 'var(--surface-page)',
        borderRadius: 22,
        boxShadow: '0 32px 80px var(--black-28)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
        transition: 'transform .4s cubic-bezier(.34,1.2,.64,1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 10px' }}>
          <Image src="/assets/adc-logo.png" height={38} width={64} alt="a dough cookie" style={{ objectFit: 'contain' }} />
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--surface-sunken)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <X size={16} color="var(--text-strong)" />
          </button>
        </div>

        {/* Account / Login CTA — reflects the shared auth state */}
        {user ? (
          <div style={{ margin: '0 14px 12px', padding: '13px 15px', borderRadius: 16, background: 'linear-gradient(135deg,var(--amber-100),var(--amber-wash))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-sm)', flex: 'none' }}>{user.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: 'var(--weight-bold) var(--text-sm)/1.2 var(--font-display)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => { onClose(); router.push(user.role === 'ADMIN' ? '/admin' : '/account'); }}
              style={{ width: '100%', padding: '9px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 8 }}
            ><User size={15} /> My Account</button>
            <button
              onClick={() => logout()}
              style={{ width: '100%', padding: '8px 0', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            ><LogOut size={15} /> Log out</button>
          </div>
        ) : (
          <div style={{ margin: '0 14px 12px', padding: '15px', borderRadius: 16, background: 'linear-gradient(135deg,var(--amber-100),var(--amber-wash))' }}>
            <div style={{ font: 'var(--weight-bold) var(--text-sm)/1.2 var(--font-display)', color: 'var(--text-strong)', marginBottom: 3 }}>Welcome back!</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 11 }}>Log in to track orders &amp; save favourites.</div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                onClick={() => { onClose(); onLoginOpen(); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}
              >Log in</button>
              <button
                onClick={() => { onClose(); onLoginOpen(); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}
              >Sign up</button>
            </div>
          </div>
        )}

        {/* Nav links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          {NAV_LINKS.map(lk => (
            <a
              key={lk.label}
              href={lk.href}
              onClick={e => {
                // Already on this page? Don't reload — just glide back to the top.
                if (lk.href === pathname) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                onClose();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 13, textDecoration: 'none', color: 'var(--text-strong)', transition: 'background .18s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--amber-50)', display: 'grid', placeItems: 'center', flex: 'none', color: 'var(--brand-secondary)' }}>
                {lk.icon}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{lk.label}</span>
              <span style={{ marginLeft: 'auto' }}><ChevronRight size={16} color="var(--text-subtle)" /></span>
            </a>
          ))}
        </div>

        {/* Order CTA */}
        <div style={{ padding: '10px 14px 16px' }}>
          <button
            onClick={() => { onClose(); router.push('/order'); }}
            style={{
              width: '100%', padding: '13px', borderRadius: 'var(--radius-pill)', border: 'none',
              background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer',
              boxShadow: '0 10px 24px var(--orange-500-35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <ShoppingBag size={16} /> Order Fresh Cookies
          </button>
        </div>
      </div>
    </>
  );
}
