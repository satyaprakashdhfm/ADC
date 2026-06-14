'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import MenuDrawer from './MenuDrawer';
import LoginModal from '@/components/ordering/LoginModal';

/**
 * Sticky page header for all non-home pages — logo (home) + a hamburger that opens
 * the shared MenuDrawer, so users can jump to any page from anywhere.
 */
export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--surface-glass)', backdropFilter: 'var(--blur-panel)', WebkitBackdropFilter: 'var(--blur-panel)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px var(--gutter)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link href="/" aria-label="a dough cookie home" style={{ display: 'flex', alignItems: 'center' }}>
            <Image className="site-header-logo" src="/assets/adc-logo.png" height={54} width={92} alt="a dough cookie" style={{ objectFit: 'contain' }} />
          </Link>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 20px', borderRadius: 'var(--radius-pill)', border: '1.5px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', color: 'var(--text-strong)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-base)', boxShadow: 'var(--shadow-xs)' }}
          >
            <Menu size={20} /> Menu
          </button>
        </div>
      </header>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLoginOpen={() => setLoginOpen(true)} />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
