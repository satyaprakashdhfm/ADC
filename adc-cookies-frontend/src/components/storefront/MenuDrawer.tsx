'use client';
import Image from 'next/image';
import { X, Info, Image as ImageIcon, BookOpen, Mail, ShoppingBag, ChevronRight, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV_LINKS = [
  { label: 'About Us', icon: <Info size={19} />, href: '/about' },
  { label: 'Gallery', icon: <ImageIcon size={19} />, href: '/gallery' },
  { label: 'Blog', icon: <BookOpen size={19} />, href: '/blogs' },
  { label: 'Contact Us', icon: <Mail size={19} />, href: '/contact' },
];

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onLoginOpen: () => void;
}

export default function MenuDrawer({ open, onClose, onLoginOpen }: MenuDrawerProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'rgba(20,12,4,.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 16, right: 16, bottom: 16, zIndex: 71,
        width: 'min(340px,calc(100vw - 40px))',
        background: 'var(--surface-page)',
        borderRadius: 28,
        boxShadow: '0 32px 80px rgba(0,0,0,.28)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
        transition: 'transform .4s cubic-bezier(.34,1.2,.64,1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 22px 16px' }}>
          <Image src="/assets/adc-logo.png" height={48} width={80} alt="a dough cookie" style={{ objectFit: 'contain' }} />
          <button
            onClick={onClose}
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--surface-sunken)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
          >
            <X size={18} color="var(--text-strong)" />
          </button>
        </div>

        {/* Account / Login CTA — reflects the shared auth state */}
        {user ? (
          <div style={{ margin: '0 16px 16px', padding: '18px 20px', borderRadius: 20, background: 'linear-gradient(135deg,var(--amber-100),#FDE8C4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, flex: 'none' }}>{user.initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => { onClose(); router.push(user.role === 'ADMIN' ? '/admin' : '/account'); }}
              style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}
            ><User size={16} /> My Account</button>
            <button
              onClick={() => logout()}
              style={{ width: '100%', padding: '11px 0', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            ><LogOut size={16} /> Log out</button>
          </div>
        ) : (
          <div style={{ margin: '0 16px 16px', padding: '20px', borderRadius: 20, background: 'linear-gradient(135deg,var(--amber-100),#FDE8C4)' }}>
            <div style={{ font: 'var(--weight-bold) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', marginBottom: 4 }}>Welcome back!</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 14 }}>Log in to track orders &amp; save favourites.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { onClose(); onLoginOpen(); }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}
              >Log in</button>
              <button
                onClick={() => { onClose(); onLoginOpen(); }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 'var(--radius-pill)', border: '2px solid var(--brand-secondary)', background: 'transparent', color: 'var(--brand-secondary)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', cursor: 'pointer' }}
              >Sign up</button>
            </div>
          </div>
        )}

        {/* Nav links */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
          {NAV_LINKS.map(lk => (
            <a
              key={lk.label}
              href={lk.href}
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 14px', borderRadius: 16, textDecoration: 'none', color: 'var(--text-strong)', transition: 'background .18s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-sunken)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--amber-50)', display: 'grid', placeItems: 'center', flex: 'none', color: 'var(--brand-secondary)' }}>
                {lk.icon}
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)' }}>{lk.label}</span>
              <span style={{ marginLeft: 'auto' }}><ChevronRight size={17} color="var(--text-subtle)" /></span>
            </a>
          ))}
        </div>

        {/* Order CTA */}
        <div style={{ padding: '14px 16px 20px' }}>
          <button
            onClick={() => { onClose(); router.push('/order'); }}
            style={{
              width: '100%', padding: '16px', borderRadius: 'var(--radius-pill)', border: 'none',
              background: 'var(--gradient-warm)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-base)', cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(239,117,7,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <ShoppingBag size={18} /> Order Fresh Cookies
          </button>
        </div>
      </div>
    </>
  );
}
